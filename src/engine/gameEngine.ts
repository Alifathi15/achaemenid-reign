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
    // Default-active bearers at game start. Confirmed from the data: the
    // ONLY card conditioned on `dynasty=1` is #575 (card_key "first_card",
    // bearer "ghost", weight "max") — the game's own tutorial/intro card.
    // "ghost" was missing from this set entirely, so that card could never
    // become eligible and the game silently skipped straight to a random
    // card instead of the documented tutorial opener.
    activeBearers: new Set(['anyone', 'general', 'priest', 'merchant', 'farmer', 'monk', 'ghost']),
    activeEffects: new Map(),
    lockedCards: new Map(),
    pendingNextCardId: null,
    pendingChainCardKey: null,
    pendingChainConditionOverride: null,
    pendingDuelKey: null,
    turnCount: 0,
    coins: 0,
    isDead: false,
    deathReason: null,
  };
}

/** Family-relationship bearers tied to THIS specific king, not the dynasty —
 * confirmed from the data: 12 cards explicitly call del_queen/del_prince on
 * in-game story events (queen's death, divorce, prince kidnapped), proving
 * the designer's own intent is that these are transient per-reign
 * relationships, not inherited institutional roles (unlike has_general,
 * has_doctor, has_witch etc, which ARE court positions that persist). No
 * card ever calls del_X for these on the king's own death (that event isn't
 * modeled as a custom token at all — it's the reign-end system itself), so
 * this exclusion has to be applied explicitly when starting the next reign. */
const FAMILY_BEARERS_CLEARED_ON_DEATH = ['queen', 'prince', 'lady', 'rival'];

/** Builds the GameState for the NEXT reign after a king's death, carrying
 * forward exactly what the data says should persist across the dynasty and
 * resetting exactly what's scoped to a single reign. Every rule below is
 * derived from the data itself, not guessed — see each comment for the
 * concrete evidence. This function IS the answer to "must eligibility gates
 * (conditions/lockturn) still be honored after death" — reusing the exact
 * same lockedCards Map (minus reign-scoped locks) and flags/counters means
 * selectNextCard()'s conditions/lockturn checks behave identically for the
 * heir as they did mid-reign; nothing bypasses them.
 *
 * KEPT across reigns (dynasty-wide, never reset):
 *  - stats reset to 50/50/50/50 — every reign narratively starts fresh
 *    (confirmed: this mirrors createInitialState(), and no card conditions
 *    on "this reign's cumulative stat history" vs the live stat value).
 *  - year, dynasty, coins — obviously dynasty-wide (calendar time, coin
 *    economy, reign count).
 *  - `_keep`-suffixed flags and `nb_X` counters (buildings, war counts,
 *    duel wins, the devil curse, etc) — confirmed dynasty-wide by the data
 *    itself: e.g. card #711 (devil chain's generational return) requires
 *    `year>765 and devil_curse_keep`, which is only ever reachable if
 *    devil_curse_keep survives the king who first triggered it dying;
 *    #587 (duel unlock) requires `nb_duelwon_keep<4 and dynasty>3`, i.e. a
 *    counter accumulated across multiple kings gating a LATER dynasty.
 *  - lockedCards for numeric AND 'del' lockturns, with 'reign' locks
 *    stripped out (see below) — this is what makes conditions/lockturn
 *    keep being honored: a "del" (one-time-ever) card stays permanently
 *    excluded for the heir, exactly like it would for the same king.
 *  - activeBearers (court roster) MINUS the 4 family-relationship bearers
 *    — see FAMILY_BEARERS_CLEARED_ON_DEATH above. Institutional roles
 *    (general, doctor, witch, priest, spy...) persist because they're
 *    court POSITIONS, not personal relationships of the dead king.
 *
 * RESET per reign (cleared for the new king):
 *  - age back to 18 (new king's own age).
 *  - flags that are NOT `_keep`-suffixed (isLover, isCoward, isGreedy,
 *    devil_visit, etc) — confirmed these are the dead king's own personal
 *    behavioral traits, not inheritable: e.g. card #293 (start of a court
 *    romance) is gated `!has_lady and !isLover` — if isLover persisted
 *    forever after one king fell in love, no future king could ever start
 *    that story again, which the weighted-random pool design (this card
 *    can recur any reign) contradicts.
 *  - lockedCards entries whose value is 'reign' (lockturn="reign" cards) —
 *    the label itself says "locked until the end of THIS reign", so they
 *    must reopen for the heir. Numeric and 'del' locks are NOT touched.
 *  - pendingNextCardId / pendingChainCardKey / pendingDuelKey — no
 *    story-chain or duel-in-progress should carry into a new king's reign;
 *    a fresh reign always starts by drawing from the normal pool (or the
 *    dynasty=1/2 tutorial gate) via selectNextCard(), never mid-chain.
 *  - turnCount, isDead, deathReason — per-reign bookkeeping.
 *  - unlockedObjectiveNames (module-level Set) is intentionally NOT reset
 *    here — see resetUnlockedObjectives()'s caller in App.tsx; achievements
 *    are dynasty-wide (once earned, always earned) so they must persist,
 *    which is why App.tsx must switch to loading/saving them from
 *    PlayerProfile instead of calling resetUnlockedObjectives() on every
 *    reign start (that call was previously WRONG per this same rule — see
 *    the db.ts changes in this same commit). */
export function createNextReignState(previous: GameState): GameState {
  const carriedFlags: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(previous.flags)) {
    if (key.endsWith('_keep')) carriedFlags[key] = value;
  }

  const carriedLockedCards = new Map<number, number | 'reign'>();
  for (const [id, turns] of previous.lockedCards) {
    if (turns === 'reign') continue; // reign-scoped lock: reopens for the heir
    carriedLockedCards.set(id, turns);
  }

  const carriedBearers = new Set(previous.activeBearers);
  for (const familyBearer of FAMILY_BEARERS_CLEARED_ON_DEATH) {
    carriedBearers.delete(familyBearer);
  }

  return {
    stats: { faith: 50, army: 50, people: 50, treasury: 50 },
    age: 18,
    year: previous.year,
    dynasty: previous.dynasty + 1,
    flags: carriedFlags,
    counters: { ...previous.counters },
    activeBearers: carriedBearers,
    activeEffects: new Map(), // effects are transient buffs, not modeled as dynasty-wide in the data
    lockedCards: carriedLockedCards,
    pendingNextCardId: null,
    pendingChainCardKey: null,
    pendingChainConditionOverride: null,
    pendingDuelKey: null,
    turnCount: 0,
    coins: previous.coins,
    isDead: false,
    deathReason: null,
  };
}

function cardIsEligible(state: GameState, card: CardRow): boolean {
  // NOTE: bearer presence in activeBearers is NOT a gate on card selection.
  // Confirmed from TWO independent sources: (1) Achaemenid GDD §16.5 —
  // "systematic check of all 883 cards confirms no card checks has_<its own
  // bearer> in its conditions"; (2) an independently-recovered English
  // source spreadsheet (Recovered_883_Cards-2.xlsx) shows the same: 0/883
  // rows self-check has_<own bearer>, and 0 rows ever add_diplomat despite
  // 51 diplomat-bearer cards existing — if bearer-gating were real, the
  // diplomat's 51 cards (plus 9 downstream chains depending on diplomat)
  // would be permanently dead content by design, which no real card game
  // would ship. `bearer` only selects the portrait/name shown on the card;
  // `conditions` and `lockturn` are the only two real eligibility gates.
  if (state.lockedCards.has(card.id)) return false;
  return evaluateConditions(state, card.conditions);
}

/** Cards whose bearer starts with "end>" are ending/narrative cards (42 in
 * the data, e.g. bearer="end>dead_king_dogs") — per GDD §7 step 12 and §12,
 * these must be reached ONLY via an explicit chain jump (bare '>' or
 * '>_marker', both already handled by pendingNextCardId/pendingChainCardKey
 * BEFORE the random pool is even consulted) — never picked directly out of
 * the normal weighted-random pool. Confirmed as a real bug once the
 * bearer-gate above was removed: #163 (end>dead_king_dogs, condition
 * `overall<30` — a variable the engine doesn't implement yet, so it always
 * evaluates false) started appearing repeatedly mid-game because nothing
 * else excluded it, since these cards also carry extreme weights (100 to
 * 100000) meant to make them near-certain ONCE reached via a chain. This
 * filter only applies to the final random-pool selection (NOT to
 * cardIsEligible, which is also used by the legitimate chain-jump paths —
 * 7 real chains, e.g. #132->#133 end>dead_king_paganist, jump to an end>
 * card via a bare '>' and must still work). A full priority-checked ending
 * system (GDD §7 step 12: check end> conditions after every decision,
 * independent of the draw pool) is a separate feature not yet implemented —
 * this filter only stops the leak into the random pool. */
function isEndingCard(card: CardRow): boolean {
  return !!card.bearer && card.bearer.startsWith('end>');
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
  // 0. a duel is pending: the UI must render the Duel mini-game, not a card.
  //    (App.tsx checks state.pendingDuelKey before calling this, but guard
  //    here too so selectNextCard never accidentally skips past a duel.)
  if (state.pendingDuelKey) return null;

  // 1. bare '>' directive: go to the card at id+steps IF it's currently
  //    eligible (conditions/bearer/lockturn) — otherwise the chain is
  //    considered ended and we fall through to the normal pool.
  //    Verified against real data: #578 (dynasty-1 tutorial's last card)
  //    has a bare '>' pointing at id+1 = #579, which is "second_ghost"
  //    gated behind `conditions: dynasty=2` — forcing an unconditional
  //    jump here would show dynasty-2 tutorial content during dynasty 1.
  //    The Engine Spec's own worked chain example (#590->591->592, Engine
  //    Spec §8) has no conditions on any of those three cards, so adding
  //    this eligibility check changes nothing for the confirmed example
  //    while fixing the leak above.
  if (state.pendingNextCardId !== null) {
    const targetId = state.pendingNextCardId;
    state.pendingNextCardId = null;
    const direct = CARDS.find((c) => c.id === targetId);
    if (direct && cardIsEligible(state, direct)) return direct;
    // target doesn't exist, or isn't eligible right now -> chain ends,
    // fall through to normal pool
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

  const eligible = CARDS.filter((c) => cardIsEligible(state, c) && !isEndingCard(c));
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

/** Loads the module-level unlocked-objective tracker from persisted names
 * (e.g. profile.unlockedAchievements from IndexedDB) — call this once on
 * app startup, NOT on every reign start. Achievements are dynasty-wide:
 * once earned, they must stay earned across the player's whole save file,
 * not reset every time a new king begins. */
export function loadUnlockedObjectives(names: string[]) {
  unlockedObjectiveNames.clear();
  for (const n of names) unlockedObjectiveNames.add(n);
}

export function getUnlockedObjectiveNames(): string[] {
  return [...unlockedObjectiveNames];
}

export function applyDecision(state: GameState, card: CardRow, decision: 'yes' | 'no'): TurnResult {
  const delta = decision === 'yes' ? card.yes : card.no;
  applyStatDelta(state, delta);

  const customResult = applyCustom(state, delta.custom);

  // chain handling
  if (customResult.chain) {
    if (customResult.chain.kind === 'jump' && customResult.chain.targetKey) {
      // A jump target starting with "_duel_" (e.g. "_duel_general") is a real
      // Duel mini-game group, not a plain story chain (Engine Spec §8/§9
      // "duel_won" discovery). Route it to pendingDuelKey so the UI runs the
      // actual duel (duelEngine.ts) BEFORE drawing any card from this group —
      // previously the engine jumped straight into pendingChainCardKey, which
      // immediately tried to pick between the win/lose branch cards using
      // `duel_won`/`!duel_won` conditions while duel_won had never actually
      // been set by playing a duel, so the "lost" branch (!duel_won, true by
      // default) was always taken silently and no fight ever happened.
      if (customResult.chain.targetKey.startsWith('_duel_')) {
        state.pendingDuelKey = customResult.chain.targetKey;
        state.pendingChainCardKey = null;
      } else {
        state.pendingChainCardKey = customResult.chain.targetKey;
        state.pendingDuelKey = null;
      }
      state.pendingNextCardId = null;
    } else if (customResult.chain.kind === 'next') {
      // bare '>'/'>>'/... = go to id + (number of '>' chars), NOT "another
      // card sharing this card_key" (confirmed wrong by Engine Spec §8: card
      // #590 key=_fencinglesson chains via '>' to #591 whose key is '_' —
      // a totally different key. Using card_key here caused infinite loops
      // among the 194 unrelated cards that all share card_key "_").
      state.pendingNextCardId = card.id + (customResult.chain.steps ?? 1);
      state.pendingChainCardKey = null;
      state.pendingDuelKey = null;
    }
  } else {
    state.pendingChainCardKey = null;
    state.pendingNextCardId = null;
    state.pendingDuelKey = null;
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

/** Serializes a GameState to a plain JSON-safe object for IndexedDB storage
 * (Dexie/structured-clone can technically store Map/Set directly, but a
 * plain-object/array form is used here so the save survives across Dexie
 * schema changes and is trivially debuggable/exportable). Call this after
 * every decision (or on an interval) to persist the LIVE, in-progress
 * reign — not just at death — so closing the app mid-reign doesn't lose
 * the year/stats/story-chain progress. */
export interface SerializedGameState {
  stats: GameState['stats'];
  age: number;
  year: number;
  dynasty: number;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  activeBearers: string[];
  lockedCards: [number, number | 'reign'][];
  pendingNextCardId: number | null;
  pendingChainCardKey: string | null;
  pendingDuelKey: string | null;
  turnCount: number;
  coins: number;
  isDead: boolean;
  deathReason: string | null;
}

export function serializeGameState(state: GameState): SerializedGameState {
  return {
    stats: { ...state.stats },
    age: state.age,
    year: state.year,
    dynasty: state.dynasty,
    flags: { ...state.flags },
    counters: { ...state.counters },
    activeBearers: [...state.activeBearers],
    lockedCards: [...state.lockedCards.entries()],
    pendingNextCardId: state.pendingNextCardId,
    pendingChainCardKey: state.pendingChainCardKey,
    pendingDuelKey: state.pendingDuelKey,
    turnCount: state.turnCount,
    coins: state.coins,
    isDead: state.isDead,
    deathReason: state.deathReason,
  };
}

export function deserializeGameState(saved: SerializedGameState): GameState {
  return {
    stats: { ...saved.stats },
    age: saved.age,
    year: saved.year,
    dynasty: saved.dynasty,
    flags: { ...saved.flags },
    counters: { ...saved.counters },
    activeBearers: new Set(saved.activeBearers),
    activeEffects: new Map(), // not persisted — effects are re-derivable from flags/counters if ever needed
    lockedCards: new Map(saved.lockedCards),
    pendingNextCardId: saved.pendingNextCardId,
    pendingChainCardKey: saved.pendingChainCardKey,
    pendingChainConditionOverride: null,
    pendingDuelKey: saved.pendingDuelKey,
    turnCount: saved.turnCount,
    coins: saved.coins,
    isDead: saved.isDead,
    deathReason: saved.deathReason,
  };
}

/** Called once a Duel mini-game finishes. Sets `duel_won` per the RE'd
 * `DuelAct.CheckDead()` rule (Engine Spec §9: king loses -> duel_won=-1,
 * king wins -> duel_won=1; conditions check `duel_won` as "> 0" and
 * `!duel_won` as "<= 0"), increments nb_duelwon_keep on a win (matches the
 * `_duel_general` chain's own `nb_duelwon_keep+` custom-token convention),
 * then hands off to the normal chain-card group so the matching win/lose
 * branch card (e.g. #588 vs #589) is drawn on the next selectNextCard(). */
export function resolveDuelOutcome(state: GameState, kingWon: boolean) {
  state.counters['duel_won'] = kingWon ? 1 : -1;
  if (kingWon) {
    state.counters['nb_duelwon_keep'] = (state.counters['nb_duelwon_keep'] ?? 0) + 1;
  }
  state.pendingChainCardKey = state.pendingDuelKey;
  state.pendingDuelKey = null;
}

export { CARDS, OBJECTIVES };
