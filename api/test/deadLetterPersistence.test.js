const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-dead-letters-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'dead-letter-client';
process.env.PAYPAL_CLIENT_SECRET = 'dead-letter-secret';
process.env.PAYPAL_WEBHOOK_ID = 'dead-letter-webhook';

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { createDeadLetterService } = require('../services/deadLetterService');
const {
  RECOVERY_CLAIM_TIMEOUT_MS,
  recoverPersistentDeadLetter
} = require('../services/opsService');
const { deadLetterRepository } = require('../repositories/deadLetterRepository');
const { DEAD_LETTER_STATUS } = require('../utils/constants');
const { buildQueueJobId } = require('../utils/queueJobId');

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

function buildRecord(overrides = {}) {
  return {
    sourceKey: overrides.sourceKey || `source-${Date.now()}-${Math.random()}`,
    sourceQueue: 'payout-process',
    sourceJobId: 'payout-job-1',
    jobName: 'payout-process-dead-letter',
    payload: { payoutId: 'payout-1' },
    failureCode: 'PROVIDER_TIMEOUT',
    failureMessage: 'Provider timed out.',
    failureClassification: 'retryable',
    retryable: true,
    attemptsMade: 5,
    correlationId: 'correlation-1',
    metadata: { configuredAttempts: 5 },
    ...overrides
  };
}

function buildRuntime(payoutProcessQueue) {
  return {
    queueNames: {
      invoiceSend: 'invoice-send',
      orderProcess: 'order-process',
      payoutProcess: 'payout-process',
      webhookProcess: 'webhook-process',
      payoutRetry: 'payout-retry',
      reconciliation: 'payment-reconciliation',
      deadLetter: 'dead-letter'
    },
    payoutProcessQueue
  };
}

test('dead-letter records are idempotent and recovery claims are fenced', async () => {
  const input = buildRecord({ sourceKey: 'repository-idempotency' });
  const first = await deadLetterRepository.createOrGet(input);
  const duplicate = await deadLetterRepository.createOrGet({
    ...input,
    failureMessage: 'A later duplicate should not replace the first failure.'
  });

  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.failureMessage, input.failureMessage);

  const startedAt = new Date().toISOString();
  const firstClaim = await deadLetterRepository.claimRecovery({
    id: first.id,
    recoveryToken: 'token-1',
    startedAt,
    staleBefore: new Date(Date.now() - RECOVERY_CLAIM_TIMEOUT_MS).toISOString(),
    adminActorId: 'admin-1',
    note: 'first claim'
  });
  assert.equal(firstClaim.status, DEAD_LETTER_STATUS.RECOVERY_PENDING);

  const concurrentClaim = await deadLetterRepository.claimRecovery({
    id: first.id,
    recoveryToken: 'token-2',
    startedAt: new Date().toISOString(),
    staleBefore: new Date(Date.now() - RECOVERY_CLAIM_TIMEOUT_MS).toISOString(),
    adminActorId: 'admin-2'
  });
  assert.equal(concurrentClaim, null);

  const reclaimed = await deadLetterRepository.claimRecovery({
    id: first.id,
    recoveryToken: 'token-3',
    startedAt: new Date().toISOString(),
    staleBefore: new Date(Date.parse(startedAt) + 1).toISOString(),
    adminActorId: 'admin-3'
  });
  assert.equal(reclaimed.recoveryToken, 'token-3');

  const staleCompletion = await deadLetterRepository.markRecovered({
    id: first.id,
    recoveryToken: 'token-1',
    recoveredAt: new Date().toISOString(),
    recoveryJobId: 'stale-job',
    recoveryJobName: 'process-approved-payout'
  });
  assert.equal(staleCompletion, null);
});

test('persistent dead-letter recovery enqueues once and returns an idempotent result', async () => {
  const record = await deadLetterRepository.createOrGet(
    buildRecord({ sourceKey: 'persistent-recovery', sourceJobId: 'payout-job-2' })
  );
  const queueCalls = [];
  const runtime = buildRuntime({
    async add(name, payload, options) {
      queueCalls.push({ name, payload, options });
      return { id: options.jobId };
    }
  });

  const first = await recoverPersistentDeadLetter(record, {
    runtime,
    adminActorId: 'admin-1',
    note: 'provider recovered'
  });
  const repeated = await recoverPersistentDeadLetter(record, {
    runtime,
    adminActorId: 'admin-1',
    note: 'duplicate request'
  });

  assert.equal(queueCalls.length, 1);
  assert.deepEqual(queueCalls[0], {
    name: 'process-approved-payout',
    payload: { payoutId: 'payout-1' },
    options: { jobId: buildQueueJobId('recovered', record.id) }
  });
  assert.equal(first.recovery.status, DEAD_LETTER_STATUS.RECOVERED);
  assert.equal(repeated.recovery.recovery_job_id, first.recovery.recovery_job_id);

  const audit = await db.get(
    "SELECT action, entity_id FROM audit_logs WHERE action = 'dead_letter.recovered' AND entity_id = ?",
    [record.id]
  );
  assert.deepEqual(audit, { action: 'dead_letter.recovered', entity_id: record.id });
});

test('failed queue submission is persisted and can be retried safely', async () => {
  const record = await deadLetterRepository.createOrGet(
    buildRecord({ sourceKey: 'failed-recovery', sourceJobId: 'payout-job-3' })
  );
  const queueError = new Error('Redis unavailable');

  await assert.rejects(
    recoverPersistentDeadLetter(record, {
      runtime: buildRuntime({
        async add() {
          throw queueError;
        }
      }),
      adminActorId: 'admin-1'
    }),
    queueError
  );

  const failed = await deadLetterRepository.findById(record.id);
  assert.equal(failed.status, DEAD_LETTER_STATUS.RECOVERY_FAILED);
  assert.equal(failed.lastRecoveryError, queueError.message);

  const recovered = await recoverPersistentDeadLetter(failed, {
    runtime: buildRuntime({
      async add(name, payload, options) {
        return { id: options.jobId };
      }
    }),
    adminActorId: 'admin-1'
  });
  assert.equal(recovered.recovery.status, DEAD_LETTER_STATUS.RECOVERED);
});

test('dead-letter capture persists before adding the Redis inspection job', async () => {
  const calls = [];
  const repository = {
    async createOrGet(input) {
      calls.push({ operation: 'persist', input });
      return { id: 'record-1', jobName: input.jobName };
    },
    async attachDeadLetterJob(id, queueJobId) {
      calls.push({ operation: 'attach', id, queueJobId });
      return { id, deadLetterJobId: queueJobId };
    }
  };
  const service = createDeadLetterService({ repository });

  const result = await service.recordExhaustedJob({
    queueName: 'order-process',
    deadLetterQueue: {
      async add(name, payload, options) {
        calls.push({ operation: 'enqueue', name, payload, options });
        return { id: options.jobId };
      }
    },
    job: {
      id: 'order-job-1',
      name: 'process-order',
      data: { orderId: 'order-1', correlationId: 'correlation-2' },
      attemptsMade: 5,
      opts: { attempts: 5 }
    },
    error: Object.assign(new Error('invalid service configuration'), {
      code: 'SERVICE_CONFIGURATION_INVALID',
      retryable: false
    })
  });

  assert.deepEqual(calls.map((call) => call.operation), ['persist', 'enqueue', 'attach']);
  assert.equal(calls[0].input.failureClassification, 'terminal');
  assert.equal(calls[1].payload.deadLetterRecordId, 'record-1');
  assert.equal(calls[1].options.jobId, buildQueueJobId('dead-letter', 'record-1'));
  assert.equal(result.deadLetterJobId, buildQueueJobId('dead-letter', 'record-1'));
});
