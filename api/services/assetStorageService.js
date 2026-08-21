const { randomUUID } = require('node:crypto');

const { createLocalPrivateStorageAdapter } = require('../adapters/storageAdapter');
const { ASSET_CLASSIFICATIONS } = require('../generators/generatorContract');
const { generatedAssetRepository } = require('../repositories/generatedAssetRepository');
const { AppError } = require('../utils/errors');

const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;
const ASSET_TYPE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const STAGED_ASSET_MARKER = Symbol('transferly.stagedAsset');
const DEFAULT_CLEANUP_BATCH_SIZE = 100;
const MAX_CLEANUP_BATCH_SIZE = 500;

function parseDate(value, fieldName) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(500, 'ASSET_EXPIRY_INVALID', `${fieldName} must be a valid timestamp.`);
  }

  return parsed;
}

function resolveExpiration({ generatorExpiresAt, retentionDays, now }) {
  const candidates = [];
  const generatedExpiration = parseDate(generatorExpiresAt, 'Generator asset expiry');
  if (generatedExpiration) {
    candidates.push(generatedExpiration);
  }

  if (retentionDays !== null && retentionDays !== undefined) {
    const normalizedDays = Number(retentionDays);
    if (!Number.isInteger(normalizedDays) || normalizedDays < 0) {
      throw new AppError(500, 'ASSET_RETENTION_INVALID', 'Asset retention must be a non-negative integer.');
    }
    candidates.push(new Date(now.getTime() + (normalizedDays * 24 * 60 * 60 * 1000)));
  }

  if (candidates.length === 0) {
    return null;
  }

  return new Date(Math.min(...candidates.map((candidate) => candidate.getTime()))).toISOString();
}

function assertOrderIdentity(order) {
  if (!order?.id || !order?.userId) {
    throw new AppError(500, 'ASSET_ORDER_CONTEXT_INVALID', 'Generated asset order context is incomplete.');
  }
}

function assertStagedAsset(stagedAsset, order) {
  if (!stagedAsset || stagedAsset[STAGED_ASSET_MARKER] !== true) {
    throw new AppError(500, 'STAGED_ASSET_INVALID', 'Generated asset was not staged by the storage service.');
  }
  if (stagedAsset.orderId !== order.id || stagedAsset.userId !== order.userId) {
    throw new AppError(500, 'STAGED_ASSET_OWNERSHIP_MISMATCH', 'Generated asset ownership does not match its order.');
  }
}

function resolveCleanupLimit(value) {
  const limit = value ?? DEFAULT_CLEANUP_BATCH_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CLEANUP_BATCH_SIZE) {
    throw new AppError(
      500,
      'ASSET_CLEANUP_LIMIT_INVALID',
      `Asset cleanup limit must be an integer between 1 and ${MAX_CLEANUP_BATCH_SIZE}.`
    );
  }
  return limit;
}

function presentGeneratedAsset(asset) {
  return {
    id: asset.id,
    order_id: asset.orderId,
    asset_type: asset.assetType,
    mime_type: asset.mimeType,
    file_size: asset.fileSize,
    checksum: asset.checksum,
    classification: asset.classification,
    expires_at: asset.expiresAt,
    created_at: asset.createdAt
  };
}

function createAssetStorageService(options = {}) {
  const storageAdapter = options.storageAdapter || createLocalPrivateStorageAdapter();
  const repository = options.generatedAssetRepository || generatedAssetRepository;
  const now = options.now || (() => new Date());

  async function stageGeneratedAsset(input) {
    assertOrderIdentity(input?.order);
    const asset = input?.asset;
    if (!asset || !ASSET_TYPE_PATTERN.test(String(asset.assetType || ''))) {
      throw new AppError(500, 'ASSET_TYPE_INVALID', 'Generated asset type is invalid.');
    }
    if (!Object.values(ASSET_CLASSIFICATIONS).includes(asset.classification)) {
      throw new AppError(500, 'ASSET_CLASSIFICATION_INVALID', 'Generated asset classification is invalid.');
    }

    const currentTime = now();
    if (!(currentTime instanceof Date) || Number.isNaN(currentTime.getTime())) {
      throw new AppError(500, 'ASSET_CLOCK_INVALID', 'Asset storage clock returned an invalid timestamp.');
    }

    let stored;
    try {
      stored = await storageAdapter.write({
        content: asset.content,
        mimeType: asset.mimeType,
        extension: asset.extension || undefined
      });

      if (!Number.isSafeInteger(stored.fileSize) || stored.fileSize <= 0 || !CHECKSUM_PATTERN.test(stored.checksum)) {
        throw new AppError(500, 'ASSET_STORAGE_RESULT_INVALID', 'Private storage returned invalid asset metadata.');
      }

      const stagedAsset = {
        id: randomUUID(),
        orderId: input.order.id,
        userId: input.order.userId,
        assetType: asset.assetType,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        checksum: stored.checksum,
        classification: asset.classification,
        expiresAt: resolveExpiration({
          generatorExpiresAt: asset.expiresAt,
          retentionDays: input.retentionDays,
          now: currentTime
        }),
        createdAt: currentTime.toISOString()
      };
      Object.defineProperty(stagedAsset, STAGED_ASSET_MARKER, {
        enumerable: false,
        value: true
      });
      return Object.freeze(stagedAsset);
    } catch (error) {
      if (stored?.storageKey) {
        await storageAdapter.delete(stored.storageKey).catch(() => undefined);
      }
      throw error;
    }
  }

  async function persistStagedAsset(input, client) {
    assertOrderIdentity(input?.order);
    assertStagedAsset(input?.stagedAsset, input.order);
    if (!client) {
      throw new AppError(500, 'ASSET_TRANSACTION_REQUIRED', 'Generated assets must be persisted inside an order transaction.');
    }

    return repository.create(input.stagedAsset, client);
  }

  async function discardStagedAsset(stagedAsset) {
    if (!stagedAsset || stagedAsset[STAGED_ASSET_MARKER] !== true) {
      return false;
    }
    return storageAdapter.delete(stagedAsset.storageKey);
  }

  async function cleanupExpiredAssets(input = {}) {
    const currentTime = input.before === undefined ? now() : parseDate(input.before, 'Asset cleanup cutoff');
    if (!(currentTime instanceof Date) || Number.isNaN(currentTime.getTime())) {
      throw new AppError(500, 'ASSET_CLOCK_INVALID', 'Asset storage clock returned an invalid timestamp.');
    }

    const before = currentTime.toISOString();
    const limit = resolveCleanupLimit(input.limit);
    const expiredAssets = await repository.findExpired(before, { limit });
    const result = {
      before,
      scanned: expiredAssets.length,
      deleted: 0,
      filesDeleted: 0,
      missingContent: 0
    };
    const failures = [];

    for (const asset of expiredAssets) {
      try {
        const fileDeleted = await storageAdapter.delete(asset.storageKey);
        await repository.deleteById(asset.id);
        result.deleted += 1;
        if (fileDeleted) {
          result.filesDeleted += 1;
        } else {
          result.missingContent += 1;
        }
      } catch (error) {
        failures.push({
          assetId: asset.id,
          code: error?.code || 'ASSET_CLEANUP_ITEM_FAILED'
        });
      }
    }

    if (failures.length > 0) {
      throw new AppError(
        500,
        'ASSET_CLEANUP_PARTIAL_FAILURE',
        'One or more expired generated assets could not be deleted.',
        {
          ...result,
          failed: failures.length,
          failures
        }
      );
    }

    return result;
  }

  async function reconcileOrphanedAssets(input = {}) {
    if (typeof storageAdapter.listStorageKeys !== 'function') {
      throw new AppError(500, 'ASSET_RECONCILIATION_UNSUPPORTED', 'Private storage does not support reconciliation.');
    }
    if (typeof repository.findExistingStorageKeys !== 'function') {
      throw new AppError(500, 'ASSET_RECONCILIATION_REPOSITORY_INVALID', 'Generated asset records cannot be reconciled.');
    }

    const limit = resolveCleanupLimit(input.limit);
    const dryRun = input.dryRun !== false;
    const storageKeys = await storageAdapter.listStorageKeys({ limit });
    const referencedKeys = await repository.findExistingStorageKeys(storageKeys);
    const orphanedKeys = storageKeys.filter((storageKey) => !referencedKeys.has(storageKey));
    const result = {
      dryRun,
      scanned: storageKeys.length,
      referenced: storageKeys.length - orphanedKeys.length,
      orphaned: orphanedKeys.length,
      deleted: 0
    };

    if (dryRun) {
      return result;
    }

    const failures = [];
    for (const storageKey of orphanedKeys) {
      try {
        if (await storageAdapter.delete(storageKey)) {
          result.deleted += 1;
        }
      } catch (error) {
        failures.push({ code: error?.code || 'ASSET_ORPHAN_DELETE_FAILED' });
      }
    }

    if (failures.length > 0) {
      throw new AppError(500, 'ASSET_ORPHAN_RECONCILIATION_PARTIAL_FAILURE', 'One or more orphaned assets could not be deleted.', {
        ...result,
        failed: failures.length,
        failures
      });
    }

    return result;
  }

  return Object.freeze({
    cleanupExpiredAssets,
    discardStagedAsset,
    persistStagedAsset,
    presentGeneratedAsset,
    reconcileOrphanedAssets,
    stageGeneratedAsset
  });
}

const assetStorageService = createAssetStorageService();

module.exports = {
  createAssetStorageService,
  assetStorageService,
  presentGeneratedAsset
};
