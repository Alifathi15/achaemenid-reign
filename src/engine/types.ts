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
  lockturn: number | 'reign' | null;
  weight: number | null;
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
  pendingChainCardKey: string | null;
  pendingChainConditionOverride: string | null;
  turnCount: number;
  coins: number;
  isDead: boolean;
  deathReason: string | null;
}
