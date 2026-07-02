/* ФРИДОМ — статический сайт + маленький бэкенд для формы обратной связи.
   Отдаёт файлы сайта и обслуживает POST /api/callback, который отправляет
   письмо с заявкой через Resend (https://resend.com). Никаких сторонних
   пакетов не требуется — используется встроенный fetch (Node >=18). */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 5599;

/* Подхватываем .env, если он есть рядом (на sweb удобнее положить .env,
   чем настраивать переменные окружения через панель). Значения, уже
   заданные в окружении, не перезаписываются. */
(function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) return;
    const key = m[1];
    let val = (m[2] || '').trim();
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  });
})();

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_TO = process.env.MAIL_TO || 'Saunerok@yandex.ru';
// onboarding@resend.dev работает без верификации домена, но письма с него
// иногда попадают в спам и «from» нельзя подменить на реальный адрес сайта.
// Как только домен подтверждён в Resend, замените MAIL_FROM в .env на
// что-то вроде "ФРИДОМ <заявки@ваш-домен.ru>".
const MAIL_FROM = process.env.MAIL_FROM || 'ФРИДОМ <onboarding@resend.dev>';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function sendCallbackEmail({ name, phone, topic, message }) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY не задан (см. .env.example)');
  }
  const html = `
    <h2>Новая заявка с сайта ФРИДОМ</h2>
    <p><b>Имя:</b> ${escapeHtml(name)}</p>
    <p><b>Телефон:</b> ${escapeHtml(phone)}</p>
    <p><b>Интересует:</b> ${escapeHtml(topic || '—')}</p>
    <p><b>Сообщение:</b><br>${escapeHtml(message || '—').replace(/\n/g, '<br>')}</p>
  `.trim();

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [MAIL_TO],
      subject: `Заявка с сайта ФРИДОМ: ${name}`,
      html
    })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Resend ответил ${resp.status}: ${errText}`);
  }
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > limit) { req.destroy(); reject(new Error('payload too large')); }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath));

  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/callback') {
    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw || '{}');
      const name = String(data.name || '').trim().slice(0, 120);
      const phone = String(data.phone || '').trim().slice(0, 40);
      const topic = String(data.topic || '').trim().slice(0, 120);
      const message = String(data.message || '').trim().slice(0, 2000);

      if (!name || phone.replace(/\D/g, '').length < 7) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: 'invalid_input' }));
      }

      await sendCallbackEmail({ name, phone, topic, message });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('[/api/callback]', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'send_failed' }));
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); return res.end('Method Not Allowed');
  }
  serveStatic(req, res);
}).listen(PORT, () => console.log(`ФРИДОМ → http://localhost:${PORT}/`));
