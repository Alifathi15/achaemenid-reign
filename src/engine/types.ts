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
  lockedCards: Map<number, number | 'reign' | 'del'>; // cardId -> turns remaining, 'reign' (reopens for the heir), or 'del' (locked forever, dynasty-wide)
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
  /** Set when a chain jump target is a real duel-mechanic group (card_key
   * starts with "_duel_", e.g. "_duel_general") rather than a plain story
   * chain. While this is set, the UI must run the actual Duel mini-game
   * (duelEngine.ts) instead of drawing a normal card — resolving it sets
   * counters.duel_won and then falls through to pendingChainCardKey so the
   * matching win/lose branch card is drawn normally. Previously this was
   * skipped entirely: !duel_won defaulted to always-true (counter never
   * set), so duel-conditioned cards always silently took the "lost" branch
   * and the player never actually got to fight. */
  pendingDuelKey: string | null;
  /** Set when a chain jump target is the dungeon mini-game's entry group
   * (card_key "_dungeon1", e.g. reached via #607 "enterthedonjon"'s
   * yes_custom ">_dungeon1 and intheDungeon and !spice_trade_keep"). The
   * REAL dungeon content is a 48-card hand-authored maze (torch/key/trap/
   * treasure/excalibur/devil-encounter sub-chains) that is out of scope to
   * fully implement right now — per explicit product decision, this is
   * simplified to a single win/lose choice screen (DungeonScreen) instead
   * of the full maze, mirroring how pendingDuelKey short-circuits the
   * equally complex real duel content. Win -> same +30/+30/+30/+30 reward
   * as the real maze's successful-exit card (#640 "_exit_open", dungeon>
   * open_exit), clears intheDungeon, returns to the normal pool. Lose ->
   * jumps straight to the real end> card #663 "end>dead_king_rat" (the
   * maze's own actual death outcome, e.g. reached via #661/#662's
   * ">_end_dungeon" chain after a lethal trap), so the reign still ends
   * with its correct authored narrative instead of a generic message. */
  pendingDungeonKey: string | null;
  turnCount: number;
  coins: number;
  isDead: boolean;
  deathReason: string | null;
}
