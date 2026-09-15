import React, { useState } from 'react';

interface FeedbackScreenProps {
  onSubmit: (feedback: string) => void;
}

/** Shown once per reign, right after the death screen and before the
 * progress summary. Lets a playtester report bugs/notes about what they
 * just experienced in their own words — sent to the developer's Telegram
 * alongside the reign's card-draw log (see telemetry/telegramReport.ts),
 * so a bug report always comes with the exact sequence of cards that
 * produced it. "مشکلی نداشتم" is a one-tap skip for the common case. */
export function FeedbackScreen({ onSubmit }: FeedbackScreenProps) {
  const [text, setText] = useState('');

  return (
    <div style={{ padding: '32px 20px', height: '100%', background: 'var(--ivory)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ color: 'var(--brown)', fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
        نظرت درباره‌ی این سلطنت؟
      </div>
      <div style={{ color: 'var(--brown)', fontSize: 13, textAlign: 'center', opacity: 0.7, lineHeight: 1.7 }}>
        اگه باگی دیدی، کارتی عجیب بود، یا هر نکته‌ای داشتی، همینجا بنویس — همراهِ لاگِ این سلطنت برای توسعه‌دهنده فرستاده می‌شه.
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="مثلاً: کارتِ فلان بدون زمینه اومد، یا هرچیزِ دیگه..."
        style={{
          flex: 1, minHeight: 160, fontSize: 15, padding: 14, borderRadius: 12,
          border: '1px solid rgba(58,45,35,.2)', resize: 'vertical',
          color: 'var(--brown)', background: '#fff', fontFamily: 'inherit',
        }}
      />

      <button className="btn btn-primary" onClick={() => onSubmit(text.trim())}>
        {text.trim() ? 'ارسالِ نظر و ادامه' : 'مشکلی نداشتم'}
      </button>
    </div>
  );
}
