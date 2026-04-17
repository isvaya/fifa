/**
 * Принимает JSON с полями как у формы заказа на сайте (FIFA),
 * шлёт уведомление в Telegram. Фронт в FIFA/ не меняем — позже можно
 * заменить URL отправки формы на этот сервис (или дублировать с Formspree).
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const PORT = Number(process.env.PORT) || 8787;
const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

const rawOrigins = process.env.ALLOWED_ORIGINS;
const allowList = rawOrigins
  ? rawOrigins.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function corsOptions() {
  if (!allowList?.length) {
    return { origin: true };
  }
  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowList.includes(origin)) return cb(null, true);
      cb(null, false);
    },
  };
}

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(cors(corsOptions()));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/order', async (req, res) => {
  if (!BOT || !CHAT) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing' });
  }

  const body = req.body || {};
  if (body._gotcha) {
    return res.status(200).json({ ok: true });
  }

  const name = String(body.name || '').trim();
  const fullName = String(body.full_name || body.fullName || '').trim();
  const whatsapp = String(body.whatsapp || '').trim();
  const email = String(body.email || '').trim();
  const comments = String(body.comments || '').trim() || '—';

  if (!name || !fullName || !whatsapp || !email) {
    return res.status(400).json({ error: 'Missing required fields: name, full_name, whatsapp, email' });
  }

  const lines = [
    '<b>Website order — J.Steffany / FIFA</b>',
    '',
    `<b>Name:</b> ${escapeHtml(name)}`,
    `<b>Full name:</b> ${escapeHtml(fullName)}`,
    `<b>WhatsApp:</b> ${escapeHtml(whatsapp)}`,
    `<b>E-mail:</b> ${escapeHtml(email)}`,
    '',
    `<b>Comments:</b>`,
    escapeHtml(comments),
  ];
  const text = lines.join('\n');

  const url = `https://api.telegram.org/bot${encodeURIComponent(BOT)}/sendMessage`;
  try {
    const tgRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || !data.ok) {
      console.error('[telegram]', data);
      return res.status(502).json({ error: data.description || 'Telegram send failed' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Telegram request failed' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Form → Telegram on 0.0.0.0:${PORT}  POST /api/order  GET /health`);
});
