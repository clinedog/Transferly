const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapIdempotencyRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    idempotencyKey: row.idempotency_key,
    operation: row.operation,
    requestHash: row.request_hash,
    responseStatus: row.response_status,
    responsePayload: parseJson(row.response_payload, null),
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

async function create(data, client = db) {
  const id = data.id || randomUUID();
  const createdAt = data.createdAt || new Date().toISOString();

  await client.run(
    `
      INSERT INTO idempotency_records (
        id, user_id, idempotency_key, operation, request_hash,
        response_status, response_payload, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.userId,
      data.idempotencyKey,
      data.operation,
      data.requestHash,
      data.responseStatus ?? null,
      serializeJson(data.responsePayload),
      data.expiresAt || null,
      createdAt
    ]
  );

  return findByUserOperationAndKey(data.userId, data.operation, data.idempotencyKey, client);
}

async function findByUserOperationAndKey(userId, operation, idempotencyKey, client = db) {
  const row = await client.get(
    `
      SELECT *
      FROM idempotency_records
      WHERE user_id = ? AND operation = ? AND idempotency_key = ?
    `,
    [userId, operation, idempotencyKey]
  );
  return mapIdempotencyRecord(row);
}

module.exports = {
  idempotencyRepository: {
    create,
    findByUserOperationAndKey
  }
};
