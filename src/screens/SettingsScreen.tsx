import React from 'react';

interface SettingsScreenProps {
  soundEnabled: boolean;
  musicEnabled: boolean;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onBack: () => void;
  onResetToFirstCard: () => void;
}

export function SettingsScreen({ soundEnabled, musicEnabled, onToggleSound, onToggleMusic, onBack, onResetToFirstCard }: SettingsScreenProps) {
  return (
    <div style={{ padding: '32px 20px', height: '100%', background: 'var(--ivory)', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
