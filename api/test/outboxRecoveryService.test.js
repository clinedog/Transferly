const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-outbox-recovery-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');

const { close, db, transaction } = require('../db');
const { migrate } = require('../db/migrate');
const { auditLogRepository } = require('../repositories/auditLogRepository');
const { outboxEventRepository } = require('../repositories/outboxEventRepository');
const { auditLogService } = require('../services/auditLogService');
const { createOutboxRecoveryService } = require('../services/outboxRecoveryService');

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

async function createFailedEvent(id) {
  const created = await transaction((client) => outboxEventRepository.createOrGet({
    semanticKey: `payout:process:${id}`,
    eventType: 'payout.processing.requested',
    aggregateType: 'payout',
    aggregateId: id,
    queueName: 'payout-process',
    jobName: 'process-payout',
    payload: { payoutId: id },
    correlationId: id,
    maxAttempts: 1,
    createdAt: '2026-08-20T11:00:00.000Z'
  }, client));
  const claimed = await transaction((client) => outboxEventRepository.claimById({
    id: created.id,
    now: '2026-08-20T11:00:01.000Z',
    leaseToken: `lease-${id}`,
    leaseExpiresAt: '2026-08-20T11:00:10.000Z'
  }, client));
  return transaction((client) => outboxEventRepository.markFailedAttempt({
    id: claimed.id,
    leaseToken: claimed.leaseToken,
    fenceToken: claimed.fenceToken,
    nextAttemptAt: '2026-08-20T11:00:02.000Z',
    failedAt: '2026-08-20T11:00:02.000Z',
    errorCode: 'REDIS_UNAVAILABLE',
    errorMessage: 'Queue unavailable'
  }, client));
}

test('replay resets a failed event and persists operator audit in the same transaction', async () => {
  const failed = await createFailedEvent('replay-success');
  const service = createOutboxRecoveryService({
    repository: outboxEventRepository,
    auditService: auditLogService,
    transact: transaction,
    now: () => '2026-08-20T11:01:00.000Z',
    dispatchEvent: async (eventId) => ({
      event: { ...await outboxEventRepository.findById(eventId), status: 'dispatched' }
    })
  });

  const result = await service.replayFailedEvent({
    eventId: failed.id,
    adminActorId: 'operator-1',
    reason: 'Redis incident resolved'
  });

  assert.equal(result.dispatchPending, false);
  const stored = await outboxEventRepository.findById(failed.id);
  assert.equal(stored.status, 'pending');
  assert.equal(stored.attemptCount, 0);
  const audits = await auditLogRepository.findManyForEntity('outbox_event', failed.id);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].actorId, 'operator-1');
  assert.equal(audits[0].metadata.reason, 'Redis incident resolved');
  assert.equal(audits[0].metadata.previousAttemptCount, 1);
});

test('dispatch outage leaves an audited replay pending and repeat replay is rejected', async () => {
  const failed = await createFailedEvent('replay-outage');
  const service = createOutboxRecoveryService({
    repository: outboxEventRepository,
    auditService: auditLogService,
    transact: transaction,
    now: () => '2026-08-20T11:02:00.000Z',
    dispatchEvent: async () => {
      throw new Error('Redis unavailable');
    }
  });

  const first = await service.replayFailedEvent({
    eventId: failed.id,
    adminActorId: 'operator-2',
    reason: 'Retry after provider recovery'
  });
  assert.equal(first.dispatchPending, true);
  assert.equal(first.event.status, 'pending');

  await assert.rejects(
    service.replayFailedEvent({
      eventId: failed.id,
      adminActorId: 'operator-2',
      reason: 'Duplicate retry'
    }),
    (error) => error.code === 'OUTBOX_EVENT_NOT_REPLAYABLE' && error.statusCode === 409
  );
  const auditCount = await db.get(
    "SELECT COUNT(*) AS count FROM audit_logs WHERE entity_type = 'outbox_event' AND entity_id = ?",
    [failed.id]
  );
  assert.equal(auditCount.count, 1);
});

test('replay rejects missing events without writing an audit record', async () => {
  const service = createOutboxRecoveryService({
    repository: outboxEventRepository,
    auditService: auditLogService,
    transact: transaction
  });
  await assert.rejects(
    service.replayFailedEvent({
      eventId: 'missing-event',
      adminActorId: 'operator-3',
      reason: 'Investigated incident'
    }),
    (error) => error.code === 'OUTBOX_EVENT_NOT_FOUND' && error.statusCode === 404
  );
});