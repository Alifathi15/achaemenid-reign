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

/** Weighted-random pick from eligible cards. */
function pickWeighted(cards: CardRow[]): CardRow | null {
  if (cards.length === 0) return null;
  const total = cards.reduce((sum, c) => sum + (c.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const c of cards) {
    r -= c.weight ?? 1;
    if (r <= 0) return c;
  }
  return cards[cards.length - 1];
}

export function selectNextCard(state: GameState): CardRow | null {
  // 1. pending chain card takes priority
  if (state.pendingChainCardKey) {
    const chainCards = CARDS.filter(
      (c) => c.cardKey === state.pendingChainCardKey && evaluateConditions(state, c.conditions)
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
    } else if (customResult.chain.kind === 'next') {
      state.pendingChainCardKey = card.cardKey;
    }
  } else {
    state.pendingChainCardKey = null;
  }

  // lockturn bookkeeping
  if (card.lockturn === 'reign') {
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
