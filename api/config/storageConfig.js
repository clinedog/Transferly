const path = require('node:path');

const DEFAULT_MAX_ASSET_BYTES = 10 * 1024 * 1024;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const storageConfig = Object.freeze({
  generatedAssetRoot: path.resolve(
    process.env.GENERATED_ASSET_STORAGE_PATH || path.join(__dirname, '..', 'data', 'generated-assets')
  ),
  maxAssetBytes: positiveInteger(process.env.GENERATED_ASSET_MAX_BYTES, DEFAULT_MAX_ASSET_BYTES)
});

module.exports = {
  DEFAULT_MAX_ASSET_BYTES,
  storageConfig
};
