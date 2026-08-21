const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-outbox-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');

const { close, db, transaction } = require('../db');
const { migrate } = require('../db/migrate');
const {
  OUTBOX_STATUS,
  outboxEventRepository
} = require('../repositories/outboxEventRepository');
const { createOutboxDispatcher } = require('../jobs/outboxDispatcher');
const transactionalOutboxMigration = require('../db/migrations/202608200001_transactional_outbox');

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

function event(overrides = {}) {
  return {
    semanticKey: 'payout:process:payout-1',
    eventType: 'payout.processing.requested',
    aggregateType: 'payout',
    aggregateId: 'payout-1',
    queueName: 'payout-process',
    jobName: 'process-payout',
    payload: { payoutId: 'payout-1', correlationId: 'payout-1' },
    correlationId: 'payout-1',
    createdAt: '2026-08-20T10:00:00.000Z',
    ...overrides
  };
}

test('migration creates constrained outbox storage and dispatch indexes', async () => {
  const columns = await db.all('PRAGMA table_info(outbox_events)');
  const names = new Set(columns.map((column) => column.name));
  for (const name of [
    'semantic_key', 'payload_json', 'status', 'attempt_count', 'max_attempts',
    'lease_token', 'lease_expires_at', 'fence_token', 'correlation_id'
  ]) {
    assert.equal(names.has(name), true, `outbox_events.${name} should exist`);
  }
  assert.ok(await db.get(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_outbox_events_dispatch_due'"
  ));
});

test('migration backfills queued payouts exactly once with canonical processing work', async () => {
  const timestamp = '2026-08-20T09:00:00.000Z';
  await db.run(
    'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ['outbox-backfill-user', 'outbox-backfill@example.com', timestamp, timestamp]
  );
  await db.run(
    `INSERT INTO payouts (
      id, user_id, idempotency_key, sender_batch_id, status, risk_decision,
      recipient_type, receiver, amount_cents, currency_code, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'payout-backfill', 'outbox-backfill-user', 'backfill-idempotency', 'backfill-batch',
      'QUEUED', 'APPROVED', 'EMAIL', 'recipient@example.com', 1000, 'USD', timestamp, timestamp
    ]
  );

  await transactionalOutboxMigration.up(db);
  await transactionalOutboxMigration.up(db);

  const rows = await db.all(
    'SELECT * FROM outbox_events WHERE semantic_key = ?',
    ['payout:process:payout-backfill']
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, OUTBOX_STATUS.PENDING);
  assert.equal(rows[0].queue_name, 'payout-process');
  assert.equal(rows[0].job_name, 'process-payout');
  assert.deepEqual(JSON.parse(rows[0].payload_json), {
    payoutId: 'payout-backfill',
    correlationId: 'payout-backfill'
  });

  await db.run('DELETE FROM outbox_events WHERE id = ?', [rows[0].id]);
  await db.run('DELETE FROM payouts WHERE id = ?', ['payout-backfill']);
  await db.run('DELETE FROM users WHERE id = ?', ['outbox-backfill-user']);
});

test('createOrGet is idempotent only for the same semantic event', async () => {
  const created = await transaction((client) => outboxEventRepository.createOrGet(event(), client));
  const repeated = await transaction((client) => outboxEventRepository.createOrGet(event({
    payload: { correlationId: 'payout-1', payoutId: 'payout-1' }
  }), client));
  assert.equal(repeated.id, created.id);

  await assert.rejects(
    transaction((client) => outboxEventRepository.createOrGet(
      event({ payload: { payoutId: 'different-payout' } }),
      client
    )),
    (error) => error.code === 'OUTBOX_SEMANTIC_CONFLICT'
  );
});

test('stale leases are reclaimed with fencing and stale owners cannot complete', async () => {
  const first = await transaction((client) => outboxEventRepository.claimNext({
    now: '2026-08-20T10:00:01.000Z',
    leaseToken: 'lease-1',
    leaseExpiresAt: '2026-08-20T10:00:05.000Z'
  }, client));
  assert.equal(first.status, OUTBOX_STATUS.LEASED);
  assert.equal(first.fenceToken, 1);

  const second = await transaction((client) => outboxEventRepository.claimNext({
    now: '2026-08-20T10:00:06.000Z',
    leaseToken: 'lease-2',
    leaseExpiresAt: '2026-08-20T10:00:10.000Z'
  }, client));
  assert.equal(second.id, first.id);
  assert.equal(second.fenceToken, 2);

  const staleCompletion = await transaction((client) => outboxEventRepository.markDispatched({
    id: first.id,
    leaseToken: first.leaseToken,
    fenceToken: first.fenceToken,
    queueJobId: 'stale-job',
    dispatchedAt: '2026-08-20T10:00:07.000Z'
  }, client));
  assert.equal(staleCompletion, null);

  const completed = await transaction((client) => outboxEventRepository.markDispatched({
    id: second.id,
    leaseToken: second.leaseToken,
    fenceToken: second.fenceToken,
    queueJobId: 'durable-job',
    dispatchedAt: '2026-08-20T10:00:07.000Z'
  }, client));
  assert.equal(completed.status, OUTBOX_STATUS.DISPATCHED);
  assert.equal(completed.queueJobId, 'durable-job');
});

test('failed attempts retry until the configured terminal bound', async () => {
  await transaction((client) => outboxEventRepository.createOrGet(event({
    semanticKey: 'payout:process:payout-2',
    aggregateId: 'payout-2',
    payload: { payoutId: 'payout-2' },
    correlationId: 'payout-2',
    maxAttempts: 2
  }), client));

  let claimed = await transaction((client) => outboxEventRepository.claimNext({
    now: '2026-08-20T10:01:00.000Z',
    leaseToken: 'retry-1',
    leaseExpiresAt: '2026-08-20T10:01:05.000Z'
  }, client));
  let failed = await transaction((client) => outboxEventRepository.markFailedAttempt({
    id: claimed.id,
    leaseToken: claimed.leaseToken,
    fenceToken: claimed.fenceToken,
    nextAttemptAt: '2026-08-20T10:01:01.000Z',
    failedAt: '2026-08-20T10:01:00.500Z',
    errorCode: 'REDIS_UNAVAILABLE',
    errorMessage: 'Queue unavailable'
  }, client));
  assert.equal(failed.status, OUTBOX_STATUS.PENDING);

  claimed = await transaction((client) => outboxEventRepository.claimNext({
    now: '2026-08-20T10:01:02.000Z',
    leaseToken: 'retry-2',
    leaseExpiresAt: '2026-08-20T10:01:07.000Z'
  }, client));
  failed = await transaction((client) => outboxEventRepository.markFailedAttempt({
    id: claimed.id,
    leaseToken: claimed.leaseToken,
    fenceToken: claimed.fenceToken,
    nextAttemptAt: '2026-08-20T10:01:03.000Z',
    failedAt: '2026-08-20T10:01:02.500Z',
    errorMessage: 'Still unavailable'
  }, client));
  assert.equal(failed.status, OUTBOX_STATUS.FAILED);
  assert.equal(failed.attemptCount, 2);
});

test('only a terminal failure can be atomically reset for operator replay', async () => {
  const failed = await outboxEventRepository.findBySemanticKey('payout:process:payout-2');
  const replayed = await transaction((client) => outboxEventRepository.resetFailedForReplay({
    id: failed.id,
    replayedAt: '2026-08-20T10:02:00.000Z'
  }, client));

  assert.equal(replayed.status, OUTBOX_STATUS.PENDING);
  assert.equal(replayed.attemptCount, 0);
  assert.equal(replayed.lastErrorMessage, null);
  assert.equal(replayed.nextAttemptAt, '2026-08-20T10:02:00.000Z');
  assert.equal(await transaction((client) => outboxEventRepository.resetFailedForReplay({
    id: failed.id,
    replayedAt: '2026-08-20T10:02:01.000Z'
  }, client)), null);
});

test('a crash after queue publication retries with the same deterministic job id', async () => {
  const created = await transaction((client) => outboxEventRepository.createOrGet(event({
    semanticKey: 'payout:process:payout-crash',
    aggregateId: 'payout-crash',
    payload: { payoutId: 'payout-crash' },
    correlationId: 'payout-crash'
  }), client));
  const publishedJobIds = [];
  let failCompletion = true;
  const repository = {
    ...outboxEventRepository,
    async markDispatched(data, client) {
      if (failCompletion) {
        failCompletion = false;
        const error = new Error('Simulated crash after Redis accepted the job.');
        error.code = 'SIMULATED_DB_FAILURE';
        throw error;
      }
      return outboxEventRepository.markDispatched(data, client);
    }
  };
  let currentTime = '2026-08-20T10:05:00.000Z';
  const dispatcher = createOutboxDispatcher({
    repository,
    resolveQueue: () => ({
      async add(_name, _payload, options) {
        publishedJobIds.push(options.jobId);
        return { id: options.jobId };
      }
    }),
    now: () => currentTime,
    retryDelayMs: 1000
  });

  await assert.rejects(
    dispatcher.dispatchOne(created.id),
    (error) => error.code === 'SIMULATED_DB_FAILURE'
  );
  currentTime = '2026-08-20T10:05:02.000Z';
  const retried = await dispatcher.dispatchOne(created.id);

  assert.equal(retried.event.status, OUTBOX_STATUS.DISPATCHED);
  assert.equal(publishedJobIds.length, 2);
  assert.equal(publishedJobIds[0], publishedJobIds[1]);
});