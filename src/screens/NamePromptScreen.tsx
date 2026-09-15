import React, { useState } from 'react';

interface NamePromptScreenProps {
  onSubmit: (name: string) => void;
}

/** Shown once, before a tester's very first reign, so every death report
 * sent to Telegram (see telemetry/telegramReport.ts) can be attributed to
 * a real person instead of an anonymous log dump. Stored in the player's
 * profile (PlayerProfile.playerName) and never asked again on this
 * device. */
export function NamePromptScreen({ onSubmit }: NamePromptScreenProps) {
  const [name, setName] = useState('');

  return (
    <div style={{ padding: '40px 24px', height: '100%', background: 'var(--brown)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
      <div style={{ color: 'var(--gold)', fontSize: 22, fontWeight: 800, textAlign: 'center' }}>شاه شو</div>
      <div style={{ color: 'var(--ivory)', fontSize: 14, textAlign: 'center', opacity: 0.85, lineHeight: 1.8 }}>
        پیش از شروع، اسمت رو بنویس — این فقط برای شناساییِ گزارش‌های پلی‌تست استفاده می‌شه.
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="اسمت رو اینجا بنویس"
        autoFocus
        style={{
          background: 'var(--ivory)', border: 'none', borderRadius: 12, padding: '14px 16px',
          fontSize: 16, color: 'var(--brown)', textAlign: 'center',
        }}
      />
      <button
        className="btn btn-primary"
        disabled={!name.trim()}
        onClick={() => onSubmit(name.trim())}
        style={{ opacity: name.trim() ? 1 : 0.5 }}
      >
        ادامه
      </button>
    </div>
  );
}
