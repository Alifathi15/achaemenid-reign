/**
 * gameEngine.ts — the core turn loop, per Achaemenid_Engine_Spec.md §7.
 */
import type { CardRow, GameState, ObjectiveRow, StatDelta, StatKey } from './types';
import type { EffectRow } from './types';
import { evaluateConditions } from './conditionParser';
import { applyCustom } from './customParser';
import { parseRawValue, resolveValue } from './valueParser';
import cardsData from '../data/cards.json';
import objectivesData from '../data/objectives.json';
import effectsData from '../data/effects.json';

const CARDS = cardsData as unknown as CardRow[];
const OBJECTIVES = objectivesData as unknown as ObjectiveRow[];
const EFFECTS = effectsData as unknown as EffectRow[];
const EFFECTS_BY_TAG = new Map(EFFECTS.map((e) => [e.tag, e]));

const STAT_KEYS: StatKey[] = ['faith', 'army', 'people', 'treasury'];

/** Debug card-draw log — records every card actually shown to the player
 * this session, in order, with enough context to diagnose selection-logic
 * bugs after the fact (e.g. "did this mid-chain card get drawn cold from
 * the free pool, or did it correctly arrive via a chain jump?"). Purely
 * in-memory (module-level, like unlockedObjectiveNames below) — not
 * persisted to IndexedDB, cleared on page reload. Exposed via
 * getCardDrawLog()/exportCardDrawLogText() so SettingsScreen can offer a
 * "copy log" button for the player to hand back for analysis. */
export interface CardDrawLogEntry {
  turn: number;
  cardId: number;
  cardKey: string | null;
  bearer: string | null;
  conditions: string | null;
  /** How this card was reached: 'chain' = arrived via a pending '>'/'>_X'
   * jump from the previous card; 'pool' = drawn fresh from the free
   * weighted-random pool; 'tutorial'/'gatekeeper' = the two other
   * absolute-priority paths in selectNextCard(). */
  source: 'tutorial' | 'gatekeeper' | 'chain' | 'pool';
  question: string | null;
  decision?: 'yes' | 'no';
  dynasty: number;
  age: number;
}

const cardDrawLog: CardDrawLogEntry[] = [];
let cardDrawLogTurnCounter = 0;

function logCardDraw(card: CardRow, source: CardDrawLogEntry['source'], state: GameState) {
  cardDrawLogTurnCounter += 1;
  cardDrawLog.push({
    turn: cardDrawLogTurnCounter,
    cardId: card.id,
    cardKey: card.cardKey,
    bearer: card.bearer,
    conditions: card.conditions,
    source,
    question: card.question,
    dynasty: state.dynasty,
    age: state.age,
  });
}

/** Records the player's yes/no decision against the most recently logged
 * draw of this exact card id (applyDecision calls this right after
 * selectNextCard's result is shown and answered). */
function logCardDecision(cardId: number, decision: 'yes' | 'no') {
  for (let i = cardDrawLog.length - 1; i >= 0; i--) {
    if (cardDrawLog[i].cardId === cardId && cardDrawLog[i].decision === undefined) {
      cardDrawLog[i].decision = decision;
      return;
    }
  }
}

export function getCardDrawLog(): CardDrawLogEntry[] {
  return [...cardDrawLog];
}

export function clearCardDrawLog(): void {
  cardDrawLog.length = 0;
  cardDrawLogTurnCounter = 0;
}

/** Plain-text rendering of the log, one line per card draw, suitable for
 * copy/paste into a chat message or text file. */
export function exportCardDrawLogText(): string {
  if (cardDrawLog.length === 0) return '(لاگ خالیه — هنوز هیچ کارتی کشیده نشده)';
  const lines = cardDrawLog.map((e) => {
    const dec = e.decision ?? '—';
    const key = e.cardKey && e.cardKey !== '_' ? e.cardKey : '-';
    const cond = e.conditions ?? 'null';
    return `#${e.turn} | card=${e.cardId} | key=${key} | source=${e.source} | dynasty=${e.dynasty} age=${e.age} | cond=${cond} | decision=${dec} | "${(e.question ?? '').slice(0, 60)}"`;
  });
  return lines.join('\n');
}

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
    pendingDungeonKey: null,
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

  const carriedLockedCards = new Map<number, number | 'reign' | 'del'>();
  for (const [id, turns] of previous.lockedCards) {
    if (turns === 'reign') continue; // reign-scoped lock: reopens for the heir
    carriedLockedCards.set(id, turns); // numeric AND 'del' locks carry over permanently
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
    pendingDungeonKey: null,
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

/** Cards whose card_key starts with "_duelmove" (28 rows: _duelmove_attack,
 * _duelmove_defense, _duelmove_special, _duelmove_super) are NOT real
 * playable content — they are the ORIGINAL Reigns game's per-round combat
 * flavor text, kept in the data purely as source material that
 * `duelEngine.ts`'s real-time rock-paper-scissors mini-game was built from
 * (see duelEngine.ts's own header comment). They are never reached via any
 * `>`/`>_X` chain jump in the data (no card's custom ever points at
 * `_duelmove_*`), so nothing in the story intentionally shows them.
 *
 * Confirmed as a REAL bug via direct simulation: because these 28 cards all
 * have `conditions=null` and are NOT bearer="end>", `cardIsEligible()` sees
 * them as ordinary eligible cards and the normal pool happily draws them —
 * 4.5% of all cards drawn in a 200-turn run were these orphaned duel-flavor
 * lines (e.g. "سردار شمشیر بالا می‌برد؛ اکنون نوبت حمله‌ی پادشاه است" shown
 * as a bare standalone card with no duel context). 12 of them
 * (_duelmove_super, the skeleton-guard flavor) carry weight=1000 and 2 more
 * carry weight=100 — an order of magnitude above ordinary cards' weights of
 * 1-100 — so whenever eligible they tend to dominate the draw. Filtered out
 * here exactly like isEndingCard(), so they stay in cards.json as historical
 * source data (never touched) but can never leak into the live game. */
function isDuelMoveFlavorCard(card: CardRow): boolean {
  return !!card.cardKey && card.cardKey.startsWith('_duelmove');
}

/** Cards that must ONLY ever be reached by an explicit '>'/'>_X' chain jump
 * from the PREVIOUS card in their own story, never drawn cold out of the
 * normal weighted-random pool. Confirmed as a REAL bug via direct
 * simulation: 90 of the 883 cards belong to a multi-card `card_key` group
 * (a scripted mini-story — e.g. `_madrun`, the ambassador-affair story;
 * `_tinder`, the witch's spouse-selection ritual; `_magiclearn`, the
 * witch's spellcraft lessons) AND are not that group's entry card (lowest
 * id) AND carry `conditions: null` — meaning `cardIsEligible()` treats them
 * as unconditionally eligible the same as any ordinary card. With nothing
 * else excluding them, the free pool could draw e.g. card #84 ("خدمتکاری
 * با ترس گزارش می‌دهد که سفیر و زن را در راهرو دیدند" — "a servant reports
 * seeing them in the corridor") completely cold, with no prior card ever
 * having introduced the affair, no `nb_madrun` counter built up, and no
 * narrative context at all — the player sees the MIDDLE of a story they
 * never started. Simulation confirms this actually happens: in a 30x300-
 * reign run, mid-chain orphan cards were drawn out of context on ~3.5% of
 * all turns.
 *
 * This mirrors the exact same shape of bug already fixed for `end>` cards
 * (isEndingCard) and `_duelmove_*` cards (isDuelMoveFlavorCard) — a whole
 * class of "must be jumped to, not drawn" content that nothing was
 * filtering out of the free pool. The fix here generalizes that pattern:
 * any card sharing a `card_key` with at least one OTHER card (i.e. it's
 * part of a real multi-card group, confirmed via an external '>'/'>_X'
 * reference into that group from elsewhere in the 883-card dataset — see
 * scripts_order_calc-style analysis, verified 56 of 64 multi-card groups
 * have such an external entry point) is excluded from the free pool UNLESS
 * it is that group's own entry card (lowest id) OR it carries its own
 * non-null `conditions` (meaning the data itself already gates when that
 * card can legitimately fire, independent of chain position — e.g.
 * `_end_toorich`'s #801 requires `crusade_keep`, a real standalone gate).
 *
 * The 8 groups WITHOUT an external chain-entry reference (`bird`,
 * `end_spice`, `ratereigns`, `afterwedding`, and the 4 `_duelmove_*`
 * groups already handled separately) are correctly left untouched — their
 * members are either independently-conditioned parallel content (verified:
 * every member of those 4 non-duelmove groups carries its own real
 * condition, e.g. `afterwedding`'s #366 `has_queen` vs #367 `age=25` — two
 * unrelated stories that happen to share a card_key, not a sequential
 * chain) or already covered by isDuelMoveFlavorCard. */
/** Ids that must NOT be drawn cold from the free pool because they only
 * make narrative sense as the continuation of a story the player has
 * already started, reachable via an explicit `>`/`>_X` jump from elsewhere.
 *
 * v1 (see prior commit history) excluded non-entry members of a real
 * >=2-member cardKey group when something external named-jumped into that
 * group, but always exempted the group's own lowest-id "entry" card,
 * reasoning it was the legitimate pool-draw starting point.
 *
 * v2 added a general "any confirmed jump target with conditions:null"
 * check to also catch cardKey `"_"` cards and unique-cardKey singleton
 * groups (fixing card #497, #681) — but STILL exempted every group's
 * lowest-id member unconditionally via CHAIN_GROUP_ENTRY_IDS.
 *
 * That "entry is always exempt" assumption is itself wrong, confirmed via
 * a second user-provided play log: card #835 (`_party`'s lowest-id member,
 * "گرگینه در میانه‌ی جشن..." — "the werewolf howls mid-celebration") was
 * drawn cold from the pool on turn 13, with the player having no idea a
 * party was even happening. #835 IS the group's "entry" by id, but it is
 * ALSO the confirmed target of a NAMED jump from #834 (bearer=priest,
 * `conditions: "has_parker and has_werewolf"`, `custom: ">_party"`) — #834
 * is the story's REAL entry point (a priest's warning once both the jester
 * and werewolf are in the court), and #835 only exists to be jumped to
 * from there. Same pattern confirmed for `_chooseflag` (#204, jumped to
 * from #203's `has_jester` gate), `_returnexplorator_keep` (#241, jumped
 * to from #240's colony-exploration setup), and every other named-jump
 * target group checked — none of their "entry" cards make sense fired
 * cold; they all presume the setup card already happened.
 *
 * v3 (this version) drops the blanket entry exemption. The rule is now
 * uniform for ALL cards regardless of cardKey/group-entry status: a card
 * with `conditions: null` is excluded from the free pool if it is a
 * confirmed jump target (named `>_key`, targeting every member of that
 * key's group, or bare-arrow `>`/`>>`/... landing on its exact id) from
 * anywhere else in the 883-card dataset. The only remaining exemptions are
 * (a) the jumping card's OWN chain-continuation arrows within the same
 * group (a group's internal `>` between its own members doesn't make an
 * EXTERNAL entry — that's just how the story advances turn to turn, e.g.
 * `_party`'s #836-839 each bare-arrow back to `>_party` to keep the scene
 * going) and (b) cards with their own real non-null `conditions` (already
 * self-gating, independent of chain position). Groups with NO external
 * jump reference at all (`bird`, `end_spice`, `ratereigns`, `afterwedding`
 * — confirmed via full-dataset scan, no other card ever names or arrows
 * into them) are correctly left fully pool-accessible, exactly as before. */
const MID_CHAIN_ORPHAN_IDS: ReadonlySet<number> = (() => {
  const byKey = new Map<string, CardRow[]>();
  for (const c of CARDS) {
    if (!c.cardKey || c.cardKey === '_') continue;
    const arr = byKey.get(c.cardKey);
    if (arr) arr.push(c);
    else byKey.set(c.cardKey, [c]);
  }

  const orphanIds = new Set<number>();

  // --- Case A: every member of a real cardKey group (including its
  // lowest-id "entry") is excluded when something OUTSIDE the group
  // explicitly names that group via `>_key`. Internal same-group bare
  // arrows (a member's own `>` continuing its own story) never count as
  // "external" here — only a NAMED jump, or a bare arrow originating from
  // a card that is not itself a member of the group, counts. ---
  for (const [key, grp] of byKey) {
    if (key.startsWith('_duelmove')) continue; // already handled by isDuelMoveFlavorCard
    const sorted = [...grp].sort((a, b) => a.id - b.id);
    const memberIds = new Set(sorted.map((c) => c.id));
    let hasExternalEntry = false;
    for (const c of CARDS) {
      if (memberIds.has(c.id)) continue;
      for (const side of [c.yes, c.no]) {
        const custom = side?.custom;
        if (!custom) continue;
        for (const rawToken of custom.split(/\s+and\s+/i)) {
          const t = rawToken.trim();
          const namedJump = t.match(/^>+_?(\w+)$/);
          if (namedJump && ('_' + namedJump[1] === key || namedJump[1] === key)) {
            hasExternalEntry = true;
          }
          const bareArrow = t.match(/^(>+)$/);
          if (bareArrow && memberIds.has(c.id + bareArrow[1].length)) {
            hasExternalEntry = true;
          }
        }
      }
    }
    if (!hasExternalEntry) continue; // e.g. bird/end_spice/ratereigns/afterwedding
    for (const c of sorted) {
      if (c.conditions) continue; // has its own real gate, safe to leave in the free pool
      orphanIds.add(c.id);
    }
  }

  // --- Case B: any OTHER card (cardKey "_" or a real-but-unique key, so
  // not covered by case A's grouping) that is itself a confirmed jump
  // target (named or bare-arrow) from anywhere in the dataset, and has no
  // condition of its own. ---
  for (const c of CARDS) {
    if (orphanIds.has(c.id)) continue;
    if (c.cardKey && c.cardKey !== '_' && byKey.has(c.cardKey)) continue; // handled by case A
    if (c.cardKey?.startsWith('_duelmove')) continue;
    if (c.conditions) continue;
    let isJumpTarget = false;
    for (const other of CARDS) {
      if (other.id === c.id) continue;
      for (const side of [other.yes, other.no]) {
        const custom = side?.custom;
        if (!custom) continue;
        for (const rawToken of custom.split(/\s+and\s+/i)) {
          const t = rawToken.trim();
          if (c.cardKey && c.cardKey !== '_') {
            const namedJump = t.match(/^>+_?(\w+)$/);
            if (namedJump && ('_' + namedJump[1] === c.cardKey || namedJump[1] === c.cardKey)) {
              isJumpTarget = true;
            }
          }
          const bareArrow = t.match(/^(>+)$/);
          if (bareArrow && other.id + bareArrow[1].length === c.id) {
            isJumpTarget = true;
          }
        }
      }
      if (isJumpTarget) break;
    }
    if (isJumpTarget) orphanIds.add(c.id);
  }

  return orphanIds;
})();

function isMidChainOrphanCard(card: CardRow): boolean {
  return MID_CHAIN_ORPHAN_IDS.has(card.id);
}

/** Cards that must NOT be drawn until their bearer has actually joined the
 * court, even though `bearer` presence is (correctly, per the note on
 * cardIsEligible above) not a general eligibility gate. This is a NARROW,
 * data-confirmed exception for a specific class of content: a character
 * who is optional (not in the default activeBearers roster) has ONE real
 * "recruitment" card — confirmed by the pattern `conditions: "!has_X ..."`
 * WITH `custom: "add_X"` on some side of that exact card — and every OTHER
 * card carrying that same bearer with `conditions: null` (no gate of its
 * own) implicitly assumes the character is already in the court.
 *
 * Confirmed as a REAL bug via the card-draw log the user hand-verified:
 * card #508 (`_magiclearn`, bearer "witch", `conditions: null`,
 * `weight: "max"`) opens with "شما را به گوشه‌ی تاریک باغ می‌برم" ("I'll
 * take you to the dark corner of the garden") — dialogue that presumes an
 * existing relationship with the witch — yet it was drawn on turn 5 of a
 * fresh reign, before card #482/#483 (the witch's actual recruitment) had
 * ever appeared. `weight: "max"` made this near-guaranteed whenever
 * eligible. A systematic re-scan found 29 more cards with this exact
 * shape across 12 other optional bearers (prophet, queen, parker,
 * foreign_princess, minstrel, rival, doctor, spy, homunculus, black_bird —
 * e.g. #57 "شبکه‌ای دائمی از خبرچینان..." assumes a spy network already
 * exists, #380 the queen's death card, #416 the queen wanting a bigger
 * role, all reachable cold with zero prior court-building).
 *
 * Scope kept deliberately narrow to avoid the mistake the original
 * bearer-gate removal was fixing (permanently dead content for bearers
 * with no real recruitment mechanic): ONLY bearers with a confirmed
 * `!has_X` + `add_X` recruitment card are covered here, and general/
 * merchant/priest/farmer/monk/ghost/anyone (already default-active per
 * createInitialState, or with no single canonical recruitment card) are
 * excluded — general and merchant DO have `add_general`/`add_merchant`
 * mechanics for re-recruiting after death/betrayal, but since they start
 * every reign already active, gating them would wrongly block content
 * meant to be available from turn one. The bearer's own recruitment card
 * (a different bearer per the data, e.g. #482 is bearer "anyone") is never
 * itself excluded, and any card reached via an explicit chain jump is left
 * alone (its own condition, or the chain's context, already governs it —
 * the concern here is only the free pool drawing this content cold). */
const RECRUIT_GATED_BEARERS: ReadonlyMap<string, number> = new Map([
  ['prophet', 43],
  ['queen', 358],
  ['parker', 259],
  ['foreign_princess', 269],
  ['lady', 293],
  ['minstrel', 343],
  ['rival', 405],
  ['doctor', 478],
  ['spy', 480],
  ['witch', 482],
  ['homunculus', 498],
  ['black_bird', 559],
  ['barbare', 803],
]);

const BEARER_GATED_ORPHAN_IDS: ReadonlySet<number> = (() => {
  const orphanIds = new Set<number>();
  for (const [bearer, recruitCardId] of RECRUIT_GATED_BEARERS) {
    for (const c of CARDS) {
      if (c.bearer !== bearer) continue;
      if (c.id === recruitCardId) continue;
      if (c.conditions) continue; // has its own real gate, safe to leave in the free pool
      if (isMidChainOrphanCard(c)) continue; // already excluded, avoid double-bookkeeping
      orphanIds.add(c.id);
    }
  }
  return orphanIds;
})();

function isBearerGatedOrphanCard(card: CardRow): boolean {
  return BEARER_GATED_ORPHAN_IDS.has(card.id);
}

/** The 8 "gatekeeper" cards that fire the instant a stat hits 0 or 100 —
 * confirmed from the data itself: each is the ONLY card whose condition is
 * a bare single-term stat=0/100 comparison (spiritual=0, spiritual=100,
 * military=0, military=100, demography=0, demography=100, treasure=0,
 * treasure=100), each carries weight=1000000 (an order of magnitude above
 * any normal card), and each has custom=">_end_X" jumping straight into
 * that stat's ending-card group (e.g. #131 "paganism", spiritual=0 ->
 * >_end_paganism -> group containing #132, an escape card gated on
 * cathedral_keep that AVOIDS death via an inquisition, weight=max, and
 * #133, the real bearer="end>dead_king_paganist" death card, weight=100 —
 * so building the cathedral literally lets the player survive a
 * spiritual=0 crisis instead of dying, which is why this can't be a blunt
 * instant-death check). These 8 ids are fixed, verified-from-data IDs, not
 * a runtime-computed set — listing them by id keeps the check O(1) instead
 * of rescanning conditions text.
 *   131 (paganism, spiritual=0), 134 (heavenonearth, spiritual=100),
 *   137 (invasion, military=0), 141 (coup, military=100),
 *   145 (nodemo, demography=0), 150 (nocontrol, demography=100),
 *   158 (toorich, treasure=100), 161 (penniless, treasure=0). */
const STAT_ENDING_GATEKEEPER_IDS = [131, 134, 137, 141, 145, 150, 158, 161];

/** Members of the 8 stat-threshold gatekeepers' own target chain groups
 * (e.g. `_end_heavenonearth`, `_end_nodemo`...) — confirmed as a REAL bug
 * via a user-provided play log: card #135 (`_end_heavenonearth`'s escape
 * route, bearer "dungeon>door_wall_dark", conditions "!intheDungeon" —
 * true almost always) was drawn cold from the free pool at age 21 with
 * `spiritual` nowhere near 100, its "no" answer chained via bare '>' into
 * #136 (an unconditional bearer="end>..." card), ending the reign at age
 * 22 for a reason completely disconnected from anything the player did.
 *
 * `isMidChainOrphanCard` already exists for exactly this shape of bug (a
 * card that only makes narrative sense as a chain continuation), but its
 * exemption rule — "a card with its own non-null `conditions` is assumed
 * to be independently self-gating, safe to leave in the free pool" — does
 * NOT hold for these specific escape-route cards: `!intheDungeon`,
 * `cathedral_keep`, `fortification_keep`, `barn_keep`, `centralbank_keep`,
 * `school_keep`, `reddwarf_keep`, `crusade_keep` are near-always-true (or
 * merely "this building exists") gates, not evidence the player actually
 * reached the crisis these cards are written to resolve — that crisis is
 * ONLY represented by the gatekeeper's own condition (e.g. spiritual=100).
 * Confirmed by design intent: these cards' own weight (400, "max", 500,
 * 100000...) is an order of magnitude above the ordinary 1-100 pool range
 * SPECIFICALLY so they win decisively once reached via the gatekeeper's
 * chain jump — that same extreme weight is what makes a cold pool draw of
 * one of these near-certain once its (weak) condition holds, hijacking
 * play with narrative that presupposes a crisis that never happened.
 *
 * Fix scope: exclude EVERY member of each gatekeeper's target group from
 * the free pool — including the group's own end> members (already covered
 * by isEndingCard, kept here too for completeness/robustness) and the
 * escape-route members regardless of their own conditions field. This
 * does NOT touch any card's `weight` (per explicit product decision: the
 * weights are intentional and must stay as authored for their role WITHIN
 * the chain-selection pickWeighted() call) — it only removes these cards
 * from the unrelated free-pool draw path. Reachability via the gatekeeper
 * chain jump (pendingChainCardKey) is untouched, since that path calls
 * `evaluateConditions` directly, not this pool filter. */
const GATEKEEPER_TARGET_ORPHAN_IDS: ReadonlySet<number> = (() => {
  const orphanIds = new Set<number>();
  for (const gatekeeperId of STAT_ENDING_GATEKEEPER_IDS) {
    const gatekeeper = CARDS.find((c) => c.id === gatekeeperId);
    if (!gatekeeper) continue;
    const rawCustom = gatekeeper.yes.custom ?? gatekeeper.no.custom ?? '';
    // gatekeeper custom is always "> _targetKey [and ...]" (or "and"-joined
    // with unrelated flags, e.g. #137's war-flag clears) — the chain jump
    // token is always the first "and"-separated piece.
    const firstToken = rawCustom.split(/\s+and\s+/i)[0]?.trim() ?? '';
    const m = firstToken.match(/^>+(_?\w+)$/);
    if (!m) continue;
    const targetKey = m[1];
    for (const c of CARDS) {
      if (c.cardKey === targetKey) orphanIds.add(c.id);
    }
  }
  return orphanIds;
})();

function isGatekeeperTargetOrphanCard(card: CardRow): boolean {
  return GATEKEEPER_TARGET_ORPHAN_IDS.has(card.id);
}

/** GDD §7 step 12: "چک کن آیا شرایطِ end> فعال شدن؟ اگه آره، این کارت‌ها
 * اولویتِ مطلق دارن" — after every decision, before anything else
 * (including an in-progress story chain or the normal pool), check whether
 * any of the 8 stat-threshold gatekeepers is now eligible. If so it MUST be
 * shown next, unconditionally — this is what makes hitting spiritual=0 (or
 * any other stat extreme) actually surface its own specific ending
 * narrative/escape-hatch card instead of the generic "a stat hit 0" message
 * the old blunt instant-death check produced. Each gatekeeper's own
 * conditions field is a single bare comparison (no extra "and" terms), so
 * it is guaranteed eligible exactly when that stat is truly at the
 * threshold — no risk of the priority check silently missing it. */
function checkStatEndingGatekeepers(state: GameState): CardRow | null {
  const eligible = STAT_ENDING_GATEKEEPER_IDS.map((id) => CARDS.find((c) => c.id === id)).filter(
    (c): c is CardRow => !!c && cardIsEligible(state, c)
  );
  return pickWeighted(eligible);
}

/** Given an end> card, derives a deathReason key for DeathScreen's
 * REASON_TEXT lookup out of the bearer's own suffix (e.g.
 * "end>dead_king_dogs" -> "story_dead_king_dogs") — distinct from the 8
 * generic stat-threshold reasons (faith_zero etc) so the death screen can
 * show narrative-specific text instead of falling back to the generic
 * "سلطنتِ او در سکوتِ تاریخ به پایان رسید." for every story-driven ending. */
export function endingCardDeathReason(card: CardRow): string {
  const suffix = (card.bearer ?? '').slice('end>'.length);
  return `story_${suffix}`;
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
  // 0. a duel or dungeon mini-game is pending: the UI must render that
  //    screen, not a card. (App.tsx checks these before calling this, but
  //    guard here too so selectNextCard never accidentally skips past one.)
  if (state.pendingDuelKey) return null;
  if (state.pendingDungeonKey) return null;

  // 0.1. ABSOLUTE priority: the dynasty-1 tutorial opener (#575,
  //    "first_card", bearer "ghost", conditions "dynasty=1", weight="max",
  //    lockturn="del" so it can only ever fire once per save). Confirmed
  //    as a REAL bug (not a false alarm) via a 200-fresh-start simulation:
  //    card #508 ("_magiclearn", bearer "witch") ALSO carries weight="max"
  //    with conditions=null (i.e. always eligible, including turn 0) — the
  //    only other card in the whole 883-row dataset with that exact
  //    combination. Both cards being tied at the same extreme weight meant
  //    pickWeighted() coin-flipped between them on a fresh reign: #508 won
  //    107/200 simulated fresh starts, meaning new players saw the witch's
  //    unrelated magic-lesson card as their FIRST EVER card well over half
  //    the time instead of the documented tutorial ghost. Checking #575
  //    here, before the normal pool (and before the pending-chain/pending-
  //    next-card checks below, since a truly fresh reign has none of those
  //    set anyway), guarantees the tutorial always wins the very first
  //    draw whenever it's still eligible, regardless of what other
  //    weight="max" cards exist in the pool.
  const tutorialOpener = CARDS.find((c) => c.id === 575);
  if (tutorialOpener && cardIsEligible(state, tutorialOpener)) {
    logCardDraw(tutorialOpener, 'tutorial', state);
    return tutorialOpener;
  }

  // 0.2. Same class of bug as #575 above, for the dynasty-2 tutorial
  // follow-up (#579, "second_ghost", bearer "ghost", conditions
  // "dynasty=2", weight="max", lockturn="del"). #508 ("_magiclearn",
  // bearer "witch") also carries weight="max" with conditions=null (i.e.
  // eligible on ANY turn, including the first turn of dynasty 2) - the
  // exact same coin-flip collision that made #575 unreliable, just one
  // dynasty later. Without this explicit priority check, pickWeighted()
  // treats #579 and #508 as equally-weighted competitors the instant
  // dynasty flips to 2, so roughly half of players would see the
  // witch's unrelated card instead of the documented "the king is
  // mortal, the dynasty continues" reminder.
  const secondGhostOpener = CARDS.find((c) => c.id === 579);
  if (secondGhostOpener && cardIsEligible(state, secondGhostOpener)) {
    logCardDraw(secondGhostOpener, 'tutorial', state);
    return secondGhostOpener;
  }

  // 0.5. GDD §7 step 12 — ABSOLUTE priority: if any stat is currently at its
  //    0/100 threshold, its gatekeeper card (see STAT_ENDING_GATEKEEPER_IDS)
  //    must be shown next. Checked before the '>'/'>_X' chain-resume logic
  //    below EXCEPT when a story chain is actively in progress (see GUARD
  //    below) — explicit product decision: a scripted narrative sequence
  //    (bare '>' or '>_X' in flight) must be allowed to finish even if it
  //    momentarily drives a stat to 0/100 along the way, since several real
  //    chains do exactly that on purpose as pure narrative beats with no
  //    intent to end the reign there. Confirmed via simulation: the devil/
  //    black-dog main story (#701-#710, GDD's central story) sets faith to
  //    0 at #702 via a bare '>' to #703, army to 0 at #704, treasury to 0
  //    at #705, etc — INTENTIONAL narrative drama, not intended deaths.
  //    With the old unconditional check, the gatekeeper interrupted this
  //    chain at #702, before the story ever reached its real climax (#710,
  //    where the curse is actually set) — the whole 52-card main story was
  //    unreachable in practice.
  //    GUARD: if a chain is actively in flight (pendingNextCardId or
  //    pendingChainCardKey is set — meaning the PREVIOUS card explicitly
  //    routed us here via '>'/'>_X', not the free weighted pool), skip the
  //    gatekeeper check entirely for this turn and let the chain continue.
  //    This deliberately means an ending condition first reached mid-chain
  //    is checked again once the chain naturally ends (falls through to the
  //    normal pool) or reaches its own end> card — it is only DEFERRED by
  //    letting the current scripted sequence play out, never silently
  //    dropped, since applyDecision's death-independent stat clamp keeps
  //    the extreme stat value in place until then.
  const chainInFlight = state.pendingNextCardId !== null || state.pendingChainCardKey !== null;
  if (!chainInFlight) {
    const statEnding = checkStatEndingGatekeepers(state);
    if (statEnding) {
      logCardDraw(statEnding, 'gatekeeper', state);
      return statEnding;
    }
  }

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
    if (direct && cardIsEligible(state, direct)) {
      logCardDraw(direct, 'chain', state);
      return direct;
    }
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
    if (picked) {
      logCardDraw(picked, 'chain', state);
      return picked;
    }
    // if nothing matched, fall through to normal pool (chain dead-ended)
    state.pendingChainCardKey = null;
  }

  const eligible = CARDS.filter(
    (c) =>
      cardIsEligible(state, c) &&
      !isEndingCard(c) &&
      !isDuelMoveFlavorCard(c) &&
      !isMidChainOrphanCard(c) &&
      !isGatekeeperTargetOrphanCard(c) &&
      !(isBearerGatedOrphanCard(c) && !state.activeBearers.has(c.bearer!))
  );
  const picked = pickWeighted(eligible);
  if (picked) logCardDraw(picked, 'pool', state);
  return picked;
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

/** Effects (src/data/effects.json, 21 rows) describe PERIODIC per-turn stat
 * deltas layered on top of a `_keep`/bare-flag token already handled by
 * customParser.ts — e.g. `plague` drains people by 3 every turn for as
 * long as the flag is active, `isLover` drains faith by 1/turn, `isSlaver`
 * gains treasury by 2/turn for exactly 15 turns then stops. Confirmed via
 * user clarification on the recovered-data spec: a trailing `*` on an
 * Effects-sheet value means "apply this delta every turn the effect is
 * active" (distinct from a card's own yes/no stat delta, where `*` is
 * purely a cosmetic UI marker per valueParser.ts and has zero numeric
 * effect — same underlying parseRawValue/resolveValue magnitude-extraction
 * is reused here, just re-applied every turn instead of once). `length`
 * (present on 3 of the 21 rows: isSlaver=15, isStone=8, theocracy=30,
 * spice_trade_keep=30) bounds how many turns the delta keeps applying
 * before automatically stopping.
 *
 * REAL BUG this closes: `GameState.activeEffects` (a Map<string,
 * {turnsLeft}>) existed in types.ts from the start specifically for this,
 * but nothing ever populated or read it — every one of these 21 designed
 * mechanics (plague's population drain, a crusading king's slow treasury
 * drain, a lover's fading faith, being trapped in the dungeon draining all
 * four stats every turn...) was silently inert; the token only ever became
 * a boolean flag with no periodic effect.
 *
 * Deliberately SCOPED to avoid a new regression: only the 8 Effects rows
 * that actually carry a non-null faith/army/people/treasury delta
 * (crusade_keep, isSlaver, plague, isLover, intheDungeon, theocracy,
 * spice_trade_keep, colonies_keep) are wired into activeEffects at all —
 * the other 13 (isStone, isOblivious, isDeaf, devil_visit,
 * devil_curse_keep, fortification_keep, strawberry_keep, centralbank_keep,
 * cathedral_keep, hospital_keep, barn_keep, excalibur_keep, dice_keep)
 * have no deltas to apply and are left exactly as before — pure flags,
 * matching the already-audited permanent-flag behavior documented in
 * docs/Chain_Audit.md (e.g. Chain 19's confirmation that isStone is a
 * deliberate one-time-forever flag with no expiry). Critically, expiry
 * here ONLY stops the periodic delta — it never clears the underlying
 * flag itself, because dozens of unrelated story chains gate on these
 * same flags staying true forever once set (e.g. `spice_trade_keep` gates
 * 10 other cards' conditions across the whole spice-economy substory,
 * `crusade_keep` gates 19 cards across the crusade storyline) — silently
 * auto-clearing the flag on effect expiry would have broken all of those
 * chains' long-term gating, a strictly worse regression than the bug
 * being fixed. */
const PERIODIC_EFFECT_TAGS: ReadonlySet<string> = new Set(
  EFFECTS.filter((e) => STAT_KEYS.some((k) => e[k] !== null && e[k] !== undefined)).map((e) => e.tag)
);

/** Extracts the per-turn numeric delta from an Effects-sheet cell (e.g.
 * "-3*", "2*", "lock") using the same magnitude-extraction as a card's own
 * stat delta (parseRawValue/resolveValue already strip a trailing '*'
 * correctly) — only the *interpretation* differs (applied every turn here,
 * vs once at decision time for a card's own yes/no delta). */
function resolvePeriodicDelta(raw: number | string | null | undefined): number | 'lock' | null {
  return resolveValue(parseRawValue(raw));
}

/** Called once per turn (from applyDecision, after the card's own one-time
 * stat delta has already been applied) — activates any newly-set flag that
 * has a periodic Effect definition, and applies+decrements every currently
 * active periodic effect. Must run AFTER applyCustom's flagsSet is known
 * (to catch effects activated by THIS decision) but the activation and the
 * per-turn application happen in the same call so a freshly-activated
 * effect's first tick lands on the very turn it starts, matching Reigns'
 * own "the effect begins immediately" convention (confirmed by the `plague`
 * card's own narrative, which describes the outbreak as already underway
 * the moment the flag is set). */
function processActiveEffects(state: GameState, flagsSet: string[]) {
  for (const flagName of flagsSet) {
    if (!PERIODIC_EFFECT_TAGS.has(flagName)) continue;
    if (state.activeEffects.has(flagName)) continue; // already active, don't reset turnsLeft
    const effect = EFFECTS_BY_TAG.get(flagName);
    if (!effect) continue;
    state.activeEffects.set(flagName, { turnsLeft: effect.length ?? null });
  }

  for (const [tag, tracker] of state.activeEffects) {
    const effect = EFFECTS_BY_TAG.get(tag);
    if (!effect) {
      state.activeEffects.delete(tag);
      continue;
    }
    for (const key of STAT_KEYS) {
      const resolved = resolvePeriodicDelta(effect[key]);
      if (resolved === null) continue;
      if (resolved === 'lock') {
        state.flags[`${key}_locked`] = true;
        continue;
      }
      if (state.flags[`${key}_locked`]) continue;
      state.stats[key] = Math.max(0, Math.min(100, state.stats[key] + resolved));
    }
    if (tracker.turnsLeft !== null) {
      const nextTurnsLeft = tracker.turnsLeft - 1;
      if (nextTurnsLeft <= 0) {
        // Effect's periodic window has ended — stop applying its delta.
        // The underlying flag (state.flags[tag]) is deliberately left
        // untouched; see PERIODIC_EFFECT_TAGS doc comment above.
        state.activeEffects.delete(tag);
      } else {
        state.activeEffects.set(tag, { turnsLeft: nextTurnsLeft });
      }
    }
  }
}

export interface TurnResult {
  card: CardRow;
  decision: 'yes' | 'no';
  died: boolean;
  deathReason: string | null;
  /** The narrative text to show on the death screen — for a real
   * bearer="end>..." ending card (42 of them across the dataset, e.g.
   * #136 "آتشکده صلاح دید که یه شهید تر و تمیز ازت درمیاد..."), this is
   * that SAME card's own `question` text, since every one of those cards
   * was authored specifically as death-screen narration (confirmed via
   * Recovered_Game_Logic_Deep_Dive.xlsx's "Death Cards" sheet — all 42
   * rows' `question` column reads as a completed past-tense death
   * narrative, not an in-play yes/no prompt). null for the 8 generic
   * stat-threshold reasons (faith_zero etc, which have no card of their
   * own — DeathScreen's existing REASON_TEXT table already covers those). */
  deathStoryText: string | null;
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
  logCardDecision(card.id, decision);

  // If the card being resolved IS an ending card itself (reached via an
  // explicit chain jump, e.g. losing a duel -> #379 end>dead_king_duel),
  // the reign ends immediately on this decision — these cards' own
  // yes/no stat-deltas and custom are all empty by design (confirmed: none
  // of the 42 end> cards have any override_yes/answer_yes/custom content),
  // so there is nothing to "apply" beyond ending the reign with this card's
  // own narrative. Previously this case fell through to the normal turn
  // logic, which showed the death narrative as if it were an ordinary
  // yes/no question, then just continued the game waiting for an unrelated
  // stat to eventually hit 0 — the reign never actually ended here.
  if (isEndingCard(card)) {
    state.isDead = true;
    state.deathReason = endingCardDeathReason(card);
    return {
      card,
      decision,
      died: true,
      deathReason: state.deathReason,
      deathStoryText: card.question,
      unlockedObjectives: [],
    };
  }

  const delta = decision === 'yes' ? card.yes : card.no;
  applyStatDelta(state, delta);

  const customResult = applyCustom(state, delta.custom);
  processActiveEffects(state, customResult.flagsSet);

  // Card #819 (_barbatalk, conditions "nb_barba>5", weight="max") is the
  // ONE-TIME climax of the barbarian-negotiation mini-chain (#807-#818):
  // nb_barba is a pure counter (never read by any OTHER card's conditions —
  // confirmed: #819 is its only reader in the whole 883-card data) that
  // those setup cards increment toward >5, then #819 is meant to resolve
  // the whole thread once (peace via "yes" or war via "no", both just
  // chain onward with a bare '>'). Nothing in the data ever decrements or
  // clears nb_barba after #819 fires, so without this reset the counter
  // permanently stays >5 and #819 — carrying weight="max", an order of
  // magnitude above any normal card — instantly wins every future
  // selectNextCard() draw again on the very next turn, hard-locking the
  // whole card pool into an infinite #819->#820->#821 loop (confirmed via
  // a 300-reign regression: this was NOT introduced by the end> priority
  // system work — the exact same lock reproduces against the pre-end>-fix
  // code too, it just never had enough turns to surface before because the
  // old blunt stat-based death check usually ended the reign first).
  if (card.id === 819) {
    state.counters['nb_barba'] = 0;
  }

  // Card #778 (_end_dungeon group, bearer "jester", condition "dice_keep",
  // weight="max") is explicitly framed as a ONE-TIME event in its own text
  // ("یک بازی آخر" — "one last game"), set up by an entirely unrelated
  // witch/science card (#512 "_magiclearn") that sets dice_keep and is
  // never cleared by anything else in the whole dataset. Without clearing
  // it here, #778 — carrying weight="max" with no lockturn and no other
  // gating condition — permanently dominates every future selectNextCard()
  // draw once dice_keep is set, regardless of whether the player answers
  // yes (escape via a bare '>' to #779) or no (loops back into the same
  // "_end_dungeon" group, which #778 also wins again due to its weight).
  // Confirmed via a 300-reign regression: this alone locked ~90%+ of test
  // reigns into permanent #778-recurrence once dice_keep was ever set.
  if (card.id === 778) {
    delete state.flags['dice_keep'];
  }

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
        state.pendingDungeonKey = null;
      } else if (customResult.chain.targetKey === '_dungeon1') {
        // Real dungeon maze entry point (see types.ts's pendingDungeonKey
        // doc comment) — simplified to a single win/lose screen instead of
        // the full 48-card hand-authored maze.
        state.pendingDungeonKey = customResult.chain.targetKey;
        state.pendingChainCardKey = null;
        state.pendingDuelKey = null;
      } else {
        state.pendingChainCardKey = customResult.chain.targetKey;
        state.pendingDuelKey = null;
        state.pendingDungeonKey = null;
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
      state.pendingDungeonKey = null;
    }
  } else {
    state.pendingChainCardKey = null;
    state.pendingNextCardId = null;
    state.pendingDuelKey = null;
    state.pendingDungeonKey = null;
  }

  // lockturn bookkeeping. Three forms appear in the data:
  //  - a plain number N -> locked for N turns (decremented below)
  //  - "reign"           -> locked for the rest of this king's reign only
  //  - "del" (33 rows, e.g. first_card/intro_merchant/intro_witch — all
  //    clearly one-time introduction cards) -> locked FOREVER, dynasty-wide,
  //    across all future reigns too (stronger than "reign"). Confirmed as a
  //    REAL bug via direct simulation: card #701 (the devil-story's ONLY
  //    entry point, lockturn="del", condition "year>665") is meant to fire
  //    exactly once per save/dynasty, but the previous code stored "del"
  //    locks using the SAME 'reign' sentinel as true per-reign locks, so
  //    createNextReignState()'s "reopen 'reign' locks for the heir" rule
  //    (which is correct for genuine reign-scoped locks) indistinguishably
  //    reopened "del" locks too. A 5-generation simulation starting at
  //    year=700 (past the year>665 gate) showed card #701 firing 4 times
  //    across 5 reigns instead of once — meaning the devil-curse main story
  //    could restart from scratch for every single heir, which contradicts
  //    its own once-per-dynasty narrative (and similarly affected all other
  //    32 "del"-locked cards: first_card/first tutorial, intro_witch,
  //    intro_nun, intro_merchant, printing, and 5 more devil-chain gates
  //    #711-746). Fixed by giving 'del' its own distinct sentinel that
  //    createNextReignState() never reopens.
  if (card.lockturn === 'reign') {
    state.lockedCards.set(card.id, 'reign');
  } else if (card.lockturn === 'del') {
    state.lockedCards.set(card.id, 'del');
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

  // death check: previously this fired the instant a stat crossed 0/100,
  // ending the reign with no narrative before the player ever saw why.
  // Per GDD §7 step 12, hitting a stat extreme must instead surface that
  // stat's own gatekeeper card (STAT_ENDING_GATEKEEPER_IDS, checked with
  // absolute priority at the top of selectNextCard) — the reign only
  // actually ends once play reaches a real bearer="end>..." card (handled
  // by the isEndingCard branch at the top of this function). So this
  // function must NOT set died=true here anymore; it only needs to leave
  // the stat itself at its extreme value (already done by applyStatDelta's
  // clamp to [0,100]) so the gatekeeper's own condition (e.g. spiritual=0)
  // evaluates true on the very next selectNextCard() call.
  let died = false;
  let deathReason: string | null = null;
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

  // decay lockturn counters (only numeric locks decay; 'reign' and 'del'
  // are both non-numeric sentinels that never tick down here)
  for (const [id, turns] of state.lockedCards) {
    if (turns === 'reign' || turns === 'del') continue;
    const next = turns - 1;
    if (next <= 0) state.lockedCards.delete(id);
    else state.lockedCards.set(id, next);
  }

  return { card, decision, died, deathReason, deathStoryText: null, unlockedObjectives: unlocked };
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
  /** Persists in-progress periodic Effects (see processActiveEffects) —
   * e.g. a plague mid-outbreak or a lover's fading faith must resume with
   * their correct remaining turnsLeft after the app is closed and
   * reopened, not silently reset. Previously activeEffects was never
   * populated at all (the bug this whole Effects system fixes), so there
   * was nothing real to lose by dropping it on save/load; now that it
   * holds live per-turn state, persisting it is required for "closing the
   * app mid-reign is safe" to actually hold for these effects too. */
  activeEffects: [string, { turnsLeft: number | null }][];
  lockedCards: [number, number | 'reign' | 'del'][];
  pendingNextCardId: number | null;
  pendingChainCardKey: string | null;
  pendingDuelKey: string | null;
  pendingDungeonKey: string | null;
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
    activeEffects: [...state.activeEffects.entries()],
    lockedCards: [...state.lockedCards.entries()],
    pendingNextCardId: state.pendingNextCardId,
    pendingChainCardKey: state.pendingChainCardKey,
    pendingDuelKey: state.pendingDuelKey,
    pendingDungeonKey: state.pendingDungeonKey,
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
    activeEffects: new Map(saved.activeEffects ?? []), // defaults to empty for saves made before this feature existed
    lockedCards: new Map(saved.lockedCards),
    pendingNextCardId: saved.pendingNextCardId,
    pendingChainCardKey: saved.pendingChainCardKey,
    pendingChainConditionOverride: null,
    pendingDuelKey: saved.pendingDuelKey,
    pendingDungeonKey: saved.pendingDungeonKey ?? null,
    turnCount: saved.turnCount,
    coins: saved.coins,
    isDead: saved.isDead,
    deathReason: saved.deathReason,
  };
}

/** Called when the simplified Dungeon mini-game screen (see types.ts's
 * pendingDungeonKey doc comment) finishes. On a win: applies the same
 * +30/+30/+30/+30 reward as the real maze's successful-exit card (#640) and
 * clears intheDungeon so the player can re-enter the dungeon story later.
 * On a loss: routes straight into the real end> card (#663,
 * end>dead_king_rat) via pendingNextCardId so the reign ends with its
 * correct authored death narrative instead of a generic message. */
export function resolveDungeonOutcome(state: GameState, kingWon: boolean) {
  state.pendingDungeonKey = null;
  if (kingWon) {
    for (const key of STAT_KEYS) {
      state.stats[key] = Math.max(0, Math.min(100, state.stats[key] + 30));
    }
    delete state.flags['intheDungeon'];
    state.pendingNextCardId = null;
    state.pendingChainCardKey = null;
  } else {
    state.pendingNextCardId = 663; // end>dead_king_rat — the maze's own real death outcome
    state.pendingChainCardKey = null;
  }
}

/** Called once a Duel mini-game finishes. Sets `duel_won` per the RE'd
 * `DuelAct.CheckDead()` rule (Engine Spec §9: king loses -> duel_won=-1,
 * king wins -> duel_won=1; conditions check `duel_won` as "> 0" and
 * `!duel_won` as "<= 0"), then hands off to the normal chain-card group so
 * the matching win/lose branch card (e.g. #588 vs #589) is drawn on the
 * next selectNextCard().
 *
 * IMPORTANT: this function must NOT touch nb_duelwon_keep itself. Confirmed
 * as a real double-counting bug via direct simulation: 7 of the 8 duel
 * groups' own WIN cards already increment nb_duelwon_keep+ in their own
 * yes/no custom tokens (per the data: #588 _duel_general, #378
 * _duel_nobleman, #388 _duel_lady, #664 _duel_skeleton, #687
 * _duel_cowprince, #758 _duel_foreign, #762 _duel_viking — only #318
 * _duel_painter's win card does NOT increment it, which is the data's own
 * deliberate choice, not a gap to "fix" here). This function previously
 * ALSO incremented nb_duelwon_keep on every win, on top of what the win
 * card's own custom already does — meaning card #587's gate
 * (nb_duelwon_keep<4 and dynasty>3) closed after just 2 real duel wins
 * instead of the intended 4, permanently locking the general-duel practice
 * card out twice as fast as designed. */
export function resolveDuelOutcome(state: GameState, kingWon: boolean) {
  state.counters['duel_won'] = kingWon ? 1 : -1;
  state.pendingChainCardKey = state.pendingDuelKey;
  state.pendingDuelKey = null;
}

export { CARDS, OBJECTIVES };
