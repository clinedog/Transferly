const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

const OUTBOX_STATUS = Object.freeze({
  PENDING: 'pending',
  LEASED: 'leased',
  DISPATCHED: 'dispatched',
  FAILED: 'failed'
});

function mapOutboxEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    semanticKey: row.semantic_key,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    queueName: row.queue_name,
    jobName: row.job_name,
    payload: parseJson(row.payload_json, {}),
    status: row.status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    leaseToken: row.lease_token,
    leaseExpiresAt: row.lease_expires_at,
    fenceToken: row.fence_token,
    queueJobId: row.queue_job_id,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    correlationId: row.correlation_id,
    dispatchedAt: row.dispatched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function canonicalJson(value) {
  return serializeJson(canonicalize(value));
}

async function findById(id, client = db) {
  return mapOutboxEvent(await client.get('SELECT * FROM outbox_events WHERE id = ?', [id]));
}

async function findBySemanticKey(semanticKey, client = db) {
  return mapOutboxEvent(await client.get(
    'SELECT * FROM outbox_events WHERE semantic_key = ?',
    [semanticKey]
  ));
}

async function findMany(options = {}, client = db) {
  const params = [];
  const conditions = [];
  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  if (options.aggregateType) {
    conditions.push('aggregate_type = ?');
    params.push(options.aggregateType);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.max(1, Math.min(Number(options.limit) || 50, 100)));
  const rows = await client.all(
    `SELECT * FROM outbox_events ${where} ORDER BY created_at DESC LIMIT ?`,
    params
  );
  return rows.map(mapOutboxEvent);
}

async function getStatusSummary(client = db) {
  const rows = await client.all(
    'SELECT status, COUNT(*) AS count FROM outbox_events GROUP BY status'
  );
  const summary = Object.fromEntries(Object.values(OUTBOX_STATUS).map((status) => [status, 0]));
  for (const row of rows) summary[row.status] = Number(row.count || 0);
  return summary;
}

function semanticFieldsMatch(existing, data) {
  return existing.eventType === data.eventType &&
    existing.aggregateType === data.aggregateType &&
    existing.aggregateId === data.aggregateId &&
    existing.queueName === data.queueName &&
    existing.jobName === data.jobName &&
    canonicalJson(existing.payload) === canonicalJson(data.payload || {}) &&
    existing.correlationId === data.correlationId;
}

async function createOrGet(data, client = db) {
  const existing = await findBySemanticKey(data.semanticKey, client);
  if (existing) {
    if (!semanticFieldsMatch(existing, data)) {
      const error = new Error(`Outbox semantic key ${data.semanticKey} was reused with different details.`);
      error.code = 'OUTBOX_SEMANTIC_CONFLICT';
      throw error;
    }
    return existing;
  }

  const id = data.id || randomUUID();
  const now = data.createdAt || new Date().toISOString();
  await client.run(
    `INSERT INTO outbox_events (
      id, semantic_key, event_type, aggregate_type, aggregate_id, queue_name,
      job_name, payload_json, status, max_attempts, next_attempt_at,
      correlation_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.semanticKey, data.eventType, data.aggregateType, data.aggregateId,
      data.queueName, data.jobName, serializeJson(data.payload || {}), OUTBOX_STATUS.PENDING,
      Number(data.maxAttempts || 10), data.nextAttemptAt || now,
      data.correlationId, now, now
    ]
  );
  return findById(id, client);
}

async function claimNext(data, client = db) {
  const candidate = await client.get(
    `SELECT id FROM outbox_events
     WHERE attempt_count < max_attempts AND (
       (status = ? AND next_attempt_at <= ?)
       OR (status = ? AND lease_expires_at <= ?)
     )
     ORDER BY created_at ASC LIMIT 1`,
    [OUTBOX_STATUS.PENDING, data.now, OUTBOX_STATUS.LEASED, data.now]
  );
  if (!candidate) return null;

  const result = await client.run(
    `UPDATE outbox_events SET
       status = ?, lease_token = ?, lease_expires_at = ?,
       fence_token = fence_token + 1, attempt_count = attempt_count + 1, updated_at = ?
     WHERE id = ? AND attempt_count < max_attempts AND (
       (status = ? AND next_attempt_at <= ?)
       OR (status = ? AND lease_expires_at <= ?)
     )`,
    [
      OUTBOX_STATUS.LEASED, data.leaseToken, data.leaseExpiresAt, data.now, candidate.id,
      OUTBOX_STATUS.PENDING, data.now, OUTBOX_STATUS.LEASED, data.now
    ]
  );
  return result.changes === 1 ? findById(candidate.id, client) : null;
}

async function claimById(data, client = db) {
  const result = await client.run(
    `UPDATE outbox_events SET
       status = ?, lease_token = ?, lease_expires_at = ?,
       fence_token = fence_token + 1, attempt_count = attempt_count + 1, updated_at = ?
     WHERE id = ? AND attempt_count < max_attempts AND (
       (status = ? AND next_attempt_at <= ?)
       OR (status = ? AND lease_expires_at <= ?)
     )`,
    [
      OUTBOX_STATUS.LEASED, data.leaseToken, data.leaseExpiresAt, data.now, data.id,
      OUTBOX_STATUS.PENDING, data.now, OUTBOX_STATUS.LEASED, data.now
    ]
  );
  return result.changes === 1 ? findById(data.id, client) : null;
}

async function markDispatched(data, client = db) {
  const result = await client.run(
    `UPDATE outbox_events SET
       status = ?, queue_job_id = ?, dispatched_at = ?, lease_token = NULL,
       lease_expires_at = NULL, last_error_code = NULL, last_error_message = NULL, updated_at = ?
     WHERE id = ? AND status = ? AND lease_token = ? AND fence_token = ?`,
    [
      OUTBOX_STATUS.DISPATCHED, String(data.queueJobId), data.dispatchedAt, data.dispatchedAt,
      data.id, OUTBOX_STATUS.LEASED, data.leaseToken, data.fenceToken
    ]
  );
  return result.changes === 1 ? findById(data.id, client) : null;
}

async function markFailedAttempt(data, client = db) {
  const event = await findById(data.id, client);
  if (!event || event.status !== OUTBOX_STATUS.LEASED ||
      event.leaseToken !== data.leaseToken || event.fenceToken !== data.fenceToken) {
    return null;
  }
  const status = event.attemptCount >= event.maxAttempts ? OUTBOX_STATUS.FAILED : OUTBOX_STATUS.PENDING;
  const result = await client.run(
    `UPDATE outbox_events SET
       status = ?, next_attempt_at = ?, lease_token = NULL, lease_expires_at = NULL,
       last_error_code = ?, last_error_message = ?, updated_at = ?
     WHERE id = ? AND status = ? AND lease_token = ? AND fence_token = ?`,
    [
      status, data.nextAttemptAt, data.errorCode || null, data.errorMessage,
      data.failedAt, data.id, OUTBOX_STATUS.LEASED, data.leaseToken, data.fenceToken
    ]
  );
  return result.changes === 1 ? findById(data.id, client) : null;
}

async function resetFailedForReplay(data, client = db) {
  const result = await client.run(
    `UPDATE outbox_events SET
       status = ?, attempt_count = 0, next_attempt_at = ?,
       lease_token = NULL, lease_expires_at = NULL, queue_job_id = NULL,
       last_error_code = NULL, last_error_message = NULL, dispatched_at = NULL,
       updated_at = ?
     WHERE id = ? AND status = ?`,
    [OUTBOX_STATUS.PENDING, data.replayedAt, data.replayedAt, data.id, OUTBOX_STATUS.FAILED]
  );
  return result.changes === 1 ? findById(data.id, client) : null;
}

module.exports = {
  OUTBOX_STATUS,
  mapOutboxEvent,
  outboxEventRepository: {
    claimById,
    claimNext,
    createOrGet,
    findById,
    findMany,
    findBySemanticKey,
    getStatusSummary,
    markDispatched,
    markFailedAttempt,
    resetFailedForReplay
  }
};