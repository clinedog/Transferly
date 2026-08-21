const { createHash, randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return serializeJson(canonicalize(value));
}

function payloadHash(payload) {
  return createHash('sha256').update(canonicalJson(payload || {})).digest('hex');
}

function mapRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    semanticKey: row.semantic_key,
    provider: row.provider,
    operationType: row.operation_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    source: row.source,
    providerResourceType: row.provider_resource_type,
    providerResourceId: row.provider_resource_id,
    providerStatus: row.provider_status,
    payload: parseJson(row.payload_json, {}),
    payloadHash: row.payload_hash,
    correlationId: row.correlation_id,
    receivedAt: row.received_at,
    consumedAt: row.consumed_at,
    consumedBy: row.consumed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findById(id, client = db) {
  return mapRecord(await client.get('SELECT * FROM provider_operation_inbox WHERE id = ?', [id]));
}

async function findBySemanticKey(semanticKey, client = db) {
  return mapRecord(await client.get(
    'SELECT * FROM provider_operation_inbox WHERE semantic_key = ?',
    [semanticKey]
  ));
}

function semanticFieldsMatch(existing, data, hash) {
  return existing.provider === data.provider &&
    existing.operationType === data.operationType &&
    existing.aggregateType === data.aggregateType &&
    existing.aggregateId === data.aggregateId &&
    existing.source === data.source &&
    existing.providerResourceType === (data.providerResourceType || null) &&
    existing.providerResourceId === (data.providerResourceId || null) &&
    existing.providerStatus === (data.providerStatus || null) &&
    existing.payloadHash === hash &&
    existing.correlationId === data.correlationId;
}

async function createOrGet(data, client = db) {
  const hash = payloadHash(data.payload);
  const existing = await findBySemanticKey(data.semanticKey, client);
  if (existing) {
    if (!semanticFieldsMatch(existing, data, hash)) {
      const error = new Error(`Provider inbox semantic key ${data.semanticKey} was reused with different details.`);
      error.code = 'PROVIDER_INBOX_SEMANTIC_CONFLICT';
      throw error;
    }
    return existing;
  }

  const id = data.id || randomUUID();
  const now = data.receivedAt || new Date().toISOString();
  await client.run(
    `INSERT INTO provider_operation_inbox (
      id, semantic_key, provider, operation_type, aggregate_type, aggregate_id,
      source, provider_resource_type, provider_resource_id, provider_status,
      payload_json, payload_hash, correlation_id, received_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.semanticKey, data.provider, data.operationType, data.aggregateType,
      data.aggregateId, data.source, data.providerResourceType || null,
      data.providerResourceId || null, data.providerStatus || null,
      canonicalJson(data.payload || {}), hash, data.correlationId, now, now, now
    ]
  );
  return findById(id, client);
}

async function findUnconsumed(options = {}, client = db) {
  const params = [];
  const conditions = ['consumed_at IS NULL'];
  if (options.provider) {
    conditions.push('provider = ?');
    params.push(options.provider);
  }
  if (options.aggregateType) {
    conditions.push('aggregate_type = ?');
    params.push(options.aggregateType);
  }
  params.push(Math.max(1, Math.min(Number(options.limit) || 50, 100)));
  const rows = await client.all(
    `SELECT * FROM provider_operation_inbox
     WHERE ${conditions.join(' AND ')}
     ORDER BY received_at ASC LIMIT ?`,
    params
  );
  return rows.map(mapRecord);
}

async function markConsumed(data, client = db) {
  const result = await client.run(
    `UPDATE provider_operation_inbox
     SET consumed_at = ?, consumed_by = ?, updated_at = ?
     WHERE id = ? AND consumed_at IS NULL`,
    [data.consumedAt, data.consumedBy, data.consumedAt, data.id]
  );
  return result.changes === 1 ? findById(data.id, client) : null;
}

module.exports = {
  canonicalJson,
  payloadHash,
  providerOperationInboxRepository: {
    createOrGet,
    findById,
    findBySemanticKey,
    findUnconsumed,
    markConsumed
  }
};