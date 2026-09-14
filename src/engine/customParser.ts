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
  steps?: number; // number of '>' chars for a bare 'next' directive
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

    // '!X' where X is NOT a comparison/negated-condition prefix (that
    // grammar belongs to conditionParser.ts, not here) — in the CUSTOM
    // grammar, a bare '!flag' token means "clear this flag", the inverse
    // of a bare 'flag' token setting it true. Confirmed necessary by real
    // data: card #710 (devil-chain climax) has custom
    // "!devil_visit and devil_curse_keep" — devil_visit must be cleared
    // (the visit is over) while devil_curse_keep is set true (the curse
    // begins) in the SAME token list. Previously this fell through to the
    // generic "bare flag" branch below, which set a flag literally named
    // "!devil_visit" to true instead of clearing "devil_visit" — meaning
    // conditions checking devil_visit later never saw it cleared, and any
    // future condition checking a negated custom-cleared flag would
    // silently misbehave the same way.
    //
    // MUST run BEFORE the "_keep" branch below, not after — confirmed as a
    // real bug via card #138 (_end_invasion group): its "no" custom is
    // literally "!fortification_keep". Since that token ALSO ends with
    // "_keep", the old ordering (the "_keep" check ran first) matched it
    // there first and set a flag literally named "!fortification_keep" to
    // true, leaving the real "fortification_keep" flag untouched — so
    // abandoning the fortifications never actually cleared them. Verified:
    // once fortification_keep is set, it could NEVER be cleared by ANY
    // card in the whole dataset (this is the only place that ever tries),
    // permanently trivializing every future military=0 crisis for that
    // save. Reordering fixes this without affecting the #710 case, since a
    // plain "X_keep" token (no leading '!') still falls through to the
    // "_keep" branch exactly as before.
    if (token.startsWith('!')) {
      delete state.flags[token.slice(1)];
      continue;
    }

    if (token.endsWith('_keep')) {
      state.flags[token] = true;
      continue;
    }

    // fallback: bare flag set true (covers things like isLover, isStone, etc.)
    state.flags[token] = true;
  }

  return result;
}
