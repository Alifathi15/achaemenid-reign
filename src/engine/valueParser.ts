/**
 * valueParser.ts — parses raw stat-delta cell values from the Cards/Effects
 * sheets, per ENGINE_SPEC.md (confirmed via ARM64/Capstone disassembly of
 * the original Reigns IL2CPP binary, absalan_reversed_data.tar.gz).
 *
 * Rules (confirmed via disassembly of the original Reigns engine):
 *  1. Plain number string -> parse directly.
 *  2. Contains "lock" -> special LOCK marker (locks that stat until unlocked).
 *  3. Contains "?":
 *      - split on '?' removing empty entries
 *      - 1 piece left  -> RandInt(0, N) — single-sided '?' means "random
 *        between 0 and N", NOT "N with no random effect". Confirmed by
 *        ENGINE_SPEC.md §3: Outcome.ctor(string,string,bool) checks for '?',
 *        splits both sides, calls the native RandInt(min,max) either way —
 *        there is no code path where a lone '?' is a no-op. A previous
 *        reading of this project treated 1-piece '?' as inert; that was an
 *        unconfirmed guess and is now corrected against the real binary.
 *      - 2 pieces left -> RandInt(min, max) inclusive, re-rolled every time this
 *                          value is evaluated
 *  4. Contains "*" -> use only the piece BEFORE '*' as the number; '*' is a
 *     purely cosmetic "moving icon" UI flag with zero effect on game logic.
 */

export type ParsedValue =
  | { kind: 'number'; value: number }
  | { kind: 'lock' }
  | { kind: 'random'; min: number; max: number }
  | { kind: 'none' };

function randInt(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

export function parseRawValue(raw: number | string | null | undefined): ParsedValue {
  if (raw === null || raw === undefined || raw === '') return { kind: 'none' };
  if (typeof raw === 'number') return { kind: 'number', value: raw };

  const s = raw.trim();
  if (s === '') return { kind: 'none' };

  if (s.toLowerCase().includes('lock')) {
    return { kind: 'lock' };
  }

  if (s.includes('*')) {
    const before = s.split('*')[0].trim();
    const n = Number(before);
    return Number.isFinite(n) ? { kind: 'number', value: n } : { kind: 'none' };
  }

  if (s.includes('?')) {
    const pieces = s.split('?').filter((p) => p !== '');
    if (pieces.length === 1) {
      // single-sided '?' (either "N?" or "?N") -> RandInt(0, N), confirmed
      // ground truth from the decompiled Outcome constructor.
      const n = Number(pieces[0]);
      return Number.isFinite(n) ? { kind: 'random', min: 0, max: n } : { kind: 'none' };
    }
    if (pieces.length >= 2) {
      const a = Number(pieces[0]);
      const b = Number(pieces[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return { kind: 'random', min: a, max: b };
      }
    }
    return { kind: 'none' };
  }

  const n = Number(s);
  return Number.isFinite(n) ? { kind: 'number', value: n } : { kind: 'none' };
}


/** Resolves a ParsedValue to a concrete number to apply right now (re-rolls randoms). */
export function resolveValue(parsed: ParsedValue): number | 'lock' | null {
  switch (parsed.kind) {
    case 'number':
      return parsed.value;
    case 'random':
      return randInt(parsed.min, parsed.max);
    case 'lock':
      return 'lock';
    case 'none':
      return null;
  }
}

/** Sign of a stat-delta cell for UI preview purposes ONLY — e.g. showing an
 * up/down arrow on the affected stat while the player drags a card, before
 * the decision is actually committed. Does NOT re-roll or consume a random
 * value (that must stay a pure side-effect of resolveValue at decision time,
 * or every render while dragging would burn a different roll). For a
 * `RandInt(min,max)` cell, sign is taken from the midpoint of the range: if
 * the range straddles zero (min<0<max) the preview is 'mixed' rather than
 * falsely claiming a clean up or down. */
export type StatPreviewSign = 'up' | 'down' | 'mixed' | 'lock' | 'none';

export function previewSign(raw: number | string | null | undefined): StatPreviewSign {
  const parsed = parseRawValue(raw);
  switch (parsed.kind) {
    case 'lock':
      return 'lock';
    case 'none':
      return 'none';
    case 'number':
      if (parsed.value > 0) return 'up';
      if (parsed.value < 0) return 'down';
      return 'none';
    case 'random': {
      const mid = (parsed.min + parsed.max) / 2;
      if (parsed.min < 0 && parsed.max > 0) return 'mixed';
      return mid > 0 ? 'up' : mid < 0 ? 'down' : 'none';
    }
  }
}
