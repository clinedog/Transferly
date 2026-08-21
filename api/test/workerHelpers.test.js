const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  RETRY_DELAYS_MS,
  buildDeadLetterPayload,
  classifyWorkerFailure,
  createClassifiedJobProcessor,
  createOrderJobProcessor,
  createPayoutJobProcessor,
  createWorkerFailureHandler,
  hasExhaustedAttempts
} = require('../jobs/workerHelpers');

describe('worker helpers', () => {
  test('order job processor delegates to the order service with stable job metadata', async () => {
    const calls = [];
    const processor = createOrderJobProcessor({
      orderService: {
        async processQueuedOrder(input) {
          calls.push(input);
          return {
            order: {
              id: input.orderId
            }
          };
        }
      }
    });

    const result = await processor({
      id: 'job-order-1',
      data: {
        orderId: 'order-1',
        dispatchGeneration: 3,
        correlationId: 'correlation-1'
      },
      attemptsMade: 2
    });

    assert.equal(result.order.id, 'order-1');
    assert.deepEqual(calls, [
      {
        orderId: 'order-1',
        dispatchGeneration: 3,
        jobId: 'job-order-1',
        correlationId: 'correlation-1',
        queueAttempt: 3
      }
    ]);
  });

  test('payout job processor schedules a retry when the provider status is pending', async () => {
    const retryCalls = [];
    const payoutService = {
      async processQueuedPayout(payoutId) {
        return {
          payout_id: payoutId,
          status: 'PENDING'
        };
      },
      isProviderPendingStatus(status) {
        return status === 'PENDING';
      }
    };

    const processor = createPayoutJobProcessor({
      payoutService,
      retryQueue: {
        async add(name, payload, options) {
          retryCalls.push({ name, payload, options });
        }
      },
      retryDelayMs: RETRY_DELAYS_MS.initialPayoutPoll,
      now: () => 123456
    });

    const result = await processor({
      data: {
        payoutId: 'payout-1'
      }
    });

    assert.equal(result.status, 'PENDING');
    assert.deepEqual(retryCalls, [
      {
        name: 'retry-payout-status-poll',
        payload: {
          payoutId: 'payout-1'
        },
        options: {
          jobId: 'q-12-payout-retry-8-payout-1-6-123456',
          delay: RETRY_DELAYS_MS.initialPayoutPoll
        }
      }
    ]);
  });

  test('payout job processor skips retry scheduling for terminal statuses', async () => {
    const payoutService = {
      async processQueuedPayout(payoutId) {
        return {
          payout_id: payoutId,
          status: 'SUCCESS'
        };
      },
      isProviderPendingStatus() {
        return false;
      }
    };

    let addCalled = false;
    const processor = createPayoutJobProcessor({
      payoutService,
      retryQueue: {
        async add() {
          addCalled = true;
        }
      },
      retryDelayMs: RETRY_DELAYS_MS.followUpPayoutPoll
    });

    const result = await processor({
      data: {
        payoutId: 'payout-2'
      }
    });

    assert.equal(result.status, 'SUCCESS');
    assert.equal(addCalled, false);
  });

  test('failure handler runs exhausted hooks and sends exhausted jobs to the dead-letter queue', async () => {
    const deadLetterCalls = [];
    const exhaustedCalls = [];
    const onFailure = createWorkerFailureHandler({
      queueName: 'payout-process',
      async onExhausted(job, error) {
        exhaustedCalls.push({ jobId: job.id, error: error.message });
      },
      deadLetterQueue: {
        async add(name, payload) {
          deadLetterCalls.push({ name, payload });
        }
      }
    });

    await onFailure(
      {
        id: 'job-1',
        data: { payoutId: 'payout-3' },
        attemptsMade: 5,
        opts: { attempts: 5 }
      },
      new Error('processing failed')
    );

    assert.deepEqual(exhaustedCalls, [
      {
        jobId: 'job-1',
        error: 'processing failed'
      }
    ]);
    assert.deepEqual(deadLetterCalls, [
      {
        name: 'payout-process-dead-letter',
        payload: {
          sourceQueue: 'payout-process',
          sourceJobId: 'job-1',
          payload: { payoutId: 'payout-3' },
          error: 'processing failed'
        }
      }
    ]);
  });

  test('failure handler skips dead-letter writes before attempts are exhausted', async () => {
    let addCalled = false;
    const onFailure = createWorkerFailureHandler({
      queueName: 'invoice-send',
      deadLetterQueue: {
        async add() {
          addCalled = true;
        }
      }
    });

    await onFailure(
      {
        id: 'job-2',
        data: { invoiceId: 'invoice-1' },
        attemptsMade: 2,
        opts: { attempts: 5 }
      },
      new Error('still retrying')
    );

    assert.equal(addCalled, false);
  });

  test('failure classification only stops retries for explicit or non-transient client errors', () => {
    assert.deepEqual(classifyWorkerFailure({ statusCode: 400, code: 'BAD_INPUT' }), {
      classification: 'terminal',
      retryable: false,
      code: 'BAD_INPUT',
      failureClass: 'invalid_input'
    });
    assert.equal(classifyWorkerFailure({ statusCode: 429 }).retryable, true);
    assert.equal(classifyWorkerFailure({ statusCode: 503, code: 'PROVIDER_UNAVAILABLE' }).failureClass, 'provider_failure');
    assert.equal(classifyWorkerFailure({ code: 'ECONNRESET' }).failureClass, 'network_failure');
    assert.equal(classifyWorkerFailure(new Error('provider timeout')).retryable, true);
    assert.equal(classifyWorkerFailure({ retryable: false }).classification, 'terminal');
  });

  test('classified processor discards terminal jobs before rethrowing', async () => {
    const error = Object.assign(new Error('invalid payload'), { statusCode: 422 });
    let discarded = false;
    const processor = createClassifiedJobProcessor(async () => {
      throw error;
    });

    await assert.rejects(
      processor({
        discard() {
          discarded = true;
        }
      }),
      error
    );
    assert.equal(discarded, true);
  });

  test('terminal failures are finalized without consuming configured retries', async () => {
    let deadLetterCalled = false;
    const onFailure = createWorkerFailureHandler({
      queueName: 'order-process',
      async deadLetterHandler() {
        deadLetterCalled = true;
      }
    });

    await onFailure(
      {
        id: 'job-terminal',
        attemptsMade: 1,
        opts: { attempts: 5 }
      },
      Object.assign(new Error('invalid order'), { statusCode: 422 })
    );

    assert.equal(deadLetterCalled, true);
  });

  test('failure handler still writes the dead letter when the exhausted hook fails', async () => {
    let deadLetterCalled = false;
    const hookError = new Error('terminalization failed');
    const onFailure = createWorkerFailureHandler({
      queueName: 'order-process',
      async onExhausted() {
        throw hookError;
      },
      async deadLetterHandler() {
        deadLetterCalled = true;
      }
    });

    await assert.rejects(
      onFailure(
        {
          id: 'job-exhausted',
          attemptsMade: 5,
          opts: { attempts: 5 }
        },
        new Error('processing failed')
      ),
      hookError
    );
    assert.equal(deadLetterCalled, true);
  });

  test('dead-letter payloads and attempt exhaustion are computed predictably', () => {
    const payload = buildDeadLetterPayload(
      'webhook-process',
      {
        id: 'job-3',
        data: { webhookEventId: 'evt-1' }
      },
      new Error('boom')
    );

    assert.deepEqual(payload, {
      sourceQueue: 'webhook-process',
      sourceJobId: 'job-3',
      payload: { webhookEventId: 'evt-1' },
      error: 'boom'
    });
    assert.equal(hasExhaustedAttempts({ attemptsMade: 1, opts: { attempts: 1 } }), true);
    assert.equal(hasExhaustedAttempts({ attemptsMade: 0, opts: { attempts: 1 } }), false);
  });
});
