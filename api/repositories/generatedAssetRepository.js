const { randomUUID } = require('node:crypto');

const { db } = require('../db');

function mapGeneratedAsset(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    order_id: row.order_id,
    userId: row.user_id,
    user_id: row.user_id,
    assetType: row.asset_type,
    asset_type: row.asset_type,
    storageKey: row.storage_key,
    storage_key: row.storage_key,
    mimeType: row.mime_type,
    mime_type: row.mime_type,
    fileSize: row.file_size,
    file_size: row.file_size,
    checksum: row.checksum,
    classification: row.classification,
    expiresAt: row.expires_at,
    expires_at: row.expires_at,
    createdAt: row.created_at,
    created_at: row.created_at
  };
}

async function create(input, client = db) {
  const id = input.id || randomUUID();
  const createdAt = input.createdAt || new Date().toISOString();

  await client.run(
    `
      INSERT INTO generated_assets (
        id, order_id, user_id, asset_type, storage_key, mime_type, file_size,
        checksum, classification, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.orderId,
      input.userId,
      input.assetType,
      input.storageKey,
      input.mimeType,
      Number(input.fileSize),
      input.checksum,
      input.classification,
      input.expiresAt || null,
      createdAt
    ]
  );

  return findById(id, client);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM generated_assets WHERE id = ?', [id]);
  return mapGeneratedAsset(row);
}

async function findByIdForUser(id, userId, client = db) {
  const row = await client.get(
    'SELECT * FROM generated_assets WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return mapGeneratedAsset(row);
}

async function findManyByOrderIdForUser(orderId, userId, client = db) {
  const rows = await client.all(
    `
      SELECT *
      FROM generated_assets
      WHERE order_id = ? AND user_id = ?
      ORDER BY created_at ASC
    `,
    [orderId, userId]
  );
  return rows.map(mapGeneratedAsset);
}

async function findExpired(before, options = {}, client = db) {
  const limit = Math.min(Math.max(Number(options.limit || 100), 1), 500);
  const rows = await client.all(
    `
      SELECT *
      FROM generated_assets
      WHERE expires_at IS NOT NULL AND expires_at <= ?
      ORDER BY expires_at ASC
      LIMIT ?
    `,
    [before, limit]
  );
  return rows.map(mapGeneratedAsset);
}

async function findExistingStorageKeys(storageKeys, client = db) {
  const uniqueKeys = [...new Set(storageKeys || [])];
  if (uniqueKeys.length === 0) {
    return new Set();
  }
  if (uniqueKeys.length > 500) {
    throw new RangeError('At most 500 storage keys can be reconciled at once.');
  }
  const rows = await client.all(
    `SELECT storage_key FROM generated_assets WHERE storage_key IN (${uniqueKeys.map(() => '?').join(', ')})`,
    uniqueKeys
  );
  return new Set(rows.map((row) => row.storage_key));
}

async function deleteById(id, client = db) {
  const result = await client.run('DELETE FROM generated_assets WHERE id = ?', [id]);
  return result.changes > 0;
}

module.exports = {
  generatedAssetRepository: {
    create,
    deleteById,
    findById,
    findByIdForUser,
    findExpired,
    findExistingStorageKeys,
    findManyByOrderIdForUser
  }
};
