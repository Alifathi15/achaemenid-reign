/**
 * telegramReport.ts — sends the current session's card-draw debug log to a
 * fixed Telegram chat via the Bot API's sendMessage/sendDocument endpoints,
 * directly from the browser (no backend needed — Telegram's Bot API
 * accepts plain HTTPS POSTs with CORS enabled). Used to collect playtest
 * data: every death, the developer gets the log + which tester played it.
 *
 * SECURITY NOTE: the bot token below is embedded in the client-side JS
 * bundle, which means anyone who opens devtools can read it and could
 * technically send messages as this bot to the same chat (spam risk, not
 * a data-access risk — the bot can only post into chats it's already been
 * added to / that started a conversation with it). Acceptable for an
 * internal playtest build; if this app is ever distributed more broadly,
 * move the token behind a real backend endpoint instead.
 */
import { exportCardDrawLogText } from '../engine/gameEngine';

const BOT_TOKEN = '8954059553:AAEtulw44XOlyg0rIf2d7ewH9Y4Fb2Wn__c';
const CHAT_ID = '101289544';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/** Telegram's sendMessage has a 4096-character text limit — the card-draw
 * log for a long reign can easily exceed that, so long logs are sent as a
 * .txt document attachment instead of inline text. Short logs stay inline
 * (faster to read on a phone without opening a file). */
const INLINE_TEXT_LIMIT = 3500;

interface DeathReportInfo {
  playerName: string;
  dynastyIndex: number;
  kingName: string;
  ageAtDeath: number;
  deathReason: string;
  /** Free-text note the tester typed on FeedbackScreen right after death —
   * empty string means they tapped "مشکلی نداشتم" (no issue) with nothing
   * written. Always included in the report so a bug note always travels
   * with the exact card sequence that produced it. */
  feedback: string;
}

function buildHeader(info: DeathReportInfo): string {
  const lines = [
    `مرگِ یک سلطنت — گزارشِ پلی‌تست`,
    `بازیکن: ${info.playerName || '(بدون نام)'}`,
    `پادشاه: ${info.kingName} (دودمانِ ${info.dynastyIndex})`,
    `سنِ مرگ: ${info.ageAtDeath}`,
    `دلیلِ مرگ: ${info.deathReason}`,
  ];
  if (info.feedback) {
    lines.push('', `نظرِ بازیکن: ${info.feedback}`);
  } else {
    lines.push('', 'نظرِ بازیکن: (مشکلی گزارش نشد)');
  }
  return lines.join('\n');
}

async function sendTelegramMessage(text: string): Promise<void> {
  await fetch(`${API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
}

async function sendTelegramDocument(filename: string, content: string, caption: string): Promise<void> {
  const form = new FormData();
  form.append('chat_id', CHAT_ID);
  form.append('caption', caption);
  form.append('document', new Blob([content], { type: 'text/plain;charset=utf-8' }), filename);
  await fetch(`${API_BASE}/sendDocument`, { method: 'POST', body: form });
}

/** Fire-and-forget: sends the header + full card-draw log for this reign
 * to the fixed Telegram chat. Never throws — a playtester's game must
 * never crash or get stuck because a network request to Telegram failed
 * (offline device, blocked API, etc). Errors are only logged to the
 * console for local debugging. Call this right after a reign ends
 * (isDead becomes true), before the log is potentially cleared. */
export async function sendDeathReportToTelegram(info: DeathReportInfo): Promise<void> {
  try {
    const header = buildHeader(info);
    const logText = exportCardDrawLogText();
    const combined = `${header}\n\n${logText}`;

    if (combined.length <= INLINE_TEXT_LIMIT) {
      await sendTelegramMessage(combined);
    } else {
      await sendTelegramMessage(header + '\n\n(لاگِ کامل به‌صورتِ فایل پیوست شد)');
      const filename = `log_${(info.playerName || 'unknown').replace(/\s+/g, '_')}_dynasty${info.dynastyIndex}_${Date.now()}.txt`;
      await sendTelegramDocument(filename, logText, `لاگِ کاملِ ${info.playerName || '(بدون نام)'} — دودمانِ ${info.dynastyIndex}`);
    }
  } catch (err) {
    // Deliberately swallowed — see doc comment above. Still log for anyone
    // debugging with devtools open during a local playtest session.
    console.error('sendDeathReportToTelegram failed:', err);
  }
}
