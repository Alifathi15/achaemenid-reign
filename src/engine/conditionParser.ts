/**
 * conditionParser.ts — evaluates the `conditions` boolean-formula grammar
 * (Achaemenid_Engine_Spec.md §3):
 *   - `and` joins terms
 *   - `!X` negation
 *   - `X>N`, `X<N`, `X=N` numeric comparisons
 *   - bare flag name -> must be true
 *
 * Variables resolvable from GameState: age, dynasty, year,
 * faith/army/people/treasury (+ aliases), X_keep flags, nb_X_keep counters,
 * has_X bearer presence, duel_won (>0 = won), and any other counter/flag.
 */
import type { GameState } from './types';

function getVariableValue(state: GameState, name: string): number {
  switch (name) {
    case 'age':
      return state.age;
    case 'dynasty':
      return state.dynasty;
    case 'year':
      return state.year;
    case 'faith':
    case 'spiritual':
      return state.stats.faith;
    case 'army':
    case 'military':
      return state.stats.army;
    case 'people':
    case 'demography':
      return state.stats.people;
    case 'treasury':
    case 'treasure':
      return state.stats.treasury;
    // INFERRED, not confirmed from any spec/RE source: "overall" appears in
    // 4 card conditions (e.g. #152 end>dead_king_classic "overall>40", #163
    // end>dead_king_dogs "overall<30") with no definition anywhere in the
    // GDD, engine spec, or decompiled code. Interpreted as the simple mean
    // of the 4 core stats (0-100 scale, consistent with every other stat
    // comparison in the data) — the only reading that keeps these cards'
    // thresholds in the same 0-100 range as every other numeric condition
    // in the file. Flagged here as an inference so it's easy to find and
    // correct if a more authoritative source ever surfaces.
    case 'overall':
      return (state.stats.faith + state.stats.army + state.stats.people + state.stats.treasury) / 4;
    default:
      if (name.startsWith('has_')) {
        const bearer = name.slice(4);
        return state.activeBearers.has(bearer) ? 1 : 0;
      }
      if (name in state.counters) return state.counters[name];
      if (name in state.flags) return state.flags[name] ? 1 : 0;
      return 0;
  }
}

function evalTerm(state: GameState, rawTerm: string): boolean {
  let term = rawTerm.trim();
  if (term === '') return true;

  let negate = false;
  if (term.startsWith('!')) {
    negate = true;
    term = term.slice(1).trim();
  }

  const cmpMatch = term.match(/^([a-zA-Z_][\w]*)\s*(>=|<=|>|<|=)\s*(-?\d+(\.\d+)?)$/);
  let result: boolean;
  if (cmpMatch) {
    const [, varName, op, numStr] = cmpMatch;
    const varVal = getVariableValue(state, varName);
    const num = Number(numStr);
    switch (op) {
      case '>':
        result = varVal > num;
        break;
      case '<':
        result = varVal < num;
        break;
      case '>=':
        result = varVal >= num;
        break;
      case '<=':
        result = varVal <= num;
        break;
      case '=':
        result = varVal === num;
        break;
      default:
        result = false;
    }
  } else {
    // bare flag name -> must be true (flags map, or nb_/has_ resolved as >0)
    if (term in state.flags) {
      result = state.flags[term];
    } else if (term in state.counters) {
      result = state.counters[term] > 0;
    } else if (term.startsWith('has_')) {
      result = state.activeBearers.has(term.slice(4));
    } else if (term === 'duel_won') {
      result = (state.counters['duel_won'] ?? 0) > 0;
    } else {
      result = false;
    }
  }

  return negate ? !result : result;
}

export function evaluateConditions(state: GameState, conditions: string | null): boolean {
  if (!conditions || conditions.trim() === '') return true;
  const terms = conditions.split(/\s+and\s+/i);
  return terms.every((t) => evalTerm(state, t));
}
