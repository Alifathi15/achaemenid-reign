import React, { useState } from 'react';
import { Icon } from '../components/Icons';
import { createDuelState, resolveDuelRound, type DuelMove, type DuelState } from '../engine/duelEngine';

interface DuelScreenProps {
  kingName: string;
  opponentLabel: string;
  opponentKey: string;
  onFinished: (kingWon: boolean) => void;
}

const MOVE_META: { move: DuelMove; icon: string; label: string }[] = [
  { move: 'attack', icon: 'sword', label: 'حمله' },
  { move: 'defense', icon: 'shield', label: 'دفاع' },
  { move: 'feint', icon: 'spear', label: 'فینت' },
];

export function DuelScreen({ kingName, opponentLabel, opponentKey, onFinished }: DuelScreenProps) {
  const [duel, setDuel] = useState<DuelState>(() => createDuelState(opponentKey));
  const [lastLog, setLastLog] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleMove(move: DuelMove) {
    if (busy) return;
    setBusy(true);
    const result = resolveDuelRound(duel, move);
    setDuel({ ...duel });

    const logs: Record<typeof result.outcome, string> = {
      kingHits: 'ضربه به حریف وارد شد!',
      oppoHits: 'حریف ضربه زد!',
      clash: 'هر دو ضربه به هم برخورد کردند.',
    };
    setLastLog(logs[result.outcome]);

    if (result.duelOver) {
      setTimeout(() => onFinished(result.kingWon === true), 700);
    } else {
      setTimeout(() => setBusy(false), 400);
    }
  }

  const kingPips = Array.from({ length: 5 }, (_, i) => i < duel.kingLife);
  const oppoPips = Array.from({ length: 5 }, (_, i) => i < duel.oppoLife);

  return (
    <div style={{ height: '100%', background: 'var(--lapis)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'var(--ivory)', fontSize: 14, fontWeight: 700, opacity: 0.85 }}>{kingName}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {kingPips.map((alive, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: alive ? 'var(--oxide)' : 'rgba(255,255,255,.15)' }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '10px 24px' }}>
        <div style={{ width: '100%', height: 6, background: 'rgba(232,220,194,.2)', borderRadius: 3, position: 'relative' }}>
          <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
            دوئل با {opponentLabel}
          </div>
          <div style={{ position: 'absolute', top: '50%', left: '30%', transform: 'translate(-50%,-50%)', width: 52, height: 52, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, border: '2px solid var(--gold)', background: 'var(--brown)', color: 'var(--ivory)' }}>
            👑
          </div>
          <div style={{ position: 'absolute', top: '50%', left: '70%', transform: 'translate(-50%,-50%)', width: 52, height: 52, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, border: '2px solid var(--gold)', background: 'var(--oxide)', color: 'var(--ivory)' }}>
            ⚔
          </div>
          {lastLog && (
            <div style={{ position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)', color: 'var(--ivory)', fontSize: 12, opacity: 0.8, whiteSpace: 'nowrap' }}>
              {lastLog}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '20px 20px 12px', justifyContent: 'center' }}>
        {MOVE_META.map((m) => (
          <button
            key={m.move}
            disabled={busy}
            onClick={() => handleMove(m.move)}
            style={{
              flex: 1, maxWidth: 96, background: 'rgba(232,220,194,.1)', border: '1.5px solid rgba(196,154,58,.4)',
              borderRadius: 14, padding: '14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              color: 'var(--ivory)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
            }}
          >
            <Icon name={m.icon} style={{ width: 20, height: 20 }} />
            <div style={{ fontSize: 12 }}>{m.label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', padding: '0 20px 16px' }}>
        {oppoPips.map((alive, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: alive ? 'var(--oxide)' : 'rgba(255,255,255,.15)' }} />
        ))}
      </div>
    </div>
  );
}
