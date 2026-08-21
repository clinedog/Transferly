const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-order-generation-'));

process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(temporaryRoot, 'transferly.sqlite');
process.env.GENERATED_ASSET_STORAGE_PATH = path.join(temporaryRoot, 'assets');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'order-generation-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'order-generation-webhook';

const { createLocalPrivateStorageAdapter } = require('../adapters/storageAdapter');
const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { ServiceGenerator } = require('../generators/generatorContract');
const { generatorRegistry } = require('../generators/generatorRegistry');
const { generatedAssetRepository } = require('../repositories/generatedAssetRepository');
const { pointReservationRepository } = require('../repositories/pointReservationRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { serviceRepository } = require('../repositories/serviceRepository');
const { userRepository } = require('../repositories/userRepository');
const { orderService } = require('../services/orderService');
const { setPointBalance } = require('./helpers/pointLedgerFixtures');
const { ORDER_STATUS, POINT_RESERVATION_STATUS } = require('../utils/constants');

class OrderRecordGenerator extends ServiceGenerator {
  async validate(input) {
    return { reference: String(input.reference || '').trim() };
  }

  async preflight(context) {
    return { ready: Boolean(context.input.reference) };
  }

  async generate(context) {
    return {
      asset: {
        content: `generated:${context.input.reference}`,
        assetType: 'transaction-record',
        mimeType: 'text/plain'
      },
      metadata: { format: 'plain-v1' }
    };
  }
}

generatorRegistry.register({
  key: 'order-record-generator',
  version: '1',
  Generator: OrderRecordGenerator
});

after(async () => {
  await close();
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('generator completion persists one private asset and settles one reservation', async () => {
  await migrate();

  const userId = 'generation-user';
  await userRepository.upsert({
    id: userId,
    email: 'generation-user@example.com',
    displayName: 'Generation User',
    countryCode: 'US'
  });
  await profileRepository.upsert({
    userId,
    name: 'Generation User',
    points: 0,
    role: 'USER'
  });
  await setPointBalance(userId, 20);
  await serviceRepository.upsert({
    slug: 'generated-record',
    title: 'Generated Record',
    category: 'Records',
    description: 'Produces a private generated record for an order.',
    pointPrice: 7,
    status: 'active',
    generatorKey: 'order-record-generator',
    generatorVersion: '1',
    inputSchema: {},
    outputType: 'text/plain',
    retentionDays: 3,
    executionMode: 'production',
    version: '1'
  });

  const created = await orderService.createOrder({
    userId,
    serviceSlug: 'generated-record',
    idempotencyKey: 'order-generation-completion',
    preflightAccepted: true,
    input: { reference: ' ABC ' }
  });

  assert.equal(created.order.status, ORDER_STATUS.QUEUED);
  assert.ok(created.order.point_reservation_id);
  assert.equal((await profileRepository.findByUserId(userId)).points, 13);

  const processed = await orderService.processQueuedOrder({
    orderId: created.order.id,
    dispatchGeneration: 1,
    jobId: 'order-generation-integration',
    actorId: 'test-order-worker'
  });

  assert.equal(processed.skipped, false);
  assert.equal(processed.order.status, ORDER_STATUS.COMPLETED);
  assert.equal(processed.order.output.handled, true);
  assert.equal(processed.order.output.generation.generator_key, 'order-record-generator');
  assert.equal(processed.order.output.generation.generator_version, '1');
  assert.equal(processed.order.output.generation.metadata.format, 'plain-v1');
  assert.ok(processed.order.output.asset_id);
  assert.equal(processed.order.output.asset.id, processed.order.output.asset_id);
  assert.equal(processed.order.output.asset.asset_type, 'transaction-record');
  assert.equal(processed.order.output.asset.classification, 'private');
  assert.equal(processed.order.output.asset.storage_key, undefined);
  assert.equal(processed.order.output.asset.user_id, undefined);

  const asset = await generatedAssetRepository.findById(processed.order.output.asset_id);
  assert.equal(asset.orderId, created.order.id);
  assert.equal(asset.userId, userId);
  const stored = await createLocalPrivateStorageAdapter({
    rootPath: process.env.GENERATED_ASSET_STORAGE_PATH
  }).read(asset.storageKey, {
    fileSize: asset.fileSize,
    checksum: asset.checksum
  });
  assert.equal(stored.content.toString('utf8'), 'generated:ABC');

  const reservation = await pointReservationRepository.findById(created.order.point_reservation_id);
  assert.equal(reservation.status, POINT_RESERVATION_STATUS.COMMITTED);
  assert.equal((await profileRepository.findByUserId(userId)).points, 13);

  const pointEntries = await db.all(
    `
      SELECT entry_key, amount, balance_after
      FROM points_transactions
      WHERE reference_type = 'ORDER' AND reference_id = ?
      ORDER BY entry_key ASC
    `,
    [created.order.id]
  );
  assert.equal(pointEntries.length, 2);
  assert.deepEqual(pointEntries.map((entry) => entry.amount).sort((left, right) => left - right), [-7, 0]);
  assert.deepEqual(pointEntries.map((entry) => entry.balance_after), [13, 13]);

  const retriedDispatch = await orderService.processQueuedOrder({
    orderId: created.order.id,
    dispatchGeneration: 1,
    jobId: 'order-generation-integration-retry',
    actorId: 'test-order-worker'
  });
  assert.equal(retriedDispatch.skipped, true);
  assert.equal(retriedDispatch.order.status, ORDER_STATUS.COMPLETED);

  const assetCount = await db.get(
    'SELECT COUNT(*) AS count FROM generated_assets WHERE order_id = ?',
    [created.order.id]
  );
  const pointEntryCount = await db.get(
    `
      SELECT COUNT(*) AS count
      FROM points_transactions
      WHERE reference_type = 'ORDER' AND reference_id = ?
    `,
    [created.order.id]
  );
  assert.equal(assetCount.count, 1);
  assert.equal(pointEntryCount.count, 2);

  const generatedAssetEvent = await db.get(
    `
      SELECT metadata_json
      FROM order_events
      WHERE order_id = ? AND next_status = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [created.order.id, ORDER_STATUS.COMPLETED]
  );
  assert.equal(JSON.parse(generatedAssetEvent.metadata_json).generatedAssetId, asset.id);
});
