import React, { useState } from 'react';
import { exportCardDrawLogText, clearCardDrawLog } from '../engine/gameEngine';

interface SettingsScreenProps {
  soundEnabled: boolean;
  musicEnabled: boolean;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onBack: () => void;
  onResetToFirstCard: () => void;
}

export function SettingsScreen({ soundEnabled, musicEnabled, onToggleSound, onToggleMusic, onBack, onResetToFirstCard }: SettingsScreenProps) {
  const [logText, setLogText] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  function handleShowLog() {
    setLogText(exportCardDrawLogText());
    setCopyStatus('idle');
  }

  async function handleCopyLog() {
    if (!logText) return;
    try {
      await navigator.clipboard.writeText(logText);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <div style={{ padding: '32px 20px', height: '100%', background: 'var(--ivory)', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
      <div style={{ color: 'var(--brown)', fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>تنظیمات</div>

      <Row label="موسیقی" active={musicEnabled} onToggle={onToggleMusic} />
      <Row label="افکت‌های صوتی" active={soundEnabled} onToggle={onToggleSound} />

      <div style={{ background: '#fff', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--brown)', fontSize: 15 }}>زبان</span>
        <span style={{ color: 'var(--brown)', fontSize: 15 }}>فارسی</span>
      </div>

      {/* Debug/QA: lets a tester jump straight to the game's very first
          tutorial card at any time, without deleting the app's storage. */}
      <button
        className="btn btn-secondary"
        onClick={onResetToFirstCard}
        style={{ borderColor: 'var(--lapis)', color: 'var(--lapis)' }}
      >
        دیدنِ کارتِ شروعِ بازی (ریست به سلطنتِ اول)
      </button>

      {/* Debug/QA: dumps every card drawn this session (id, chain key,
          conditions, how it was reached: tutorial/gatekeeper/chain/pool,
          and the player's yes/no answer) so a tester can hand the exact
          sequence back for engine debugging. In-memory only — clears on
          page reload, never sent anywhere automatically. */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ color: 'var(--brown)', fontSize: 15, fontWeight: 700 }}>لاگِ کارت‌های این نشست (برای دیباگ)</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleShowLog}>
            نمایشِ لاگ
          </button>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, borderColor: 'var(--oxide)', color: 'var(--oxide)' }}
            onClick={() => {
              clearCardDrawLog();
              setLogText(null);
              setCopyStatus('idle');
            }}
          >
            پاک‌کردنِ لاگ
          </button>
        </div>
        {logText !== null && (
          <>
            <textarea
              readOnly
              value={logText}
              dir="ltr"
              style={{
                width: '100%', minHeight: 220, fontSize: 11, fontFamily: 'monospace',
                padding: 8, borderRadius: 8, border: '1px solid rgba(58,45,35,.2)',
                resize: 'vertical', color: 'var(--brown)', background: 'var(--ivory)',
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button className="btn btn-primary" onClick={handleCopyLog}>
              {copyStatus === 'copied' ? 'کپی شد ✓' : copyStatus === 'failed' ? 'کپیِ خودکار ناموفق بود — دستی کپی کن' : 'کپیِ لاگ'}
            </button>
          </>
        )}
      </div>

      <button className="btn btn-secondary" style={{ marginTop: 'auto' }} onClick={onBack}>
        بازگشت
      </button>
    </div>
  );
}

function Row({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: '#fff', border: 'none', borderRadius: 12, padding: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
      }}
    >
      <span style={{ color: 'var(--brown)', fontSize: 15 }}>{label}</span>
      <span
        style={{
          width: 44, height: 24, borderRadius: 12, position: 'relative',
          background: active ? 'var(--olive)' : '#c9c1ac', transition: 'background .15s',
        }}
      >
        <span
          style={{
            content: '""', width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute',
            top: 3, right: active ? 3 : 23, transition: 'right .15s',
          }}
        />
      </span>
    </button>
  );
}
