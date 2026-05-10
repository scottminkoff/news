import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequestLink, handleVerify, authenticate } from '../src/auth.js';

function makeKV() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

function makeEnv(overrides = {}) {
  return {
    BOOKMARKS_KV: makeKV(),
    ALLOWED_EMAILS: 'me@example.com',
    SITE_URL: 'https://site.example/',
    FROM_EMAIL: 'from@example.com',
    RESEND_API_KEY: 'test',
    ...overrides,
  };
}

// stub global fetch to capture Resend calls
const realFetch = globalThis.fetch;
function stubFetch(handler) {
  globalThis.fetch = handler;
  return () => { globalThis.fetch = realFetch; };
}

test('request-link with allowlisted email writes magic + sends email', async () => {
  const env = makeEnv();
  let captured = null;
  const restore = stubFetch(async (url, init) => {
    captured = { url, init };
    return new Response('{}', { status: 200 });
  });
  try {
    const res = await handleRequestLink(new Request('https://x/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'me@example.com' }),
    }), env);
    assert.equal(res.status, 204);
    const magicKeys = [...env.BOOKMARKS_KV.store.keys()].filter(k => k.startsWith('magic:'));
    assert.equal(magicKeys.length, 1);
    assert.ok(captured, 'fetch should have been called');
    assert.match(captured.init.body, /site\.example/);
  } finally {
    restore();
  }
});

test('request-link with non-allowlisted email returns 204 with no side effects', async () => {
  const env = makeEnv();
  const restore = stubFetch(async () => { throw new Error('should not be called'); });
  try {
    const res = await handleRequestLink(new Request('https://x/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'attacker@example.com' }),
    }), env);
    assert.equal(res.status, 204);
    const keys = [...env.BOOKMARKS_KV.store.keys()];
    assert.equal(keys.length, 0);
  } finally {
    restore();
  }
});

test('rate-limit kicks in after 5 requests/hour', async () => {
  const env = makeEnv();
  const restore = stubFetch(async () => new Response('{}', { status: 200 }));
  try {
    for (let i = 0; i < 5; i++) {
      await handleRequestLink(new Request('https://x/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'me@example.com' }),
      }), env);
    }
    const before = [...env.BOOKMARKS_KV.store.keys()].filter(k => k.startsWith('magic:')).length;
    await handleRequestLink(new Request('https://x/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'me@example.com' }),
    }), env);
    const after = [...env.BOOKMARKS_KV.store.keys()].filter(k => k.startsWith('magic:')).length;
    assert.equal(after, before, 'no new magic key after rate limit hit');
  } finally {
    restore();
  }
});

test('verify exchanges magic token for session and deletes magic', async () => {
  const env = makeEnv();
  await env.BOOKMARKS_KV.put('magic:abc', JSON.stringify({ email: 'me@example.com' }));
  const res = await handleVerify(new Request('https://x/auth/verify?token=abc'), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.token);
  assert.equal(body.email, 'me@example.com');
  assert.equal(await env.BOOKMARKS_KV.get('magic:abc'), null);
  assert.ok(await env.BOOKMARKS_KV.get(`session:${body.token}`));
});

test('verify with unknown token returns 400', async () => {
  const env = makeEnv();
  const res = await handleVerify(new Request('https://x/auth/verify?token=missing'), env);
  assert.equal(res.status, 400);
});

test('verify rejects email no longer on allowlist', async () => {
  const env = makeEnv();
  await env.BOOKMARKS_KV.put('magic:abc', JSON.stringify({ email: 'old@example.com' }));
  const res = await handleVerify(new Request('https://x/auth/verify?token=abc'), env);
  assert.equal(res.status, 403);
});

test('authenticate accepts valid Bearer and rejects expired/missing', async () => {
  const env = makeEnv();
  await env.BOOKMARKS_KV.put('session:good', JSON.stringify({ email: 'me@example.com', expiresAt: Date.now() + 60_000 }));
  await env.BOOKMARKS_KV.put('session:old', JSON.stringify({ email: 'me@example.com', expiresAt: Date.now() - 1 }));

  const ok = await authenticate(new Request('https://x', { headers: { Authorization: 'Bearer good' } }), env);
  assert.equal(ok?.email, 'me@example.com');

  const old = await authenticate(new Request('https://x', { headers: { Authorization: 'Bearer old' } }), env);
  assert.equal(old, null);

  const none = await authenticate(new Request('https://x'), env);
  assert.equal(none, null);
});
