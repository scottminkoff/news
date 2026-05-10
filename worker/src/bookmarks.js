import { authenticate } from './auth.js';

export const MAX_ITEMS = 1000;

async function loadList(env, email) {
  const raw = await env.BOOKMARKS_KV.get(`bookmarks:${email}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function saveList(env, email, items) {
  await env.BOOKMARKS_KV.put(`bookmarks:${email}`, JSON.stringify({ items }));
}

export async function handleGet(req, env) {
  const session = await authenticate(req, env);
  if (!session) return jsonError(401, 'unauthorized');
  const items = await loadList(env, session.email);
  return Response.json({ items });
}

export async function handlePost(req, env) {
  const session = await authenticate(req, env);
  if (!session) return jsonError(401, 'unauthorized');

  let body;
  try { body = await req.json(); } catch { return jsonError(400, 'invalid json'); }

  const id = String(body?.id || '').slice(0, 500);
  const url = String(body?.url || '').slice(0, 2000);
  const title = String(body?.title || '').slice(0, 500);
  const source = String(body?.source || '').slice(0, 200);
  if (!id || !url) return jsonError(400, 'missing id or url');

  const items = await loadList(env, session.email);
  if (items.some(it => it.id === id || it.url === url)) {
    return Response.json({ items });
  }
  if (items.length >= MAX_ITEMS) {
    return jsonError(409, `bookmark limit ${MAX_ITEMS} reached; remove some saved items`);
  }
  items.unshift({ id, url, title, source, savedAt: Date.now() });
  await saveList(env, session.email, items);
  return Response.json({ items });
}

export async function handleDelete(req, env, id) {
  const session = await authenticate(req, env);
  if (!session) return jsonError(401, 'unauthorized');
  if (!id) return jsonError(400, 'missing id');

  const items = await loadList(env, session.email);
  const next = items.filter(it => it.id !== id);
  if (next.length !== items.length) {
    await saveList(env, session.email, next);
  }
  return Response.json({ items: next });
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
