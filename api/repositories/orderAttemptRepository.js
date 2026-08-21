const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapOrderAttempt(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    order_id: row.order_id,
    dispatchGeneration: row.dispatch_generation,
    dispatch_generation: row.dispatch_generation,
    attemptNumber: row.attempt_number,
    attempt_number: row.attempt_number,
    jobId: row.job_id,
    job_id: row.job_id,
    correlationId: row.correlation_id,
    correlation_id: row.correlation_id,
    lockToken: row.lock_token,
    lock_token: row.lock_token,
    status: row.status,
    startedAt: row.started_at,
    started_at: row.started_at,
    lockExpiresAt: row.lock_expires_at,
    lock_expires_at: row.lock_expires_at,
    finishedAt: row.finished_at,
    finished_at: row.finished_at,
    failureCode: row.failure_code,
    failure_code: row.failure_code,
    failureMessage: row.failure_message,
    failure_message: row.failure_message,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

async function create(data, client = db) {
  const id = data.id || randomUUID();
  const now = data.createdAt || new Date().toISOString();

  await client.run(
    `
      INSERT INTO order_attempts (
        id, order_id, dispatch_generation, attempt_number, job_id,
        correlation_id, lock_token, status, started_at, lock_expires_at,
        finished_at, failure_code, failure_message, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.orderId,
      Number(data.dispatchGeneration),
      Number(data.attemptNumber),
      data.jobId || null,
      data.correlationId,
      data.lockToken,
      data.status,
      data.startedAt || now,
      data.lockExpiresAt,
      data.finishedAt || null,
      data.failureCode || null,
      data.failureMessage || null,
      serializeJson(data.metadata || {}),
      now,
      now
    ]
  );

  return findById(id, client);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM order_attempts WHERE id = ?', [id]);
  return mapOrderAttempt(row);
}

async function findActiveByOrderId(orderId, client = db) {
  const row = await client.get(
    `
      SELECT *
      FROM order_attempts
      WHERE order_id = ? AND status = 'processing'
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [orderId]
  );
  return mapOrderAttempt(row);
}

async function findManyByOrderId(orderId, client = db) {
  const rows = await client.all(
    `
      SELECT *
      FROM order_attempts
      WHERE order_id = ?
      ORDER BY attempt_number ASC, created_at ASC
    `,
    [orderId]
  );
  return rows.map(mapOrderAttempt);
}

async function finish(data, client = db) {
  const now = data.finishedAt || new Date().toISOString();
  const result = await client.run(
    `
      UPDATE order_attempts
      SET
        status = ?,
        finished_at = ?,
        failure_code = ?,
        failure_message = ?,
        metadata_json = ?,
        updated_at = ?
      WHERE id = ? AND lock_token = ? AND status = 'processing'
    `,
    [
      data.status,
      now,
      data.failureCode || null,
      data.failureMessage || null,
      serializeJson(data.metadata || {}),
      now,
      data.id,
      data.lockToken
    ]
  );

  return result.changes === 1 ? findById(data.id, client) : null;
}

module.exports = {
  orderAttemptRepository: {
    create,
    findActiveByOrderId,
    findById,
    findManyByOrderId,
    finish
  }
};
