/**
 * gameEngine.ts — the core turn loop, per Achaemenid_Engine_Spec.md §7.
 */
import type { CardRow, GameState, ObjectiveRow, StatDelta, StatKey } from './types';
import { evaluateConditions } from './conditionParser';
import { applyCustom } from './customParser';
import { parseRawValue, resolveValue } from './valueParser';
import cardsData from '../data/cards.json';
import objectivesData from '../data/objectives.json';

const CARDS = cardsData as unknown as CardRow[];
const OBJECTIVES = objectivesData as unknown as ObjectiveRow[];

const STAT_KEYS: StatKey[] = ['faith', 'army', 'people', 'treasury'];

export function createInitialState(): GameState {
  return {
    stats: { faith: 50, army: 50, people: 50, treasury: 50 },
    age: 18,
    year: 1,
    dynasty: 1,
    flags: {},
    counters: {},
    activeBearers: new Set(['anyone', 'general', 'priest', 'merchant', 'farmer', 'monk']),
    activeEffects: new Map(),
    lockedCards: new Map(),
    pendingNextCardId: null,
    pendingChainCardKey: null,
    pendingChainConditionOverride: null,
    turnCount: 0,
    coins: 0,
    isDead: false,
    deathReason: null,
  };
}

function cardIsEligible(state: GameState, card: CardRow): boolean {
  if (card.bearer && card.bearer !== 'anyone' && !state.activeBearers.has(card.bearer)) {
    return false;
  }
  if (state.lockedCards.has(card.id)) return false;
  return evaluateConditions(state, card.conditions);
}

/** Resolves a card's `weight` cell to a finite number for weighted-random
 * selection. Per Engine Spec §2, extreme numeric weights (1e7, 1e4) mean
 * "pick this almost certainly if eligible" — the literal string "max" (36
 * cards in the data, e.g. `end>`/climax/lore-chain cards) carries the same
 * intent and must resolve to a very large number, NOT NaN. Coercing "max"
 * (or any other non-numeric weight) to NaN previously poisoned the running
 * sum in pickWeighted to NaN for the WHOLE pool, which made `r <= 0` never
 * true and silently collapsed selection to always-last-eligible-card —
 * this was the root cause of the reported "falls into a 5-card loop" bug. */
function resolveWeight(raw: number | 'max' | null): number {
  if (raw === null || raw === undefined) return 1;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 1;
  if (raw === 'max') return 1_000_000_000;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
}

/** Weighted-random pick from eligible cards. */
function pickWeighted(cards: CardRow[]): CardRow | null {
  if (cards.length === 0) return null;
  const weights = cards.map((c) => resolveWeight(c.weight));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < cards.length; i++) {
    r -= weights[i];
    if (r <= 0) return cards[i];
  }
  return cards[cards.length - 1];
}

export function selectNextCard(state: GameState): CardRow | null {
  // 1. bare '>' directive: go straight to the card at id+steps, bypassing
  //    weight/conditions entirely (Engine Spec §7 step 1, §8 worked example).
  if (state.pendingNextCardId !== null) {
    const targetId = state.pendingNextCardId;
    state.pendingNextCardId = null;
    const direct = CARDS.find((c) => c.id === targetId);
    if (direct) return direct;
    // dead end (id doesn't exist) -> fall through to normal pool
  }

  // 2. '>_X' directive: pick among the chain-start group sharing that card_key,
  //    respecting lockturn like any other card selection (Engine Spec §2:
  //    lockturn applies per-card regardless of how it's reached), disambiguated
  //    by whichever member's conditions currently hold.
  if (state.pendingChainCardKey) {
    const chainCards = CARDS.filter(
      (c) =>
        c.cardKey === state.pendingChainCardKey &&
        !state.lockedCards.has(c.id) &&
        evaluateConditions(state, c.conditions)
    );
    const picked = pickWeighted(chainCards);
    if (picked) return picked;
    // if nothing matched, fall through to normal pool (chain dead-ended)
    state.pendingChainCardKey = null;
  }

  const eligible = CARDS.filter((c) => cardIsEligible(state, c));
  return pickWeighted(eligible);
}

function applyStatDelta(state: GameState, delta: StatDelta) {
  for (const key of STAT_KEYS) {
    const raw = delta[key];
    const parsed = parseRawValue(raw);
    const resolved = resolveValue(parsed);
    if (resolved === null) continue;
    if (resolved === 'lock') {
      state.flags[`${key}_locked`] = true;
      continue;
    }
    if (state.flags[`${key}_locked`]) continue; // locked stats don't change
    state.stats[key] = Math.max(0, Math.min(100, state.stats[key] + resolved));
  }
}

export interface TurnResult {
  card: CardRow;
  decision: 'yes' | 'no';
  died: boolean;
  deathReason: string | null;
  unlockedObjectives: ObjectiveRow[];
}

const unlockedObjectiveNames = new Set<string>();

export function applyDecision(state: GameState, card: CardRow, decision: 'yes' | 'no'): TurnResult {
  const delta = decision === 'yes' ? card.yes : card.no;
  applyStatDelta(state, delta);

  const customResult = applyCustom(state, delta.custom);

  // chain handling
  if (customResult.chain) {
    if (customResult.chain.kind === 'jump' && customResult.chain.targetKey) {
      state.pendingChainCardKey = customResult.chain.targetKey;
      state.pendingNextCardId = null;
    } else if (customResult.chain.kind === 'next') {
      // bare '>'/'>>'/... = go to id + (number of '>' chars), NOT "another
      // card sharing this card_key" (confirmed wrong by Engine Spec §8: card
      // #590 key=_fencinglesson chains via '>' to #591 whose key is '_' —
      // a totally different key. Using card_key here caused infinite loops
      // among the 194 unrelated cards that all share card_key "_").
      state.pendingNextCardId = card.id + (customResult.chain.steps ?? 1);
      state.pendingChainCardKey = null;
    }
  } else {
    state.pendingChainCardKey = null;
    state.pendingNextCardId = null;
  }

  // lockturn bookkeeping. Three forms appear in the data:
  //  - a plain number N -> locked for N turns (decremented below)
  //  - "reign"           -> locked for the rest of this king's reign only
  //  - "del" (33 rows, e.g. first_card/intro_merchant/intro_witch — all
  //    clearly one-time introduction cards) -> INFERRED to mean "never show
  //    again, permanently, across all future reigns/dynasties too" (stronger
  //    than "reign"). Not explicitly spelled out in Engine_Spec.md; flagging
  //    this as an inference, not a confirmed rule, pending verification.
  if (card.lockturn === 'reign' || card.lockturn === 'del') {
    state.lockedCards.set(card.id, 'reign');
  } else if (typeof card.lockturn === 'number' && card.lockturn > 0) {
    state.lockedCards.set(card.id, card.lockturn);
  }

  // age/year increment: every non-duel card advances by 1 (per Engine Spec §
  // reverse-engineered NewYear() rule). Duel mini-game cards use cardKey
  // prefix '_duel' and are excluded from age advancement.
  const isDuelCard = card.cardKey?.startsWith('_duel') ?? false;
  if (!isDuelCard) {
    state.age += 1;
    state.year += 1;
  }
  state.turnCount += 1;

  // death check: any stat hits 0 or 100
  let died = false;
  let deathReason: string | null = null;
  for (const key of STAT_KEYS) {
    if (state.stats[key] <= 0) {
      died = true;
      deathReason = `${key}_zero`;
      break;
    }
    if (state.stats[key] >= 100) {
      died = true;
      deathReason = `${key}_max`;
      break;
    }
  }
  state.isDead = died;
  state.deathReason = deathReason;

  // objective check
  const unlocked: ObjectiveRow[] = [];
  for (const obj of OBJECTIVES) {
    if (unlockedObjectiveNames.has(obj.name)) continue;
    if (evaluateConditions(state, obj.conditions)) {
      unlockedObjectiveNames.add(obj.name);
      unlocked.push(obj);
    }
  }

  // decay lockturn counters
  for (const [id, turns] of state.lockedCards) {
    if (turns === 'reign') continue;
    const next = turns - 1;
    if (next <= 0) state.lockedCards.delete(id);
    else state.lockedCards.set(id, next);
  }

  return { card, decision, died, deathReason, unlockedObjectives: unlocked };
}

export function resetUnlockedObjectives() {
  unlockedObjectiveNames.clear();
}

export { CARDS, OBJECTIVES };
