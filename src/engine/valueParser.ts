/**
 * valueParser.ts — parses raw stat-delta cell values from the Cards/Effects
 * sheets, per the confirmed engine spec (Achaemenid_Engine_Spec.md §"?", "*", "lock").
 *
 * Rules (confirmed via disassembly of the original Reigns engine):
 *  1. Plain number string -> parse directly.
 *  2. Contains "lock" -> special LOCK marker (locks that stat until unlocked).
 *  3. Contains "?":
 *      - split on '?' removing empty entries
 *      - 1 piece left  -> use that number directly (the '?' had no numeric effect)
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
      const n = Number(pieces[0]);
      return Number.isFinite(n) ? { kind: 'number', value: n } : { kind: 'none' };
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
