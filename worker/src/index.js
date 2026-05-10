import { handleRequestLink, handleVerify } from './auth.js';
import { handleGet, handlePost, handleDelete } from './bookmarks.js';

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    let res;
    try {
      res = await route(req, env);
    } catch (err) {
      console.error(err);
      res = new Response(JSON.stringify({ error: 'server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
};

async function route(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === 'POST' && path === '/auth/request') return handleRequestLink(req, env);
  if (method === 'GET'  && path === '/auth/verify')  return handleVerify(req, env);
  if (method === 'GET'  && path === '/bookmarks')    return handleGet(req, env);
  if (method === 'POST' && path === '/bookmarks')    return handlePost(req, env);

  const m = path.match(/^\/bookmarks\/(.+)$/);
  if (method === 'DELETE' && m) {
    return handleDelete(req, env, decodeURIComponent(m[1]));
  }

  return new Response(JSON.stringify({ error: 'not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const isLocal = /^http:\/\/localhost(:\d+)?$/.test(origin);
  const ok = allowed.includes(origin) || isLocal;

  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (ok) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
