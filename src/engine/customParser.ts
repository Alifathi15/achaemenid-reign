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
  // IMPORTANT: capture the target name EXACTLY as written (including whether
  // it has a leading underscore or not) — do NOT force-add an underscore.
  // Real card_key values in the data are a MIX of underscore-prefixed
  // (e.g. "_duel_general", "_whois") and bare (e.g. "assasin2", "queen_quit",
  // "battleviking_keep") groups. The raw custom token always matches its
  // real target's exact spelling: ">_duel_general" targets card_key
  // "_duel_general", but ">>assasin2" targets card_key "assasin2" (NO
  // underscore) and ">queen_quit" targets card_key "queen_quit" (also no
  // underscore). The previous version always prepended "_" when the token
  // itself lacked one, silently rewriting ">>assasin2" into a lookup for
  // "_assasin2" — a card_key that doesn't exist anywhere in the 883-card
  // dataset. Confirmed as a REAL bug via simulation: card #66's "no" custom
  // "nb_murder+ and >>assasin2" was supposed to continue the murder-coverup
  // story into card #75 (card_key "assasin2"), but instead silently fell
  // through to the unrelated normal card pool every time, permanently
  // breaking that narrative branch (and 23 other cards affected the same
  // way: >inquisition2, >>>priestunhappy, >church, >>>>terror, >>>>assasin2,
  // >>>assasin2 (x2), >>>>deaf, >>>>pneumonia, >>>>victory_viking,
  // >lady_intro, >>>peacetreaty, >>>>warwithsouth, >>>>lady_1, >queen_quit,
  // >>>barbarian, >>>>>>battleviking_keep, >>>>bread1, >introfortune,
  // >>>>>>>>>bed, >>>>>plaguestart, >>>>battleviking_keep,
  // >>>>>startbarbare (x2), >>>>>>>revealbird, >>>>>>deathblack).
  const m = token.match(/^>+(_?\w+)$/);
  if (m) {
    return { kind: 'jump', targetKey: m[1] };
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
