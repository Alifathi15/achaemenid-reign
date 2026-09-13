import React from 'react';

interface DeathScreenProps {
  ageAtDeath: number;
  yearsRuled: number;
  reason: string;
  onContinue: () => void;
}

const REASON_TEXT: Record<string, string> = {
  faith_zero: 'آتشکده‌ها خاموش شدند و کاهنان علیه تختِ بی‌ایمان شوریدند.',
  faith_max: 'قدرتِ کاهنان از خودِ شاه فراتر رفت و او را کنار زدند.',
  army_zero: 'ارتش از هم پاشید و دشمنان از مرزها گذشتند.',
  army_max: 'سرداران به قدرتی رسیدند که خود شاه را برانداختند.',
  people_zero: 'مردم از گرسنگی و ستم شوریدند و شاه را از تخت به زیر کشیدند.',
  people_max: 'آشوبِ عمومی، نظم دربار را از هم گسست.',
  treasury_zero: 'خزانه خالی شد و بازرگانان علیه تخت شوریدند.',
  treasury_max: 'انباشتِ بیش‌ازحدِ ثروت، حسادت رقیبان را برانگیخت.',
};

export function DeathScreen({ ageAtDeath, yearsRuled, reason, onContinue }: DeathScreenProps) {
  const story = REASON_TEXT[reason] ?? 'سلطنتِ او در سکوتِ تاریخ به پایان رسید.';
  return (
    <div
      style={{
        padding: '40px 24px', height: '100%', background: 'var(--brown)', color: 'var(--ivory)',
        textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20,
      }}
    >
      <div style={{ fontSize: 64 }}>☠</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--oxide)' }}>پایان یک سلطنت</div>
      <div style={{ fontSize: 15, lineHeight: 1.8, opacity: 0.9 }}>{story}</div>
      <div style={{ fontSize: 14, color: 'var(--gold)' }}>{yearsRuled} سال حکمرانی کرد (سنِ {ageAtDeath})</div>
      <button className="btn btn-primary" onClick={onContinue} style={{ marginTop: 20 }}>
        ادامه
      </button>
    </div>
  );
}
