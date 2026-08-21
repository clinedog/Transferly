const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { storageConfig } = require('../config/storageConfig');
const { AppError } = require('../utils/errors');

const DEFAULT_MIME_EXTENSIONS = Object.freeze({
  'application/json': 'json',
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'text/html': 'html',
  'text/plain': 'txt'
});

const STORAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,12}$/;

function checksum(content) {
  return createHash('sha256').update(content).digest('hex');
}

function toBuffer(content) {
  if (Buffer.isBuffer(content) || content instanceof Uint8Array || typeof content === 'string') {
    return Buffer.from(content);
  }

  throw new AppError(400, 'ASSET_CONTENT_INVALID', 'Asset content must be a string or byte buffer.');
}

class LocalPrivateStorageAdapter {
  constructor(options = {}) {
    this.rootPath = path.resolve(options.rootPath || storageConfig.generatedAssetRoot);
    this.maxAssetBytes = Number(options.maxAssetBytes || storageConfig.maxAssetBytes);
    this.mimeExtensions = Object.freeze({
      ...DEFAULT_MIME_EXTENSIONS,
      ...(options.mimeExtensions || {})
    });

    if (!Number.isSafeInteger(this.maxAssetBytes) || this.maxAssetBytes <= 0) {
      throw new AppError(500, 'ASSET_STORAGE_CONFIG_INVALID', 'Asset storage size limit is invalid.');
    }
  }

  extensionForMimeType(mimeType, requestedExtension) {
    const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
    const extension = this.mimeExtensions[normalizedMimeType];
    if (!extension) {
      throw new AppError(415, 'ASSET_MIME_TYPE_UNSUPPORTED', 'Asset MIME type is not allowed.');
    }

    const normalizedRequestedExtension = String(requestedExtension || '').trim().toLowerCase();
    if (normalizedRequestedExtension && normalizedRequestedExtension !== extension) {
      throw new AppError(400, 'ASSET_EXTENSION_MISMATCH', 'Asset extension does not match its MIME type.');
    }

    return { extension, mimeType: normalizedMimeType };
  }

  resolveStorageKey(storageKey) {
    const normalizedKey = String(storageKey || '').trim().toLowerCase();
    if (!STORAGE_KEY_PATTERN.test(normalizedKey)) {
      throw new AppError(400, 'ASSET_STORAGE_KEY_INVALID', 'Asset storage key is invalid.');
    }

    const targetPath = path.resolve(this.rootPath, normalizedKey);
    if (!targetPath.startsWith(`${this.rootPath}${path.sep}`)) {
      throw new AppError(400, 'ASSET_STORAGE_KEY_INVALID', 'Asset storage key is invalid.');
    }

    return { storageKey: normalizedKey, targetPath };
  }

  async write(input) {
    const content = toBuffer(input?.content);
    if (content.length === 0) {
      throw new AppError(400, 'ASSET_CONTENT_EMPTY', 'Asset content cannot be empty.');
    }
    if (content.length > this.maxAssetBytes) {
      throw new AppError(413, 'ASSET_CONTENT_TOO_LARGE', 'Asset exceeds the configured size limit.');
    }

    const { extension, mimeType } = this.extensionForMimeType(input?.mimeType, input?.extension);
    const storageKey = `${randomUUID()}.${extension}`;
    const { targetPath } = this.resolveStorageKey(storageKey);
    const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;

    await fs.mkdir(this.rootPath, { mode: 0o700, recursive: true });
    try {
      await fs.writeFile(temporaryPath, content, { flag: 'wx', mode: 0o600 });
      await fs.rename(temporaryPath, targetPath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw new AppError(500, 'ASSET_STORAGE_WRITE_FAILED', 'Asset could not be stored privately.', {
        cause: error.code || error.name
      });
    }

    return {
      storageKey,
      mimeType,
      fileSize: content.length,
      checksum: checksum(content)
    };
  }

  async read(storageKey, expected = {}) {
    const resolved = this.resolveStorageKey(storageKey);
    let content;
    try {
      content = await fs.readFile(resolved.targetPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'ASSET_CONTENT_NOT_FOUND', 'Stored asset content was not found.');
      }
      throw new AppError(500, 'ASSET_STORAGE_READ_FAILED', 'Stored asset content could not be read.');
    }

    const actualChecksum = checksum(content);
    if (expected.fileSize !== undefined && Number(expected.fileSize) !== content.length) {
      throw new AppError(409, 'ASSET_INTEGRITY_CHECK_FAILED', 'Stored asset size does not match its record.');
    }
    if (expected.checksum && expected.checksum !== actualChecksum) {
      throw new AppError(409, 'ASSET_INTEGRITY_CHECK_FAILED', 'Stored asset checksum does not match its record.');
    }

    return {
      content,
      fileSize: content.length,
      checksum: actualChecksum
    };
  }

  async delete(storageKey) {
    const { targetPath } = this.resolveStorageKey(storageKey);
    try {
      await fs.unlink(targetPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw new AppError(500, 'ASSET_STORAGE_DELETE_FAILED', 'Stored asset content could not be deleted.');
    }
  }

  async listStorageKeys(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit || 100), 1), 500);
    let entries;
    try {
      entries = await fs.readdir(this.rootPath, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new AppError(500, 'ASSET_STORAGE_LIST_FAILED', 'Stored assets could not be listed privately.');
    }

    return entries
      .filter((entry) => entry.isFile() && STORAGE_KEY_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .slice(0, limit);
  }
}

function createLocalPrivateStorageAdapter(options) {
  return new LocalPrivateStorageAdapter(options);
}

module.exports = {
  DEFAULT_MIME_EXTENSIONS,
  LocalPrivateStorageAdapter,
  createLocalPrivateStorageAdapter
};
