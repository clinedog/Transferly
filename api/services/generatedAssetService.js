const { createHmac } = require('node:crypto');

const { DEFAULT_MIME_EXTENSIONS, createLocalPrivateStorageAdapter } = require('../adapters/storageAdapter');
const config = require('../config');
const { assertAssetNotExpired, assertAssetOwnedByUser } = require('../policies/assetPolicy');
const { generatedAssetRepository } = require('../repositories/generatedAssetRepository');
const { orderRepository } = require('../repositories/orderRepository');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { signJwt, verifyJwt } = require('../utils/jwt');
const { auditLogService } = require('./auditLogService');
const { presentGeneratedAsset } = require('./assetStorageService');

const DOWNLOAD_TOKEN_PURPOSE = 'generated_asset_download';
const DOWNLOAD_SECRET_CONTEXT = 'transferly-generated-asset-download-v1';
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;

function deriveDownloadSecret(jwtSecret) {
  return createHmac('sha256', jwtSecret)
    .update(DOWNLOAD_SECRET_CONTEXT)
    .digest();
}

function resolveCurrentTime(now) {
  const currentTime = now();
  if (!(currentTime instanceof Date) || Number.isNaN(currentTime.getTime())) {
    throw new AppError(500, 'ASSET_CLOCK_INVALID', 'Asset access clock returned an invalid timestamp.');
  }
  return currentTime;
}

function assertOrderOwnedByUser(order, userId) {
  if (!order || !userId || order.userId !== userId) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  return order;
}

function sanitizeFilePart(value, fallback) {
  const sanitized = String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return sanitized || fallback;
}

function createDownloadFileName(asset) {
  const extension = DEFAULT_MIME_EXTENSIONS[asset.mimeType] || 'bin';
  const assetType = sanitizeFilePart(asset.assetType, 'asset');
  const assetId = sanitizeFilePart(asset.id, 'download');
  return `transferly-${assetType}-${assetId}.${extension}`;
}

function createGeneratedAssetService(options = {}) {
  const repository = options.generatedAssetRepository || generatedAssetRepository;
  const orders = options.orderRepository || orderRepository;
  const storage = options.storageAdapter || createLocalPrivateStorageAdapter();
  const audit = options.auditLogService || auditLogService;
  const now = options.now || (() => new Date());
  const appBaseUrl = options.appBaseUrl || config.APP_BASE_URL;
  const downloadTtlSeconds = options.downloadTtlSeconds || config.GENERATED_ASSET_DOWNLOAD_TTL_SECONDS;
  const downloadSecret = options.downloadSecret || deriveDownloadSecret(config.JWT_SECRET);

  async function getOwnedAsset(assetId, userId) {
    const asset = await repository.findById(assetId);
    return assertAssetOwnedByUser(asset, userId);
  }

  async function listOrderAssets(input) {
    const order = await orders.findById(input.orderId);
    assertOrderOwnedByUser(order, input.userId);
    const assets = await repository.findManyByOrderIdForUser(order.id, input.userId);
    return {
      assets: assets.map(presentGeneratedAsset)
    };
  }

  async function getAsset(input) {
    const asset = await getOwnedAsset(input.assetId, input.userId);
    return {
      asset: presentGeneratedAsset(asset)
    };
  }

  async function issueDownloadUrl(input) {
    const currentTime = resolveCurrentTime(now);
    const asset = await getOwnedAsset(input.assetId, input.userId);
    assertAssetNotExpired(asset, currentTime);

    const assetExpiry = asset.expiresAt ? new Date(asset.expiresAt).getTime() : Number.POSITIVE_INFINITY;
    const configuredExpiry = currentTime.getTime() + (downloadTtlSeconds * 1000);
    const effectiveExpiry = Math.min(assetExpiry, configuredExpiry);
    const effectiveTtlSeconds = Math.max(1, Math.ceil((effectiveExpiry - currentTime.getTime()) / 1000));
    const token = signJwt(
      {
        purpose: DOWNLOAD_TOKEN_PURPOSE,
        asset_id: asset.id,
        checksum: asset.checksum
      },
      downloadSecret,
      effectiveTtlSeconds
    );
    const downloadUrl = new URL(`/api/assets/${encodeURIComponent(asset.id)}/download`, appBaseUrl);
    downloadUrl.searchParams.set('token', token);

    await audit.log({
      actorType: AUDIT_ACTOR_TYPE.USER,
      actorId: input.userId,
      action: 'generated_asset.download_url_issued',
      entityType: 'generated_asset',
      entityId: asset.id,
      metadata: {
        orderId: asset.orderId,
        classification: asset.classification,
        expiresAt: new Date(effectiveExpiry).toISOString()
      }
    });

    return {
      asset: presentGeneratedAsset(asset),
      download_url: downloadUrl.toString(),
      expires_at: new Date(effectiveExpiry).toISOString()
    };
  }

  async function downloadAsset(input) {
    let payload;
    try {
      payload = verifyJwt(input.token, downloadSecret, { clockSkewSeconds: 0 });
    } catch (_error) {
      throw new AppError(401, 'ASSET_DOWNLOAD_TOKEN_INVALID', 'Asset download authorization is invalid or expired.');
    }

    if (
      payload.purpose !== DOWNLOAD_TOKEN_PURPOSE ||
      payload.asset_id !== input.assetId ||
      !CHECKSUM_PATTERN.test(String(payload.checksum || ''))
    ) {
      throw new AppError(401, 'ASSET_DOWNLOAD_TOKEN_INVALID', 'Asset download authorization is invalid or expired.');
    }

    const asset = await repository.findById(input.assetId);
    if (!asset) {
      throw new AppError(404, 'ASSET_NOT_FOUND', 'Generated asset not found.');
    }
    if (asset.checksum !== payload.checksum) {
      throw new AppError(401, 'ASSET_DOWNLOAD_TOKEN_INVALID', 'Asset download authorization is invalid or expired.');
    }
    assertAssetNotExpired(asset, resolveCurrentTime(now));

    const stored = await storage.read(asset.storageKey, {
      fileSize: asset.fileSize,
      checksum: asset.checksum
    });
    return {
      asset: presentGeneratedAsset(asset),
      content: stored.content,
      fileName: createDownloadFileName(asset)
    };
  }

  return Object.freeze({
    downloadAsset,
    getAsset,
    issueDownloadUrl,
    listOrderAssets
  });
}

const generatedAssetService = createGeneratedAssetService();

module.exports = {
  createGeneratedAssetService,
  generatedAssetService
};
