const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { createAssetStorageService } = require('../services/assetStorageService');
const { AppError } = require('../utils/errors');

const ORDER = Object.freeze({ id: 'order-1', userId: 'user-1' });
const NOW = new Date('2026-07-16T12:00:00.000Z');

function createFixture(overrides = {}) {
  const calls = {
    created: [],
    deleted: []
  };
  const storageAdapter = overrides.storageAdapter || {
    async write() {
      return {
        storageKey: '00000000-0000-4000-8000-000000000001.txt',
        mimeType: 'text/plain',
        fileSize: 14,
        checksum: 'a'.repeat(64)
      };
    },
    async delete(storageKey) {
      calls.deleted.push(storageKey);
      return true;
    }
  };
  const repository = overrides.repository || {
    async create(asset, client) {
      calls.created.push({ asset, client });
      return asset;
    }
  };

  return {
    calls,
    service: createAssetStorageService({
      storageAdapter,
      generatedAssetRepository: repository,
      now: () => new Date(NOW)
    })
  };
}

async function stageAsset(service, overrides = {}) {
  return service.stageGeneratedAsset({
    order: ORDER,
    retentionDays: 30,
    asset: {
      content: 'private record',
      assetType: 'transaction-record',
      mimeType: 'text/plain',
      classification: 'private',
      expiresAt: '2026-07-20T12:00:00.000Z',
      ...overrides
    }
  });
}

describe('asset storage service', () => {
  test('stages privately and persists only through the supplied transaction client', async () => {
    const { calls, service } = createFixture();
    const staged = await stageAsset(service);

    assert.equal(Object.isFrozen(staged), true);
    assert.equal(staged.orderId, ORDER.id);
    assert.equal(staged.userId, ORDER.userId);
    assert.equal(staged.expiresAt, '2026-07-20T12:00:00.000Z');
    assert.equal(calls.created.length, 0);

    await assert.rejects(
      service.persistStagedAsset({ order: ORDER, stagedAsset: staged }),
      (error) => error instanceof AppError && error.code === 'ASSET_TRANSACTION_REQUIRED'
    );

    const client = { transaction: 'test-client' };
    const persisted = await service.persistStagedAsset({ order: ORDER, stagedAsset: staged }, client);
    assert.equal(calls.created.length, 1);
    assert.equal(calls.created[0].client, client);
    assert.equal(persisted.id, staged.id);

    const presented = service.presentGeneratedAsset(persisted);
    assert.equal(presented.id, staged.id);
    assert.equal('storageKey' in presented, false);
    assert.equal('storage_key' in presented, false);
    assert.equal('userId' in presented, false);
    assert.equal('user_id' in presented, false);
  });

  test('rejects forged or mismatched staged assets', async () => {
    const { service } = createFixture();
    const staged = await stageAsset(service);
    const client = {};

    await assert.rejects(
      service.persistStagedAsset({ order: ORDER, stagedAsset: { ...staged } }, client),
      (error) => error instanceof AppError && error.code === 'STAGED_ASSET_INVALID'
    );
    await assert.rejects(
      service.persistStagedAsset({
        order: { ...ORDER, userId: 'user-2' },
        stagedAsset: staged
      }, client),
      (error) => error instanceof AppError && error.code === 'STAGED_ASSET_OWNERSHIP_MISMATCH'
    );
  });

  test('discards stored content when storage metadata is invalid', async () => {
    const deleted = [];
    const { service } = createFixture({
      storageAdapter: {
        async write() {
          return {
            storageKey: '00000000-0000-4000-8000-000000000002.txt',
            mimeType: 'text/plain',
            fileSize: 0,
            checksum: 'invalid'
          };
        },
        async delete(storageKey) {
          deleted.push(storageKey);
          return true;
        }
      }
    });

    await assert.rejects(
      stageAsset(service),
      (error) => error instanceof AppError && error.code === 'ASSET_STORAGE_RESULT_INVALID'
    );
    assert.deepEqual(deleted, ['00000000-0000-4000-8000-000000000002.txt']);
  });

  test('deletes expired asset records after removing private content', async () => {
    const deletedFiles = [];
    const deletedRecords = [];
    const queries = [];
    const expiredAssets = [
      { id: 'asset-1', storageKey: 'asset-1.txt' },
      { id: 'asset-2', storageKey: 'already-missing.txt' }
    ];
    const { service } = createFixture({
      storageAdapter: {
        async delete(storageKey) {
          deletedFiles.push(storageKey);
          return storageKey !== 'already-missing.txt';
        }
      },
      repository: {
        async findExpired(before, options) {
          queries.push({ before, options });
          return expiredAssets;
        },
        async deleteById(assetId) {
          deletedRecords.push(assetId);
          return true;
        }
      }
    });

    const result = await service.cleanupExpiredAssets({ limit: 25 });

    assert.deepEqual(queries, [{
      before: NOW.toISOString(),
      options: { limit: 25 }
    }]);
    assert.deepEqual(deletedFiles, ['asset-1.txt', 'already-missing.txt']);
    assert.deepEqual(deletedRecords, ['asset-1', 'asset-2']);
    assert.deepEqual(result, {
      before: NOW.toISOString(),
      scanned: 2,
      deleted: 2,
      filesDeleted: 1,
      missingContent: 1
    });
  });

  test('keeps failed records retryable while deleting the rest of the batch', async () => {
    const deletedRecords = [];
    const { service } = createFixture({
      storageAdapter: {
        async delete(storageKey) {
          if (storageKey === 'unavailable.txt') {
            const error = new Error('storage unavailable');
            error.code = 'STORAGE_UNAVAILABLE';
            throw error;
          }
          return true;
        }
      },
      repository: {
        async findExpired() {
          return [
            { id: 'asset-failed', storageKey: 'unavailable.txt' },
            { id: 'asset-deleted', storageKey: 'available.txt' }
          ];
        },
        async deleteById(assetId) {
          deletedRecords.push(assetId);
          return true;
        }
      }
    });

    await assert.rejects(
      service.cleanupExpiredAssets(),
      (error) => {
        assert.equal(error instanceof AppError, true);
        assert.equal(error.code, 'ASSET_CLEANUP_PARTIAL_FAILURE');
        assert.equal(error.details.deleted, 1);
        assert.deepEqual(error.details.failures, [{
          assetId: 'asset-failed',
          code: 'STORAGE_UNAVAILABLE'
        }]);
        assert.equal(JSON.stringify(error.details).includes('unavailable.txt'), false);
        return true;
      }
    );
    assert.deepEqual(deletedRecords, ['asset-deleted']);
  });

  test('rejects invalid cleanup bounds before querying storage metadata', async () => {
    const { service } = createFixture();

    await assert.rejects(
      service.cleanupExpiredAssets({ limit: 0 }),
      (error) => error instanceof AppError && error.code === 'ASSET_CLEANUP_LIMIT_INVALID'
    );
    await assert.rejects(
      service.cleanupExpiredAssets({ before: 'not-a-date' }),
      (error) => error instanceof AppError && error.code === 'ASSET_EXPIRY_INVALID'
    );
  });

  test('reconciles only unreferenced private files and defaults to a dry run', async () => {
    const deleted = [];
    const { service } = createFixture({
      storageAdapter: {
        async listStorageKeys() {
          return ['active.txt', 'orphan.txt'];
        },
        async delete(storageKey) {
          deleted.push(storageKey);
          return true;
        }
      },
      repository: {
        async findExistingStorageKeys() {
          return new Set(['active.txt']);
        }
      }
    });

    assert.deepEqual(await service.reconcileOrphanedAssets(), {
      dryRun: true,
      scanned: 2,
      referenced: 1,
      orphaned: 1,
      deleted: 0
    });
    assert.deepEqual(deleted, []);

    assert.deepEqual(await service.reconcileOrphanedAssets({ dryRun: false }), {
      dryRun: false,
      scanned: 2,
      referenced: 1,
      orphaned: 1,
      deleted: 1
    });
    assert.deepEqual(deleted, ['orphan.txt']);
  });
});
