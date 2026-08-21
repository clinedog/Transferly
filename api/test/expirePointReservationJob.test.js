const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  POINT_RESERVATION_EXPIRY_JOB_NAME,
  POINT_RESERVATION_EXPIRY_SCHEDULER_ID,
  createExpirePointReservationJob,
  registerPointReservationExpirySchedule
} = require('../jobs/expirePointReservationJob');
const { AppError } = require('../utils/errors');

describe('point reservation expiry job', () => {
  test('uses a fresh cutoff and configured batch size for each execution', async () => {
    const calls = [];
    const cutoff = new Date('2026-07-16T13:00:00.000Z');
    const processor = createExpirePointReservationJob({
      orderService: {
        async expireStalePointReservations(input) {
          calls.push(input);
          return { expired: 2 };
        }
      },
      batchSize: 100,
      now: () => cutoff
    });

    const result = await processor({ data: {} });

    assert.deepEqual(result, { expired: 2 });
    assert.deepEqual(calls, [{ before: cutoff, limit: 100 }]);
  });

  test('honors explicit job bounds for deterministic retries and maintenance runs', async () => {
    const calls = [];
    const processor = createExpirePointReservationJob({
      orderService: {
        async expireStalePointReservations(input) {
          calls.push(input);
          return input;
        }
      },
      batchSize: 100
    });

    await processor({
      data: {
        before: '2026-07-15T00:00:00.000Z',
        limit: 20
      }
    });

    assert.deepEqual(calls, [{
      before: '2026-07-15T00:00:00.000Z',
      limit: 20
    }]);
  });

  test('upserts one stable BullMQ scheduler with bounded job data', async () => {
    const calls = [];
    const queue = {
      async upsertJobScheduler(...args) {
        calls.push(args);
        return { id: 'scheduled-expiry' };
      }
    };

    const scheduled = await registerPointReservationExpirySchedule(queue, {
      intervalMs: 300_000,
      batchSize: 100
    });

    assert.deepEqual(scheduled, { id: 'scheduled-expiry' });
    assert.deepEqual(calls, [[
      POINT_RESERVATION_EXPIRY_SCHEDULER_ID,
      { every: 300_000 },
      {
        name: POINT_RESERVATION_EXPIRY_JOB_NAME,
        data: { limit: 100 }
      }
    ]]);
  });

  test('fails fast for invalid service and scheduler configuration', async () => {
    assert.throws(
      () => createExpirePointReservationJob({ orderService: {}, batchSize: 100 }),
      (error) => error instanceof AppError && error.code === 'POINT_RESERVATION_EXPIRY_SERVICE_INVALID'
    );
    await assert.rejects(
      registerPointReservationExpirySchedule({}, { intervalMs: 300_000, batchSize: 100 }),
      (error) => error instanceof AppError && error.code === 'POINT_RESERVATION_EXPIRY_QUEUE_INVALID'
    );
  });
});
