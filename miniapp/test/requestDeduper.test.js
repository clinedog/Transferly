import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequestDedupKey, createRequestDeduper } from '../src/lib/requestDeduper.js';

test('buildRequestDedupKey strips request-scoped headers while preserving identity', () => {
  const keyA = buildRequestDedupKey({
    method: 'GET',
    url: '/api/me',
    headers: {
      authorization: 'Bearer abc',
      'x-request-id': 'request-1',
      'x-organization-id': 'org-42',
      'x-transferly-client': 'telegram-miniapp'
    }
  });

  const keyB = buildRequestDedupKey({
    method: 'GET',
    url: '/api/me',
    headers: {
      authorization: 'Bearer abc',
      'x-request-id': 'request-2',
      'x-organization-id': 'org-42',
      'x-transferly-client': 'telegram-miniapp'
    }
  });

  assert.equal(keyA, keyB);
});

test('createRequestDeduper reuses an in-flight safe read request for identical keys', async () => {
  const deduper = createRequestDeduper();
  const key = buildRequestDedupKey({
    method: 'GET',
    url: '/api/health/client',
    headers: {
      Authorization: 'Bearer abc',
      'X-Organization-Id': 'org-42'
    }
  });

  let resolveFirst;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });

  deduper.set(key, first);

  const second = deduper.get(key);
  assert.equal(second, first);

  resolveFirst({ ok: true });
  await first;
  deduper.delete(key);
  assert.equal(deduper.get(key), null);
});
