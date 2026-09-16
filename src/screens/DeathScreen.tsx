import React from 'react';

interface DeathScreenProps {
  ageAtDeath: number;
  yearsRuled: number;
  reason: string;
  /** The dying card's own `question` text (see gameEngine.ts's
   * TurnResult.deathStoryText doc comment) — passed through for the 42
   * real narrative endings (bearer="end>..."), so the death screen shows
   * the SAME specific story the game already authored for that exact
   * ending (e.g. "آتشکده صلاح دید که یه شهید تر و تمیز ازت درمیاد؛ واسه
   * همین تیکه‌پاره‌ت کردن!") instead of always falling back to one of the
   * 8 generic REASON_TEXT lines below. null for the 8 pure stat-threshold
   * deaths, which have no card of their own — REASON_TEXT still covers
   * those exactly as before. */
  storyText: string | null;
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

/** Card question text sometimes wraps its narration in `<i>...</i>` (a
 * markup convention used for whispered/omniscient-narrator lines, e.g.
 * card #135 "<i>قصد جونت رو کردن!...</i>") — meaningful while dragging the
 * card mid-game, but the death screen has its own dedicated presentation,
 * so the raw tags are stripped rather than rendered literally. */
function stripItalicMarkup(text: string): string {
  return text.replace(/<i>/g, '').replace(/<\/i>/g, '').trim();
}

export function DeathScreen({ ageAtDeath, yearsRuled, reason, storyText, onContinue }: DeathScreenProps) {
  const story = storyText ? stripItalicMarkup(storyText) : REASON_TEXT[reason] ?? 'سلطنتِ او در سکوتِ تاریخ به پایان رسید.';
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
