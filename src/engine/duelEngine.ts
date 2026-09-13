/**
 * duelEngine.ts — the Duel mini-game, per the RE'd `DuelAct` design (rail
 * combat, weighted-random opponent — the original learn-move persistence
 * from the real game is replaced with weighted-random AI, per project
 * decision). Simplified rock-paper-scissors cycle confirmed against the
 * data's own `_duelmove_attack/defense/special/super` flavor-text pools:
 *   Attack beats Feint, Feint beats Defense, Defense beats Attack.
 * 5 life units per side (matches RE'd FighterAct 5-stamina fields).
 */

export type DuelMove = 'attack' | 'defense' | 'feint';

export interface DuelState {
  /** the card_key of the win/lose branch group this duel resolves into,
   * e.g. '_duel_general' -> cards conditioned on duel_won / !duel_won. */
  opponentKey: string;
  kingLife: number;
  oppoLife: number;
}

const MOVES: DuelMove[] = ['attack', 'defense', 'feint'];

function beats(a: DuelMove, b: DuelMove): boolean {
  return (
    (a === 'attack' && b === 'feint') ||
    (a === 'feint' && b === 'defense') ||
    (a === 'defense' && b === 'attack')
  );
}

export function pickOpponentMove(): DuelMove {
  return MOVES[Math.floor(Math.random() * MOVES.length)];
}

export interface DuelRoundResult {
  kingMove: DuelMove;
  oppoMove: DuelMove;
  outcome: 'kingHits' | 'oppoHits' | 'clash';
  kingLife: number;
  oppoLife: number;
  duelOver: boolean;
  kingWon: boolean | null;
}

/** Mutates duel.kingLife/oppoLife in place and returns the round outcome. */
export function resolveDuelRound(duel: DuelState, kingMove: DuelMove): DuelRoundResult {
  const oppoMove = pickOpponentMove();
  let outcome: 'kingHits' | 'oppoHits' | 'clash';
  if (kingMove === oppoMove) {
    outcome = 'clash';
  } else if (beats(kingMove, oppoMove)) {
    outcome = 'kingHits';
    duel.oppoLife = Math.max(0, duel.oppoLife - 1);
  } else {
    outcome = 'oppoHits';
    duel.kingLife = Math.max(0, duel.kingLife - 1);
  }
  const duelOver = duel.kingLife <= 0 || duel.oppoLife <= 0;
  const kingWon = duelOver ? duel.oppoLife <= 0 : null;
  return {
    kingMove,
    oppoMove,
    outcome,
    kingLife: duel.kingLife,
    oppoLife: duel.oppoLife,
    duelOver,
    kingWon,
  };
}

export function createDuelState(opponentKey: string): DuelState {
  return { opponentKey, kingLife: 5, oppoLife: 5 };
}
