import test from 'node:test';
import assert from 'node:assert/strict';
import { clearReadCache, readThroughCache } from './readCache.js';

test('reuses fresh read-only values without calling the loader again', async () => {
  clearReadCache();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return { calls };
  };

  const first = await readThroughCache('provider-capabilities', loader, { ttlMs: 1000 });
  const second = await readThroughCache('provider-capabilities', loader, { ttlMs: 1000 });

  assert.deepEqual(first, { calls: 1 });
  assert.deepEqual(second, { calls: 1 });
  assert.equal(calls, 1);
});

test('deduplicates concurrent initial reads', async () => {
  clearReadCache();
  let calls = 0;
  let resolveLoader;
  const loader = () => {
    calls += 1;
    return new Promise((resolve) => {
      resolveLoader = resolve;
    });
  };

  const first = readThroughCache('provider-readiness', loader);
  await Promise.resolve();
  const second = readThroughCache('provider-readiness', loader);
  resolveLoader({ ready: true });

  assert.deepEqual(await Promise.all([first, second]), [{ ready: true }, { ready: true }]);
  assert.equal(calls, 1);
});
