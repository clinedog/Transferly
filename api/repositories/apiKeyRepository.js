'use strict';

const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapApiKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id || null,
    name: row.name,
    keyPrefix: row.key_prefix,
    secretHash: row.secret_hash,
    scopes: parseJson(row.scopes_json, []),
    status: row.status,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    rotatedFromId: row.rotated_from_id
  };
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();
  await client.run(
    `INSERT INTO api_keys
      (id, user_id, organization_id, name, key_prefix, secret_hash, scopes_json, status, created_at, rotated_from_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [id, data.userId, data.organizationId || null, data.name, data.keyPrefix, data.secretHash, serializeJson(data.scopes), now, data.rotatedFromId || null]
  );
  return findById(id, client);
}

async function findById(id, client = db) {
  return mapApiKey(await client.get('SELECT * FROM api_keys WHERE id = ?', [id]));
}

async function findBySecretHash(secretHash, client = db) {
  return mapApiKey(await client.get(
    `SELECT * FROM api_keys WHERE secret_hash = ? AND status = 'active'`,
    [secretHash]
  ));
}

async function listForUser(userId, organizationId = null, client = db) {
  const rows = await client.all(
    `SELECT * FROM api_keys
      WHERE user_id = ? AND (? IS NULL OR organization_id = ?)
      ORDER BY created_at DESC`,
    [userId, organizationId, organizationId]
  );
  return rows.map(mapApiKey);
}

async function markUsed(id, client = db) {
  await client.run(
    `UPDATE api_keys SET last_used_at = ? WHERE id = ? AND status = 'active'`,
    [new Date().toISOString(), id]
  );
}

async function revoke(id, userId, organizationId = null, client = db) {
  const result = await client.run(
    `UPDATE api_keys SET status = 'revoked', revoked_at = ?
     WHERE id = ? AND user_id = ? AND (? IS NULL OR organization_id = ?) AND status = 'active'`,
    [new Date().toISOString(), id, userId, organizationId, organizationId]
  );
  return result.changes === 1;
}

module.exports = { apiKeyRepository: { create, findById, findBySecretHash, listForUser, markUsed, revoke } };
