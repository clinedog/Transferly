const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { DEAD_LETTER_STATUS } = require('../utils/constants');
const { parseJson, serializeJson } = require('../utils/records');

function mapDeadLetterRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    sourceKey: row.source_key,
    sourceQueue: row.source_queue,
    sourceJobId: row.source_job_id,
    deadLetterJobId: row.dead_letter_job_id,
    jobName: row.job_name,
    payload: parseJson(row.payload_json, {}),
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    failureClassification: row.failure_classification,
    retryable: row.retryable === 1,
    attemptsMade: row.attempts_made,
    status: row.status,
    correlationId: row.correlation_id,
    failedAt: row.failed_at,
    recoveryStartedAt: row.recovery_started_at,
    recoveryToken: row.recovery_token,
    recoveredAt: row.recovered_at,
    recoveredByActorId: row.recovered_by_actor_id,
    recoveryNote: row.recovery_note,
    recoveryJobId: row.recovery_job_id,
    recoveryJobName: row.recovery_job_name,
    lastRecoveryError: row.last_recovery_error,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createOrGet(data, client = db) {
  const id = data.id || randomUUID();
  const now = data.createdAt || new Date().toISOString();

  await client.run(
    `
      INSERT INTO dead_letter_records (
        id, source_key, source_queue, source_job_id, dead_letter_job_id,
        job_name, payload_json, failure_code, failure_message,
        failure_classification, retryable, attempts_made, status,
        correlation_id, failed_at, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_key) DO NOTHING
    `,
    [
      id,
      data.sourceKey,
      data.sourceQueue,
      data.sourceJobId || null,
      data.deadLetterJobId || null,
      data.jobName,
      serializeJson(data.payload || {}),
      data.failureCode || null,
      data.failureMessage,
      data.failureClassification,
      data.retryable ? 1 : 0,
      Number(data.attemptsMade || 0),
      data.status || DEAD_LETTER_STATUS.OPEN,
      data.correlationId || null,
      data.failedAt || now,
      serializeJson(data.metadata || {}),
      now,
      now
    ]
  );

  return findBySourceKey(data.sourceKey, client);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM dead_letter_records WHERE id = ?', [id]);
  return mapDeadLetterRecord(row);
}

async function findBySourceKey(sourceKey, client = db) {
  const row = await client.get('SELECT * FROM dead_letter_records WHERE source_key = ?', [sourceKey]);
  return mapDeadLetterRecord(row);
}

async function findByIdentifier(identifier, client = db) {
  const row = await client.get(
    'SELECT * FROM dead_letter_records WHERE id = ? OR dead_letter_job_id = ? LIMIT 1',
    [identifier, identifier]
  );
  return mapDeadLetterRecord(row);
}

async function findMany(limit = 50, client = db) {
  const rows = await client.all(
    `
      SELECT *
      FROM dead_letter_records
      ORDER BY failed_at DESC, created_at DESC
      LIMIT ?
    `,
    [Math.max(1, Math.min(Number(limit) || 50, 100))]
  );
  return rows.map(mapDeadLetterRecord);
}

async function attachDeadLetterJob(id, deadLetterJobId, client = db) {
  const now = new Date().toISOString();
  await client.run(
    `
      UPDATE dead_letter_records
      SET dead_letter_job_id = COALESCE(dead_letter_job_id, ?), updated_at = ?
      WHERE id = ?
    `,
    [String(deadLetterJobId), now, id]
  );
  return findById(id, client);
}

async function claimRecovery(data, client = db) {
  const result = await client.run(
    `
      UPDATE dead_letter_records
      SET
        status = ?,
        recovery_started_at = ?,
        recovery_token = ?,
        recovered_by_actor_id = ?,
        recovery_note = ?,
        last_recovery_error = NULL,
        updated_at = ?
      WHERE id = ? AND (
        status IN (?, ?)
        OR (
          status = ?
          AND (recovery_started_at IS NULL OR recovery_started_at <= ?)
        )
      )
    `,
    [
      DEAD_LETTER_STATUS.RECOVERY_PENDING,
      data.startedAt,
      data.recoveryToken,
      data.adminActorId || null,
      data.note || null,
      data.startedAt,
      data.id,
      DEAD_LETTER_STATUS.OPEN,
      DEAD_LETTER_STATUS.RECOVERY_FAILED,
      DEAD_LETTER_STATUS.RECOVERY_PENDING,
      data.staleBefore
    ]
  );

  return result.changes === 1 ? findById(data.id, client) : null;
}

async function markRecovered(data, client = db) {
  const result = await client.run(
    `
      UPDATE dead_letter_records
      SET
        status = ?,
        recovered_at = ?,
        recovery_job_id = ?,
        recovery_job_name = ?,
        last_recovery_error = NULL,
        updated_at = ?
      WHERE id = ? AND recovery_token = ? AND status = ?
    `,
    [
      DEAD_LETTER_STATUS.RECOVERED,
      data.recoveredAt,
      String(data.recoveryJobId),
      data.recoveryJobName,
      data.recoveredAt,
      data.id,
      data.recoveryToken,
      DEAD_LETTER_STATUS.RECOVERY_PENDING
    ]
  );

  return result.changes === 1 ? findById(data.id, client) : null;
}

async function markRecoveryFailed(data, client = db) {
  const now = data.failedAt || new Date().toISOString();
  const result = await client.run(
    `
      UPDATE dead_letter_records
      SET status = ?, last_recovery_error = ?, updated_at = ?
      WHERE id = ? AND recovery_token = ? AND status = ?
    `,
    [
      DEAD_LETTER_STATUS.RECOVERY_FAILED,
      data.errorMessage,
      now,
      data.id,
      data.recoveryToken,
      DEAD_LETTER_STATUS.RECOVERY_PENDING
    ]
  );

  return result.changes === 1 ? findById(data.id, client) : null;
}

module.exports = {
  deadLetterRepository: {
    attachDeadLetterJob,
    claimRecovery,
    createOrGet,
    findById,
    findByIdentifier,
    findBySourceKey,
    findMany,
    markRecovered,
    markRecoveryFailed
  },
  mapDeadLetterRecord
};
