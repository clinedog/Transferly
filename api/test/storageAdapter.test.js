const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, describe, test } = require('node:test');

const { createLocalPrivateStorageAdapter } = require('../adapters/storageAdapter');
const { AppError } = require('../utils/errors');

const testDirectories = [];

function createAdapter(options = {}) {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-private-assets-'));
  testDirectories.push(rootPath);
  return createLocalPrivateStorageAdapter({ rootPath, ...options });
}

afterEach(() => {
  for (const directory of testDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('local private storage adapter', () => {
  test('writes with an opaque key and verifies checksum and size on read', async () => {
    const adapter = createAdapter();
    const stored = await adapter.write({ content: 'private record', mimeType: 'text/plain' });

    assert.match(stored.storageKey, /^[0-9a-f-]{36}\.txt$/);
    assert.equal(stored.fileSize, 14);
    assert.match(stored.checksum, /^[0-9a-f]{64}$/);

    const result = await adapter.read(stored.storageKey, stored);
    assert.equal(result.content.toString('utf8'), 'private record');
    assert.equal(result.checksum, stored.checksum);
  });

  test('rejects traversal, MIME confusion, and oversized content', async () => {
    const adapter = createAdapter({ maxAssetBytes: 4 });

    await assert.rejects(
      adapter.read('../private.txt'),
      (error) => error instanceof AppError && error.code === 'ASSET_STORAGE_KEY_INVALID'
    );
    await assert.rejects(
      adapter.write({ content: 'x', mimeType: 'application/octet-stream' }),
      (error) => error instanceof AppError && error.code === 'ASSET_MIME_TYPE_UNSUPPORTED'
    );
    await assert.rejects(
      adapter.write({ content: 'x', mimeType: 'image/png', extension: 'jpg' }),
      (error) => error instanceof AppError && error.code === 'ASSET_EXTENSION_MISMATCH'
    );
    await assert.rejects(
      adapter.write({ content: '12345', mimeType: 'text/plain' }),
      (error) => error instanceof AppError && error.code === 'ASSET_CONTENT_TOO_LARGE'
    );
  });

  test('detects corruption and deletes stored content idempotently', async () => {
    const adapter = createAdapter();
    const stored = await adapter.write({ content: 'private record', mimeType: 'text/plain' });

    await assert.rejects(
      adapter.read(stored.storageKey, { ...stored, checksum: '0'.repeat(64) }),
      (error) => error instanceof AppError && error.code === 'ASSET_INTEGRITY_CHECK_FAILED'
    );

    assert.equal(await adapter.delete(stored.storageKey), true);
    assert.equal(await adapter.delete(stored.storageKey), false);
  });
});
