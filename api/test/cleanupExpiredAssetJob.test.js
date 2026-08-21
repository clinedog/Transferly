const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  ASSET_CLEANUP_JOB_NAME,
  ASSET_CLEANUP_SCHEDULER_ID,
  createCleanupExpiredAssetJob,
  registerExpiredAssetCleanupSchedule
} = require('../jobs/cleanupExpiredAssetJob');
const { AppError } = require('../utils/errors');

describe('expired generated asset cleanup job', () => {
  test('uses a fresh cutoff and configured batch size for each execution', async () => {
    const calls = [];
    const cutoff = new Date('2026-07-16T13:00:00.000Z');
    const processor = createCleanupExpiredAssetJob({
      assetStorageService: {
        async cleanupExpiredAssets(input) {
          calls.push(input);
          return { deleted: 2 };
        }
      },
      batchSize: 100,
      now: () => cutoff
    });

    const result = await processor({ data: {} });

    assert.deepEqual(result, { deleted: 2 });
    assert.deepEqual(calls, [{ before: cutoff, limit: 100 }]);
  });

  test('honors explicit job bounds for deterministic retries and maintenance runs', async () => {
    const calls = [];
    const processor = createCleanupExpiredAssetJob({
      assetStorageService: {
        async cleanupExpiredAssets(input) {
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

  test('runs orphan deletion only when explicitly enabled', async () => {
    const calls = [];
    const processor = createCleanupExpiredAssetJob({
      assetStorageService: {
        async cleanupExpiredAssets(input) {
          calls.push({ type: 'expired', input });
          return { deleted: 1 };
        },
        async reconcileOrphanedAssets(input) {
          calls.push({ type: 'orphaned', input });
          return { deleted: 2 };
        }
      },
      batchSize: 100,
      reconcileOrphans: true,
      now: () => new Date('2026-07-23T00:00:00.000Z')
    });

    assert.deepEqual(await processor({ data: { limit: 5 } }), {
      expired: { deleted: 1 },
      orphaned: { deleted: 2 }
    });
    assert.deepEqual(calls, [
      { type: 'expired', input: { before: new Date('2026-07-23T00:00:00.000Z'), limit: 5 } },
      { type: 'orphaned', input: { limit: 5, dryRun: false } }
    ]);
  });

  test('upserts one stable BullMQ scheduler with bounded job data', async () => {
    const calls = [];
    const queue = {
      async upsertJobScheduler(...args) {
        calls.push(args);
        return { id: 'scheduled-job' };
      }
    };

    const scheduled = await registerExpiredAssetCleanupSchedule(queue, {
      intervalMs: 21_600_000,
      batchSize: 100
    });

    assert.deepEqual(scheduled, { id: 'scheduled-job' });
    assert.deepEqual(calls, [[
      ASSET_CLEANUP_SCHEDULER_ID,
      { every: 21_600_000 },
      {
        name: ASSET_CLEANUP_JOB_NAME,
        data: { limit: 100 }
      }
    ]]);
  });

  test('fails fast for invalid service and scheduler configuration', async () => {
    assert.throws(
      () => createCleanupExpiredAssetJob({ assetStorageService: {}, batchSize: 100 }),
      (error) => error instanceof AppError && error.code === 'ASSET_CLEANUP_SERVICE_INVALID'
    );
    await assert.rejects(
      registerExpiredAssetCleanupSchedule({}, { intervalMs: 1000, batchSize: 100 }),
      (error) => error instanceof AppError && error.code === 'ASSET_CLEANUP_QUEUE_INVALID'
    );
  });
});
