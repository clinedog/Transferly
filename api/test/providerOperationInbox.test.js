const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-provider-inbox-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { providerOperationInboxRepository } = require('../repositories/providerOperationInboxRepository');
const {
  createProviderOperationInboxService
} = require('../services/providerOperationInboxService');

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

function observation(overrides = {}) {
  return {
    provider: 'stripe',
    payoutId: 'payout-inbox-1',
    source: 'submission',
    providerResourceType: 'transfer',
    providerResourceId: 'tr_inbox_1',
    providerStatus: 'SUCCESS',
    providerItemId: 'tr_inbox_1',
    amountCents: 1250,
    currencyCode: 'USD',
    correlationId: 'payout-inbox-1',
    receivedAt: '2026-08-20T12:00:00.000Z',
    ...overrides
  };
}

test('migration creates constrained provider inbox storage and indexes', async () => {
  const columns = await db.all('PRAGMA table_info(provider_operation_inbox)');
  const names = new Set(columns.map((column) => column.name));
  for (const name of [
    'semantic_key', 'provider', 'operation_type', 'aggregate_id', 'source',
    'payload_hash', 'correlation_id', 'received_at', 'consumed_at', 'consumed_by'
  ]) {
    assert.equal(names.has(name), true, `provider_operation_inbox.${name} should exist`);
  }
  assert.ok(await db.get(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_provider_operation_inbox_unconsumed'"
  ));
});

test('payout observations are semantically idempotent and store only normalized fields', async () => {
  const service = createProviderOperationInboxService({
    now: () => '2026-08-20T12:00:00.000Z'
  });
  const created = await service.recordPayoutObservation(observation({
    rawPayload: { authorization: 'must-not-be-stored', receiver: 'private@example.com' }
  }));
  const repeated = await service.recordPayoutObservation(observation());

  assert.equal(repeated.id, created.id);
  assert.deepEqual(created.payload, {
    amountCents: 1250,
    currencyCode: 'USD',
    issueCode: null,
    providerBatchId: null,
    providerItemId: 'tr_inbox_1',
    reversed: false,
    status: 'SUCCESS'
  });
  assert.equal(JSON.stringify(created).includes('private@example.com'), false);
  assert.match(created.payloadHash, /^[a-f0-9]{64}$/);

  await assert.rejects(
    service.recordPayoutObservation(observation({ amountCents: 1300 })),
    (error) => error.code === 'PROVIDER_INBOX_SEMANTIC_CONFLICT'
  );
});

test('unconsumed observations are ordered and can be consumed only once', async () => {
  const service = createProviderOperationInboxService({
    now: () => '2026-08-20T12:05:00.000Z'
  });
  const second = await service.recordPayoutObservation(observation({
    payoutId: 'payout-inbox-2',
    providerResourceId: 'tr_inbox_2',
    providerItemId: 'tr_inbox_2',
    receivedAt: '2026-08-20T12:01:00.000Z'
  }));

  const pending = await providerOperationInboxRepository.findUnconsumed({
    provider: 'stripe',
    aggregateType: 'payout'
  });
  assert.deepEqual(pending.map((record) => record.aggregateId), [
    'payout-inbox-1',
    'payout-inbox-2'
  ]);

  const consumed = await service.consume(second.id, 'payout-processing-service');
  assert.equal(consumed.consumedBy, 'payout-processing-service');
  assert.equal(consumed.consumedAt, '2026-08-20T12:05:00.000Z');
  assert.equal(await service.consume(second.id, 'duplicate-consumer'), null);
});