import React from 'react';

interface ProgressSummaryScreenProps {
  yearsRuled: number;
  decisionsCount: number;
  coinsEarned: number;
  newAchievementsCount: number;
  onContinue: () => void;
}

export function ProgressSummaryScreen({
  yearsRuled,
  decisionsCount,
  coinsEarned,
  newAchievementsCount,
  onContinue,
}: ProgressSummaryScreenProps) {
  const rows: [string, number][] = [
    ['سال‌های حکمرانی', yearsRuled],
    ['تصمیمات گرفته‌شده', decisionsCount],
    ['سکه‌های کسب‌شده', coinsEarned],
    ['دستاوردهای جدید', newAchievementsCount],
  ];

  return (
    <div style={{ padding: '32px 20px', height: '100%', background: 'var(--ivory)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ color: 'var(--brown)', fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
        خلاصه‌ی سلطنت
      </div>
      {rows.map(([label, value]) => (
        <div
          key={label}
          style={{
            background: '#fff', borderRadius: 14, padding: 16, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
          }}
        >
          <span style={{ color: 'var(--brown)', fontSize: 14 }}>{label}</span>
          <span style={{ color: 'var(--lapis)', fontWeight: 700, fontSize: 16 }}>{value.toLocaleString('fa-IR')}</span>
        </div>
      ))}
      <button className="btn btn-primary" style={{ marginTop: 'auto' }} onClick={onContinue}>
        ادامه
      </button>
    </div>
  );
}
