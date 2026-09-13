/**
 * Core type definitions for Achaemenid Reign.
 * Derived directly from Achaemenid_Engine_Spec.md — do not diverge.
 */

export interface StatDelta {
  faith: number | string | null;
  army: number | string | null;
  people: number | string | null;
  treasury: number | string | null;
  custom: string | null;
}

export interface CardRow {
  id: number;
  thematic: string | null;
  cardKey: string | null;
  bearer: string | null;
  conditions: string | null;
  lockturn: number | 'reign' | 'del' | null;
  weight: number | 'max' | null;
  question: string | null;
  overrideYes: string | null;
  overrideNo: string | null;
  answerYes: string | null;
  answerNo: string | null;
  yes: StatDelta;
  no: StatDelta;
}

export interface EffectRow {
  tag: string;
  title: string;
  length: number | null;
  faith: number | string | null;
  army: number | string | null;
  people: number | string | null;
  treasury: number | string | null;
  custom: string | null;
}

export interface ObjectiveRow {
  name: string;
  title: string;
  conditions: string | null;
  achievementText: string | null;
  description: string | null;
}

export interface BearerRow {
  key: string;
  role: string;
  persianName: string;
}

/** The four core stats — 0..100 scale, death at 0 or 100. */
export type StatKey = 'faith' | 'army' | 'people' | 'treasury';

export interface GameState {
  stats: Record<StatKey, number>;
  age: number;
  year: number;
  dynasty: number;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  activeBearers: Set<string>;
  activeEffects: Map<string, { turnsLeft: number | null }>;
  lockedCards: Map<number, number | 'reign'>; // cardId -> turns remaining or 'reign'
  /** Set by a bare `>`/`>>`/... directive: go straight to the card at this
   * exact id (current id + number of `>` chars), bypassing weight/conditions
   * entirely (Engine Spec §7 step 1, §8 worked example: id-sequential, NOT
   * same-card_key — a plain `>` frequently moves to a card with a DIFFERENT
   * card_key, e.g. #590 key=_fencinglesson -> #591 key=_). */
  pendingNextCardId: number | null;
  /** Set by a `>_X` / `>X` directive: jump to the chain-start group whose
   * card_key equals this value; the specific card within that group is then
   * chosen by weighted-random among the ones whose `conditions` currently
   * hold (Engine Spec §8: #587 -> `_duel_general` group -> #588 vs #589
   * disambiguated by the `duel_won` condition). */
  pendingChainCardKey: string | null;
  pendingChainConditionOverride: string | null;
  turnCount: number;
  coins: number;
  isDead: boolean;
  deathReason: string | null;
}
