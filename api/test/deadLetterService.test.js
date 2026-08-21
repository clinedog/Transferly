const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  buildDeadLetterSourceKey,
  createDeadLetterService
} = require('../services/deadLetterService');
const { buildQueueJobId } = require('../utils/queueJobId');

describe('deadLetterService', () => {
  test('persists exhausted jobs before enqueueing a deterministic dead-letter job', async () => {
    const operations = [];
    const queueCalls = [];
    const record = {
      id: 'dead-letter-record-1',
      jobName: 'order-process-dead-letter'
    };
    const service = createDeadLetterService({
      repository: {
        async createOrGet(input) {
          operations.push({ operation: 'createOrGet', input });
          return record;
        },
        async attachDeadLetterJob(id, deadLetterJobId) {
          operations.push({ operation: 'attachDeadLetterJob', id, deadLetterJobId });
          return { ...record, deadLetterJobId };
        }
      }
    });
    const job = {
      id: 'order-job-1',
      name: 'process-order',
      data: {
        orderId: 'order-1',
        correlationId: 'correlation-1'
      },
      attemptsMade: 5,
      opts: { attempts: 5 }
    };

    const result = await service.recordExhaustedJob({
      queueName: 'order-process',
      deadLetterQueue: {
        async add(name, payload, options) {
          queueCalls.push({ name, payload, options });
          return { id: options.jobId };
        }
      },
      job,
      error: Object.assign(new Error('invalid service input'), {
        code: 'INVALID_INPUT',
        statusCode: 422
      })
    });

    assert.equal(operations[0].operation, 'createOrGet');
    assert.equal(operations[1].operation, 'attachDeadLetterJob');
    assert.equal(
      operations[0].input.sourceKey,
      buildDeadLetterSourceKey('order-process', job)
    );
    assert.equal(operations[0].input.failureClassification, 'terminal');
    assert.equal(operations[0].input.retryable, false);
    assert.equal(operations[0].input.correlationId, 'correlation-1');
    assert.deepEqual(queueCalls[0].options, {
      jobId: buildQueueJobId('dead-letter', record.id)
    });
    assert.equal(queueCalls[0].payload.deadLetterRecordId, record.id);
    assert.equal(queueCalls[0].payload.failureClassification, 'terminal');
    assert.equal(result.deadLetterJobId, queueCalls[0].options.jobId);
  });

  test('source keys remain stable for retries of the same worker job', () => {
    const job = {
      id: 'payout-job-1',
      name: 'process-approved-payout',
      data: { payoutId: 'payout-1' }
    };

    assert.equal(
      buildDeadLetterSourceKey('payout-process', job),
      buildDeadLetterSourceKey('payout-process', { ...job, attemptsMade: 5 })
    );
  });
});
