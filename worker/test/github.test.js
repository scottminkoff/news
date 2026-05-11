import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchBuild } from '../src/github.js';

const realFetch = globalThis.fetch;
function stubFetch(handler) {
  globalThis.fetch = handler;
  return () => { globalThis.fetch = realFetch; };
}

test('dispatchBuild POSTs to the workflow dispatch URL with bearer auth', async () => {
  let captured = null;
  const restore = stubFetch(async (url, init) => {
    captured = { url, init };
    return new Response(null, { status: 204 });
  });
  try {
    await dispatchBuild({ GITHUB_PAT: 'token-xyz' });
    assert.equal(
      captured.url,
      'https://api.github.com/repos/scottminkoff/news/actions/workflows/build.yml/dispatches',
    );
    assert.equal(captured.init.method, 'POST');
    assert.equal(captured.init.headers.Authorization, 'Bearer token-xyz');
    assert.match(captured.init.headers.Accept, /vnd\.github/);
    assert.equal(JSON.parse(captured.init.body).ref, 'main');
  } finally {
    restore();
  }
});

test('dispatchBuild throws when GITHUB_PAT is missing', async () => {
  await assert.rejects(() => dispatchBuild({}), /GITHUB_PAT/);
});

test('dispatchBuild throws when GitHub responds with non-2xx', async () => {
  const restore = stubFetch(async () => new Response('bad creds', { status: 401 }));
  try {
    await assert.rejects(
      () => dispatchBuild({ GITHUB_PAT: 'token-xyz' }),
      /GitHub dispatch 401/,
    );
  } finally {
    restore();
  }
});
