/**
 * customParser.ts — parses and applies the `yes_custom` / `no_custom` grammar
 * (Achaemenid_Engine_Spec.md §4). Splits on `and`, interprets each token:
 *
 *   X_keep         -> set flag X = true
 *   nb_X_keep+     -> counter nb_X_keep += (count of '+' chars)
 *   nb_X_keep-     -> counter nb_X_keep -= 1
 *   add_X          -> bearer X joins the active court
 *   del_X          -> bearer X leaves the active court
 *   special_X      -> dispatch to a registered special-effect handler
 *   >              -> next card in the same chain (card_key)
 *   >_X / >X       -> jump to chain group with card_key = "_X"
 *   >>, >>>, ...   -> jump N steps forward in the same chain
 */
import type { GameState } from './types';

export interface ChainDirective {
  kind: 'next' | 'jump';
  steps?: number;
  targetKey?: string;
}

export interface CustomApplyResult {
  chain: ChainDirective | null;
  specials: string[];
}

type SpecialHandler = (state: GameState, tag: string) => void;
const specialHandlers = new Map<string, SpecialHandler>();

export function registerSpecialHandler(tag: string, handler: SpecialHandler) {
  specialHandlers.set(tag, handler);
}

function applyPlusMinusCounter(state: GameState, token: string): boolean {
  // matches nb_X_keep+, nb_X++, nb_X_keep-, etc.
  const m = token.match(/^(nb_[\w]+)(\++|-+)$/);
  if (!m) return false;
  const [, name, ops] = m;
  const cur = state.counters[name] ?? 0;
  if (ops[0] === '+') {
    state.counters[name] = cur + ops.length;
  } else {
    state.counters[name] = cur - ops.length;
  }
  return true;
}

function parseChainToken(token: string): ChainDirective | null {
  if (/^>+$/.test(token)) {
    return { kind: 'next', steps: token.length };
  }
  const m = token.match(/^>+_?(\w+)$/);
  if (m) {
    const key = m[1].startsWith('_') ? m[1] : `_${m[1]}`;
    return { kind: 'jump', targetKey: key };
  }
  return null;
}

export function applyCustom(state: GameState, custom: string | null | undefined): CustomApplyResult {
  const result: CustomApplyResult = { chain: null, specials: [] };
  if (!custom || custom.trim() === '') return result;

  const tokens = custom.split(/\s+and\s+/i).map((t) => t.trim()).filter(Boolean);

  for (const token of tokens) {
    // chain directives
    if (token.startsWith('>')) {
      const chain = parseChainToken(token);
      if (chain) {
        result.chain = chain;
        continue;
      }
    }

    if (token.startsWith('special_')) {
      result.specials.push(token);
      const handler = specialHandlers.get(token);
      if (handler) handler(state, token);
      continue;
    }

    if (token.startsWith('add_')) {
      state.activeBearers.add(token.slice(4));
      continue;
    }

    if (token.startsWith('del_')) {
      state.activeBearers.delete(token.slice(4));
      continue;
    }

    if (applyPlusMinusCounter(state, token)) continue;

    if (token.endsWith('_keep')) {
      state.flags[token] = true;
      continue;
    }

    // fallback: bare flag set true (covers things like isLover, isStone, etc.)
    state.flags[token] = true;
  }

  return result;
}
