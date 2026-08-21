const { AppError } = require('../utils/errors');

const ASSET_CLEANUP_SCHEDULER_ID = 'cleanup-expired-generated-assets';
const ASSET_CLEANUP_JOB_NAME = 'cleanup-expired-generated-assets';

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(500, 'ASSET_CLEANUP_CONFIG_INVALID', `${fieldName} must be a positive integer.`);
  }
}

function createCleanupExpiredAssetJob({
  assetStorageService,
  batchSize,
  reconcileOrphans = false,
  now = () => new Date()
}) {
  if (!assetStorageService?.cleanupExpiredAssets) {
    throw new AppError(500, 'ASSET_CLEANUP_SERVICE_INVALID', 'Asset cleanup service is unavailable.');
  }
  assertPositiveInteger(batchSize, 'Asset cleanup batch size');

  return async function cleanupExpiredAssetJob(job = {}) {
    const cutoff = job.data?.before ?? now();
    const limit = job.data?.limit ?? batchSize;
    const expired = await assetStorageService.cleanupExpiredAssets({ before: cutoff, limit });
    if (!reconcileOrphans) {
      return expired;
    }
    if (typeof assetStorageService.reconcileOrphanedAssets !== 'function') {
      throw new AppError(500, 'ASSET_RECONCILIATION_UNSUPPORTED', 'Asset reconciliation service is unavailable.');
    }
    return {
      expired,
      orphaned: await assetStorageService.reconcileOrphanedAssets({ limit, dryRun: false })
    };
  };
}

async function registerExpiredAssetCleanupSchedule(queue, { intervalMs, batchSize }) {
  if (!queue?.upsertJobScheduler) {
    throw new AppError(500, 'ASSET_CLEANUP_QUEUE_INVALID', 'Asset cleanup queue is unavailable.');
  }
  assertPositiveInteger(intervalMs, 'Asset cleanup interval');
  assertPositiveInteger(batchSize, 'Asset cleanup batch size');

  return queue.upsertJobScheduler(
    ASSET_CLEANUP_SCHEDULER_ID,
    { every: intervalMs },
    {
      name: ASSET_CLEANUP_JOB_NAME,
      data: { limit: batchSize }
    }
  );
}

module.exports = {
  ASSET_CLEANUP_JOB_NAME,
  ASSET_CLEANUP_SCHEDULER_ID,
  createCleanupExpiredAssetJob,
  registerExpiredAssetCleanupSchedule
};
