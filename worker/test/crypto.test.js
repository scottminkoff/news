import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateToken } from '../src/crypto.js';

test('generateToken returns 43-char base64url string', () => {
  const t = generateToken();
  assert.match(t, /^[A-Za-z0-9_-]+$/);
  // 32 bytes -> 43 base64url chars (no padding)
  assert.equal(t.length, 43);
});

test('generateToken values are unique', () => {
  const set = new Set();
  for (let i = 0; i < 100; i++) set.add(generateToken());
  assert.equal(set.size, 100);
});
