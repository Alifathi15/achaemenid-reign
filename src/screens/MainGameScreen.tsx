import React, { useState } from 'react';
import type { CardRow, GameState, StatKey } from '../engine/types';
import { Icon } from '../components/Icons';

interface MainGameScreenProps {
  card: CardRow;
  state: GameState;
  onDecide: (decision: 'yes' | 'no') => void;
}

const STAT_META: Record<StatKey, { icon: string; label: string; color: string }> = {
  faith: { icon: 'flame', label: 'آتشکده', color: 'var(--gold)' },
  army: { icon: 'sword', label: 'ارتش', color: 'var(--oxide)' },
  people: { icon: 'people', label: 'مردم', color: 'var(--olive)' },
  treasury: { icon: 'vessel', label: 'خزانه', color: 'var(--lapis)' },
};

const DECIDE_THRESHOLD = 90;
const FADE_DISTANCE = 140; // px of drag needed to reach full opacity on the override text

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

  // Reigns-style override text: fades in above the card as you drag toward
  // that side. Right drag -> override_yes (green/olive). Left drag -> override_no (red/oxide).
  const yesOpacity = dragX > 0 ? Math.min(1, dragX / FADE_DISTANCE) : 0;
  const noOpacity = dragX < 0 ? Math.min(1, -dragX / FADE_DISTANCE) : 0;
  const questionOpacity = 1 - Math.max(yesOpacity, noOpacity);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--ivory)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '16px 12px 8px', background: 'var(--brown)' }}>
        {(Object.keys(STAT_META) as StatKey[]).map((key) => {
          const meta = STAT_META[key];
          const value = state.stats[key];
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 70 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={meta.icon} style={{ width: 17, height: 17, color: '#fff' }} />
              </div>
              <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${value}%`, background: meta.color, borderRadius: 3 }} />
              </div>
              <div style={{ color: 'var(--ivory)', fontSize: 10 }}>{meta.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px 8px', gap: 14 }}>
        {/* Text zone above the card: question by default, override_yes/no fade in while dragging (Reigns-style).
            DO NOT remove this block as "unused" — it is the core Reigns-style drag feedback the user asked for. */}
        <div style={{ position: 'relative', width: 320, minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brown)', fontSize: 15, lineHeight: 1.7, textAlign: 'center', fontWeight: 600,
              opacity: questionOpacity, transition: dragging ? 'none' : 'opacity .2s',
            }}
          >
            {card.question}
          </div>
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--olive)', fontSize: 18, lineHeight: 1.5, textAlign: 'center', fontWeight: 800,
              opacity: yesOpacity, transition: dragging ? 'none' : 'opacity .2s',
            }}
          >
            {card.overrideYes ?? ''}
          </div>
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--oxide)', fontSize: 18, lineHeight: 1.5, textAlign: 'center', fontWeight: 800,
              opacity: noOpacity, transition: dragging ? 'none' : 'opacity .2s',
            }}
          >
            {card.overrideNo ?? ''}
          </div>
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
          {/* directional tint overlay while dragging, like Reigns' green/red card wash */}
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
              background: 'var(--olive)', opacity: yesOpacity * 0.35,
            }}
          />
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
              background: 'var(--oxide)', opacity: noOpacity * 0.35,
            }}
          />
          <div style={{ flex: 1, background: 'var(--lapis)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ivory)', fontSize: 90 }}>
            👑
          </div>
          <div style={{ background: 'var(--sandstone)', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: 'var(--brown)', fontSize: 16 }}>{card.bearer ?? ''}</div>
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
