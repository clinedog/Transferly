const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  buildQueueRegistry,
  buildQueueSnapshot,
  mapDeadLetterJob,
  mapDeadLetterRecord,
  resolveRecoveryJobName
} = require('../services/opsService');

describe('opsService', () => {
  test('queue registry includes order processing and supports order job recovery', () => {
    const queueNames = {
      invoiceSend: 'invoice-send',
      orderProcess: 'order-process',
      payoutProcess: 'payout-process',
      webhookProcess: 'webhook-process',
      payoutRetry: 'payout-retry',
      reconciliation: 'payment-reconciliation',
      deadLetter: 'dead-letter'
    };
    const runtime = { queueNames };

    for (const property of [
      'invoiceSendQueue',
      'orderProcessQueue',
      'payoutProcessQueue',
      'webhookProcessQueue',
      'payoutRetryQueue',
      'reconciliationQueue',
      'deadLetterQueue'
    ]) {
      runtime[property] = { property };
    }

    const registry = buildQueueRegistry(runtime);
    const orderQueue = registry.find((entry) => entry.key === 'order_process');

    assert.deepEqual(orderQueue, {
      key: 'order_process',
      name: 'order-process',
      queue: runtime.orderProcessQueue
    });
    assert.equal(
      resolveRecoveryJobName('order-process', { name: 'order-process-dead-letter' }),
      'process-order'
    );
  });

  test('buildQueueSnapshot normalizes queue counts', async () => {
    const snapshot = await buildQueueSnapshot({
      key: 'payout_retry',
      name: 'payout-retry',
      queue: {
        async getJobCounts() {
          return {
            waiting: 2,
            completed: 7,
            delayed: 1
          };
        }
      }
    });

    assert.deepEqual(snapshot, {
      key: 'payout_retry',
      name: 'payout-retry',
      counts: {
        waiting: 2,
        active: 0,
        completed: 7,
        failed: 0,
        delayed: 1,
        paused: 0
      }
    });
  });

  test('mapDeadLetterJob presents queue failure metadata predictably', () => {
    const mapped = mapDeadLetterJob({
      id: '41',
      name: 'payout-process-dead-letter',
      attemptsMade: 5,
      failedReason: 'Provider timeout',
      queueName: 'dead-letter',
      data: {
        queueName: 'payout-process',
        payload: {
          payoutId: 'payout-1'
        }
      },
      timestamp: Date.parse('2026-05-05T00:00:00Z'),
      finishedOn: Date.parse('2026-05-05T00:01:30Z')
    });

    assert.deepEqual(mapped, {
      job_id: '41',
      name: 'payout-process-dead-letter',
      attempts_made: 5,
      failed_reason: 'Provider timeout',
      queue_name: 'dead-letter',
      source_queue: 'payout-process',
      source_job_id: null,
      recovery: null,
      data: {
        queueName: 'payout-process',
        payload: {
          payoutId: 'payout-1'
        }
      },
      created_at: '2026-05-05T00:00:00.000Z',
      finished_at: '2026-05-05T00:01:30.000Z'
    });
  });

  test('mapDeadLetterRecord exposes durable failure metadata', () => {
    const mapped = mapDeadLetterRecord({
      id: 'record-1',
      deadLetterJobId: 'dead-letter-job-1',
      jobName: 'order-process-dead-letter',
      attemptsMade: 5,
      failureMessage: 'Input did not match the service schema.',
      failureCode: 'INVALID_INPUT',
      failureClassification: 'terminal',
      retryable: false,
      status: 'open',
      sourceQueue: 'order-process',
      sourceJobId: 'order-job-1',
      correlationId: 'correlation-1',
      payload: { orderId: 'order-1' },
      metadata: { workerJobName: 'process-order' },
      createdAt: '2026-05-05T00:00:00.000Z',
      failedAt: '2026-05-05T00:01:00.000Z'
    });

    assert.equal(mapped.record_id, 'record-1');
    assert.equal(mapped.queue_job_id, 'dead-letter-job-1');
    assert.equal(mapped.failure_code, 'INVALID_INPUT');
    assert.equal(mapped.failure_classification, 'terminal');
    assert.equal(mapped.retryable, false);
    assert.equal(mapped.correlation_id, 'correlation-1');
    assert.equal(mapped.recovery, null);
    assert.deepEqual(mapped.data.payload, { orderId: 'order-1' });
  });
});
