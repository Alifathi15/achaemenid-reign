import React, { useState } from 'react';
import type { CardRow, GameState, StatKey } from '../engine/types';
import bearersData from '../data/bearers.json';
import { parseRawValue } from '../engine/valueParser';

interface BearerRow {
  key: string;
  role: string;
  persianName: string;
}
const BEARERS = bearersData as BearerRow[];

/** Resolves a card's raw bearer key (e.g. "general", "diplomat>dark") to its
 * Persian display name from bearers.json. Variant suffixes (">dark", ">won")
 * fall back to the base bearer's name since bearers.json only lists base
 * roles. Unknown/empty bearer (e.g. "anyone") shows nothing rather than the
 * raw English key. */
function bearerDisplayName(bearer: string | null): string {
  if (!bearer || bearer === 'anyone') return '';
  const baseKey = bearer.split('>')[0];
  const found = BEARERS.find((b) => b.key === bearer) ?? BEARERS.find((b) => b.key === baseKey);
  return found?.persianName ?? bearer;
}

/** Card portrait image path for a bearer, or null if none should be tried
 * (falls back to the 👑 placeholder emoji). Drop PNG/JPG/WEBP files into
 * public/images/bearers/ named after the bearer key (">" replaced with "_",
 * e.g. "diplomat_dark.png" for bearer "diplomat>dark") and they show up
 * automatically — no code change needed. Exact-key file wins; if it's
 * missing, the base key before ">" is tried (so "diplomat.png" covers both
 * "diplomat" and "diplomat>dark" until a dedicated variant image exists).
 * Vite's `base: './'` config means these must be resolved via BASE_URL, not
 * a hardcoded leading slash, so the app still finds them when deployed under
 * a sub-path. */
function bearerImageCandidates(bearer: string | null): string[] {
  if (!bearer || bearer === 'anyone') return [];
  const base = import.meta.env.BASE_URL;
  const exactFile = bearer.replace(/>/g, '_');
  const baseKey = bearer.split('>')[0];
  const candidates = [exactFile];
  if (baseKey !== exactFile) candidates.push(baseKey);
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  const urls: string[] = [];
  for (const name of candidates) {
    for (const ext of exts) {
      urls.push(`${base}images/bearers/${name}.${ext}`);
    }
  }
  return urls;
}

/** Card portrait: tries each candidate image path in order (exact bearer key,
 * then base key, across a few extensions), falling back to the 👑 emoji
 * placeholder if none load. This is a real <img>, not a CSS background, so a
 * missing file fails silently per-candidate via onError instead of showing a
 * broken-image icon. */
function CardPortrait({ bearer }: { bearer: string | null }) {
  const candidates = React.useMemo(() => bearerImageCandidates(bearer), [bearer]);
  const [attemptIndex, setAttemptIndex] = useState(0);

  React.useEffect(() => {
    setAttemptIndex(0);
  }, [candidates]);

  if (attemptIndex >= candidates.length) {
    return <div style={{ position: 'relative', zIndex: 1 }}>👑</div>;
  }

  return (
    <img
      key={candidates[attemptIndex]}
      src={candidates[attemptIndex]}
      alt=""
      onError={() => setAttemptIndex((i) => i + 1)}
      style={{
        position: 'relative', zIndex: 1, width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: 'center',
      }}
    />
  );
}

interface MainGameScreenProps {
  card: CardRow;
  state: GameState;
  onDecide: (decision: 'yes' | 'no') => void;
}

const STAT_META: Record<StatKey, { image: string; label: string }> = {
  faith: { image: 'faith', label: 'آتشکده' },
  army: { image: 'army', label: 'ارتش' },
  people: { image: 'people', label: 'مردم' },
  treasury: { image: 'treasury', label: 'خزانه' },
};

const STAT_KEYS: StatKey[] = ['faith', 'army', 'people', 'treasury'];

const DECIDE_THRESHOLD = 90;
// distance of drag needed for the in-card Yes/No label + background tint + top-stat preview to reach full strength
const REVEAL_DISTANCE = 100;

/** Whether a stat-delta cell actually changes anything (a plain number, a
 * "lock", or a randomized range) — used ONLY to decide whether to show the
 * plain affected-dot, never its sign, per explicit user instruction that
 * the player must not be told positive vs negative. */
function cellIsAffected(raw: number | string | null | undefined): boolean {
  return parseRawValue(raw).kind !== 'none';
}
/** Per explicit user correction: NOT an up/down arrow, and the player must
 * NOT be told whether the effect is positive or negative — just a small
 * plain dot that says "this stat will be affected", exactly like real
 * Reigns (the 4 icons fill/drain but do not editorialize direction with an
 * extra glyph on top). Only the stat(s) the current drag-direction's
 * decision actually touches get this dot — untouched stats stay bare. */
function StatPreviewDot({ visible, opacity }: { visible: boolean; opacity: number }) {
  if (!visible || opacity <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
        width: 10, height: 10, borderRadius: '50%', background: 'var(--gold)',
        opacity, zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,.5)',
      }}
    />
  );
}

export function MainGameScreen({ card, state, onDecide }: MainGameScreenProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = React.useRef(0);

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    startXRef.current = e.clientX - dragX;
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDragX(e.clientX - startXRef.current);
  }
  function handlePointerUp() {
    setDragging(false);
    if (dragX > DECIDE_THRESHOLD) onDecide('yes');
    else if (dragX < -DECIDE_THRESHOLD) onDecide('no');
    setDragX(0);
  }

  const rotation = dragX / 20;

  // Confirmed from real Reigns screenshots (Wikipedia "Reigns_Gameplay.png"):
  // - The question text ABOVE the card stays fixed, does NOT fade or change.
  // - While dragging right, an in-card "Yes" label fades in at the TOP-LEFT
  //   corner of the card itself, and the card's portrait-background tint
  //   shifts toward yellow/olive. Dragging left mirrors this with "No" / red.
  const yesStrength = dragX > 0 ? Math.min(1, dragX / REVEAL_DISTANCE) : 0;
  const noStrength = dragX < 0 ? Math.min(1, -dragX / REVEAL_DISTANCE) : 0;
  const dragStrength = Math.max(yesStrength, noStrength);

  // Blend the portrait background from its base color toward the decision tint.
  const baseBg = 'var(--lapis)';
  const portraitBg =
    yesStrength > 0
      ? `linear-gradient(var(--olive), var(--olive))`
      : noStrength > 0
      ? `linear-gradient(var(--oxide), var(--oxide))`
      : baseBg;
  const portraitOpacityOverlay = Math.max(yesStrength, noStrength);

  // Which stats does the CURRENT drag direction's decision actually affect?
  // Only those get an arrow — the rest stay dim, matching the real game
  // (BirthMoviesDeath review: "4 little icons... fill or drain depending on
  // which way you swipe cards away" — only the relevant ones react).
  const activeDelta = yesStrength > 0 ? card.yes : noStrength > 0 ? card.no : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--ivory)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '16px 12px 8px', background: 'var(--brown)' }}>
        {STAT_KEYS.map((key) => {
          const meta = STAT_META[key];
          const value = state.stats[key];
          const affected = activeDelta ? cellIsAffected(activeDelta[key]) : false;
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 70 }}>
              {/* rounded-square navy icon box, matching the user's exact reference design
                  (upload_20260913_195609_3.png) — replaced the earlier circular badge. */}
              <div style={{ position: 'relative', width: 40, height: 40 }}>
                <StatPreviewDot visible={affected} opacity={dragStrength} />
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 10, background: 'var(--lapis)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: affected && dragStrength > 0 ? `0 0 0 ${2 * dragStrength}px rgba(255,255,255,${0.5 * dragStrength})` : 'none',
                    transition: dragging ? 'none' : 'box-shadow .2s',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}images/stats/${meta.image}.png`}
                    alt={meta.label}
                    style={{ width: 24, height: 24, objectFit: 'contain' }}
                  />
                </div>
              </div>
              <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${value}%`, background: 'var(--gold)', borderRadius: 3 }} />
              </div>
              <div style={{ color: 'var(--ivory)', fontSize: 10 }}>{meta.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px 8px', gap: 14 }}>
        {/* Question text: FIXED above the card, never fades or changes while dragging
            (confirmed from real Reigns screenshots — do not add fade logic here). */}
        <div style={{ color: 'var(--brown)', fontSize: 15, lineHeight: 1.7, textAlign: 'center', maxWidth: 320, fontWeight: 600 }}>
          {card.question}
        </div>

        <div
          style={{
            width: 320, height: 460, borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column',
            transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
            transition: dragging ? 'none' : 'transform .25s',
            touchAction: 'none', cursor: 'grab', position: 'relative',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div style={{ flex: 1, background: baseBg, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ivory)', fontSize: 90 }}>
            {/* card background tint shifts to the decision color, like real Reigns */}
            <div style={{ position: 'absolute', inset: 0, background: portraitBg, opacity: portraitOpacityOverlay }} />
            {/* in-card Yes/No label, top-left/right corner, fades in with drag
                distance. text-shadow added so the label stays legible over
                ANY portrait image regardless of its own colors/brightness —
                previously plain ivory text could vanish against a light
                background portrait with no way to read it while dragging. */}
            <div
              style={{
                position: 'absolute', top: 16, left: 16, zIndex: 3,
                color: 'var(--ivory)', fontSize: 22, fontWeight: 800,
                opacity: yesStrength,
                textShadow: '0 1px 3px rgba(0,0,0,.85), 0 0 8px rgba(0,0,0,.6)',
              }}
            >
              {card.overrideYes ?? 'بله'}
            </div>
            <div
              style={{
                position: 'absolute', top: 16, right: 16, zIndex: 3,
                color: 'var(--ivory)', fontSize: 22, fontWeight: 800,
                opacity: noStrength,
                textShadow: '0 1px 3px rgba(0,0,0,.85), 0 0 8px rgba(0,0,0,.6)',
              }}
            >
              {card.overrideNo ?? 'خیر'}
            </div>
            <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
              <CardPortrait bearer={card.bearer} />
            </div>
          </div>
          <div style={{ background: 'var(--sandstone)', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: 'var(--brown)', fontSize: 16 }}>{bearerDisplayName(card.bearer)}</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--brown)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: 'var(--gold)', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {state.age} سال در قدرت
          </div>
        </div>
      </div>
    </div>
  );
}
