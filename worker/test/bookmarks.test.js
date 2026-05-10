import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGet, handlePost, handleDelete, MAX_ITEMS } from '../src/bookmarks.js';

function makeKV() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

async function makeEnv() {
  const kv = makeKV();
  await kv.put('session:tok', JSON.stringify({ email: 'me@example.com', expiresAt: Date.now() + 60_000 }));
  return {
    BOOKMARKS_KV: kv,
    ALLOWED_EMAILS: 'me@example.com',
  };
}

function authedRequest(url, init = {}) {
  return new Request(url, {
    ...init,
    headers: { Authorization: 'Bearer tok', ...(init.headers || {}) },
  });
}

test('GET /bookmarks returns empty list for new user', async () => {
  const env = await makeEnv();
  const res = await handleGet(authedRequest('https://x/bookmarks'), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.items, []);
});

test('GET /bookmarks 401 without session', async () => {
  const env = await makeEnv();
  const res = await handleGet(new Request('https://x/bookmarks'), env);
  assert.equal(res.status, 401);
});

test('POST /bookmarks adds an item', async () => {
  const env = await makeEnv();
  const req = authedRequest('https://x/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'a1', url: 'https://example.com/a', title: 'A', source: 'X' }),
  });
  const res = await handlePost(req, env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].id, 'a1');
  assert.equal(body.items[0].url, 'https://example.com/a');
  assert.ok(body.items[0].savedAt);
});

test('POST /bookmarks dedupes by id', async () => {
  const env = await makeEnv();
  const make = () => authedRequest('https://x/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'a1', url: 'https://example.com/a', title: 'A' }),
  });
  await handlePost(make(), env);
  const res = await handlePost(make(), env);
  const body = await res.json();
  assert.equal(body.items.length, 1);
});

test('POST /bookmarks rejects without id or url', async () => {
  const env = await makeEnv();
  const req = authedRequest('https://x/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '', url: '' }),
  });
  const res = await handlePost(req, env);
  assert.equal(res.status, 400);
});

test('POST /bookmarks returns 409 when at cap', async () => {
  const env = await makeEnv();
  const items = Array.from({ length: MAX_ITEMS }, (_, i) => ({
    id: `seed-${i}`, url: `https://example.com/${i}`, title: `T${i}`, source: 'X', savedAt: i,
  }));
  await env.BOOKMARKS_KV.put('bookmarks:me@example.com', JSON.stringify({ items }));

  const req = authedRequest('https://x/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'overflow', url: 'https://example.com/overflow', title: 'Z' }),
  });
  const res = await handlePost(req, env);
  assert.equal(res.status, 409);
});

test('DELETE /bookmarks/:id removes the item', async () => {
  const env = await makeEnv();
  await handlePost(authedRequest('https://x/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'a1', url: 'https://example.com/a', title: 'A' }),
  }), env);

  const res = await handleDelete(authedRequest('https://x/bookmarks/a1', { method: 'DELETE' }), env, 'a1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.items.length, 0);
});

test('expired session is rejected', async () => {
  const env = await makeEnv();
  await env.BOOKMARKS_KV.put('session:tok', JSON.stringify({ email: 'me@example.com', expiresAt: Date.now() - 1 }));
  const res = await handleGet(authedRequest('https://x/bookmarks'), env);
  assert.equal(res.status, 401);
});
