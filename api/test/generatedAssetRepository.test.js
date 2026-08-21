const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-generated-assets-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'generated-assets-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'generated-assets-webhook';

const { db, close } = require('../db');
const { migrate } = require('../db/migrate');
const { createLocalPrivateStorageAdapter } = require('../adapters/storageAdapter');
const { generatedAssetRepository } = require('../repositories/generatedAssetRepository');
const { createAssetStorageService } = require('../services/assetStorageService');
const { AppError } = require('../utils/errors');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('generated assets are persisted and queried with owner scope', async () => {
  await migrate();
  const now = new Date().toISOString();
  const service = await db.get('SELECT id, slug FROM services ORDER BY display_order ASC LIMIT 1');

  await db.run(
    'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ['asset-user-1', 'asset-user-1@example.com', now, now]
  );
  await db.run(
    'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ['asset-user-2', 'asset-user-2@example.com', now, now]
  );
  await db.run(
    `
      INSERT INTO orders (
        id, user_id, idempotency_key, service_id, service_slug, status,
        point_cost, queue_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ['asset-order-1', 'asset-user-1', 'asset-order-key-1', service.id, service.slug, 'processing', 0, 'processing', now, now]
  );

  const asset = await generatedAssetRepository.create({
    orderId: 'asset-order-1',
    userId: 'asset-user-1',
    assetType: 'transaction-record',
    storageKey: '00000000-0000-4000-8000-000000000001.pdf',
    mimeType: 'application/pdf',
    fileSize: 12,
    checksum: 'a'.repeat(64),
    classification: 'private',
    expiresAt: '2027-01-01T00:00:00.000Z'
  });

  assert.equal(asset.orderId, 'asset-order-1');
  assert.equal(asset.userId, 'asset-user-1');
  assert.equal(asset.fileSize, 12);
  assert.equal((await generatedAssetRepository.findByIdForUser(asset.id, 'asset-user-1')).id, asset.id);
  assert.equal(await generatedAssetRepository.findByIdForUser(asset.id, 'asset-user-2'), null);
  assert.deepEqual(
    (await generatedAssetRepository.findManyByOrderIdForUser('asset-order-1', 'asset-user-2')),
    []
  );

  const expired = await generatedAssetRepository.findExpired('2027-01-02T00:00:00.000Z');
  assert.equal(expired.some((entry) => entry.id === asset.id), true);
});

test('asset cleanup removes expired database records and private files only', async () => {
  const storageAdapter = createLocalPrivateStorageAdapter({
    rootPath: path.join(testDir, 'private-assets')
  });
  const expiredFile = await storageAdapter.write({
    content: 'expired private content',
    mimeType: 'text/plain'
  });
  const retainedFile = await storageAdapter.write({
    content: 'retained private content',
    mimeType: 'text/plain'
  });

  const expiredAsset = await generatedAssetRepository.create({
    orderId: 'asset-order-1',
    userId: 'asset-user-1',
    assetType: 'transaction-record',
    ...expiredFile,
    classification: 'private',
    expiresAt: '2026-07-15T00:00:00.000Z'
  });
  const retainedAsset = await generatedAssetRepository.create({
    orderId: 'asset-order-1',
    userId: 'asset-user-1',
    assetType: 'transaction-record',
    ...retainedFile,
    classification: 'private',
    expiresAt: '2026-07-17T00:00:00.000Z'
  });
  const service = createAssetStorageService({
    storageAdapter,
    generatedAssetRepository,
    now: () => new Date('2026-07-16T00:00:00.000Z')
  });

  const result = await service.cleanupExpiredAssets();

  assert.equal(result.deleted, 1);
  assert.equal(result.filesDeleted, 1);
  assert.equal(await generatedAssetRepository.findById(expiredAsset.id), null);
  assert.equal((await generatedAssetRepository.findById(retainedAsset.id)).id, retainedAsset.id);
  await assert.rejects(
    storageAdapter.read(expiredFile.storageKey),
    (error) => error instanceof AppError && error.code === 'ASSET_CONTENT_NOT_FOUND'
  );
  assert.equal(
    (await storageAdapter.read(retainedFile.storageKey)).content.toString('utf8'),
    'retained private content'
  );
});
