import { generateToken } from './crypto.js';
import { sendMagicLink } from './email.js';

const MAGIC_TTL_SEC = 10 * 60;
const SESSION_TTL_SEC = 90 * 24 * 60 * 60;
const RATE_LIMIT_TTL_SEC = 60 * 60;
const RATE_LIMIT_MAX = 5;

function allowedEmails(env) {
  return new Set(
    String(env.ALLOWED_EMAILS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function buildMagicLink(env, token) {
  const base = env.SITE_URL || '';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}magic=${encodeURIComponent(token)}`;
}

export async function handleRequestLink(req, env) {
  let body;
  try { body = await req.json(); } catch { return noContent(); }
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) return noContent();
  if (!allowedEmails(env).has(email)) return noContent();

  const rateKey = `ratelimit:request:${email}`;
  const cur = parseInt((await env.BOOKMARKS_KV.get(rateKey)) || '0', 10);
  if (cur >= RATE_LIMIT_MAX) return noContent();
  await env.BOOKMARKS_KV.put(rateKey, String(cur + 1), { expirationTtl: RATE_LIMIT_TTL_SEC });

  const token = generateToken();
  await env.BOOKMARKS_KV.put(
    `magic:${token}`,
    JSON.stringify({ email, createdAt: Date.now() }),
    { expirationTtl: MAGIC_TTL_SEC },
  );

  try {
    await sendMagicLink(env, { to: email, link: buildMagicLink(env, token) });
  } catch (err) {
    console.error('email send failed', err);
  }
  return noContent();
}

export async function handleVerify(req, env) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return jsonError(400, 'missing token');

  const raw = await env.BOOKMARKS_KV.get(`magic:${token}`);
  if (!raw) return jsonError(400, 'invalid or expired');
  await env.BOOKMARKS_KV.delete(`magic:${token}`);

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return jsonError(400, 'corrupt magic record'); }
  const email = parsed.email;
  if (!email || !allowedEmails(env).has(email)) return jsonError(403, 'not allowed');

  const sessionToken = generateToken();
  const expiresAt = Date.now() + SESSION_TTL_SEC * 1000;
  await env.BOOKMARKS_KV.put(
    `session:${sessionToken}`,
    JSON.stringify({ email, expiresAt }),
    { expirationTtl: SESSION_TTL_SEC },
  );

  return Response.json({ token: sessionToken, email, expiresAt });
}

export async function authenticate(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(\S+)$/);
  if (!m) return null;
  const raw = await env.BOOKMARKS_KV.get(`session:${m[1]}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) return null;
    return { email: parsed.email, token: m[1] };
  } catch {
    return null;
  }
}

function noContent() {
  return new Response(null, { status: 204 });
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
