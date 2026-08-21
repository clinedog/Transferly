const { AppError } = require('../utils/errors');

function assertAssetOwnedByUser(asset, userId) {
  if (!asset || !userId || asset.userId !== userId) {
    throw new AppError(404, 'ASSET_NOT_FOUND', 'Generated asset not found.');
  }

  return asset;
}

function assertAssetNotExpired(asset, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new AppError(500, 'ASSET_CLOCK_INVALID', 'Asset access clock returned an invalid timestamp.');
  }

  if (!asset.expiresAt) {
    return asset;
  }

  const expiresAt = new Date(asset.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new AppError(500, 'ASSET_EXPIRY_INVALID', 'Generated asset expiry is invalid.');
  }

  if (expiresAt.getTime() <= now.getTime()) {
    throw new AppError(410, 'ASSET_EXPIRED', 'Generated asset has expired.');
  }

  return asset;
}

module.exports = {
  assertAssetNotExpired,
  assertAssetOwnedByUser
};
