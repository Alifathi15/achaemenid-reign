import React from 'react';

interface DungeonScreenProps {
  kingName: string;
  onFinished: (kingWon: boolean) => void;
}

/** Simplified Dungeon mini-game screen — per explicit product decision, the
 * real 48-card hand-authored maze (torch/key/trap/treasure/excalibur/devil
 * sub-chains) is out of scope right now. This just presents the player with
 * the maze's two real outcomes directly: escape (reward, per the maze's own
 * #640 "_exit_open" exit card) or perish to a trap (the maze's own real
 * end> death card, #663 "end>dead_king_rat") — see resolveDungeonOutcome in
 * gameEngine.ts for exactly what each button applies. */
export function DungeonScreen({ kingName, onFinished }: DungeonScreenProps) {
  return (
    <div
      style={{
        height: '100%', background: 'var(--brown)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24, padding: '40px 24px', textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 56 }}>🕯️</div>
      <div style={{ color: 'var(--ivory)', fontSize: 14, fontWeight: 700, opacity: 0.85 }}>{kingName}</div>
      <div style={{ color: 'var(--gold)', fontSize: 18, fontWeight: 700 }}>سیاه‌چالِ زیرِ کاخ</div>
      <div style={{ color: 'var(--ivory)', fontSize: 14, lineHeight: 1.8, opacity: 0.9, maxWidth: 300 }}>
        در تاریکیِ دخمه‌ها، تله‌ها و گنج در انتظارند. آیا زنده بیرون می‌آیید؟
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
        <button
          className="btn btn-primary"
          onClick={() => onFinished(true)}
          style={{ minWidth: 120, background: 'var(--olive)' }}
        >
          فرار موفق
        </button>
        <button
          className="btn"
          onClick={() => onFinished(false)}
          style={{ minWidth: 120, background: 'var(--oxide)', color: 'var(--ivory)' }}
        >
          گیر افتادن در تله
        </button>
      </div>
    </div>
  );
}
