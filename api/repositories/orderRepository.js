const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapOrder(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    user_id: row.user_id,
    idempotencyKey: row.idempotency_key,
    idempotency_key: row.idempotency_key,
    serviceId: row.service_id,
    service_id: row.service_id,
    serviceSlug: row.service_slug,
    service_slug: row.service_slug,
    serviceTemplateId: row.service_template_id,
    service_template_id: row.service_template_id,
    serviceTemplateKey: row.service_template_key,
    service_template_key: row.service_template_key,
    status: row.status,
    pointCost: row.point_cost,
    point_cost: row.point_cost,
    pointReservationId: row.point_reservation_id,
    point_reservation_id: row.point_reservation_id,
    input: parseJson(row.input_json, {}),
    output: parseJson(row.output_json, {}),
    metadata: parseJson(row.metadata_json, {}),
    failureCode: row.failure_code,
    failure_code: row.failure_code,
    failureMessage: row.failure_message,
    failure_message: row.failure_message,
    queueStatus: row.queue_status,
    queue_status: row.queue_status,
    attemptCount: row.attempt_count,
    attempt_count: row.attempt_count,
    queuedAt: row.queued_at,
    queued_at: row.queued_at,
    processingStartedAt: row.processing_started_at,
    processing_started_at: row.processing_started_at,
    completedAt: row.completed_at,
    completed_at: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelled_at: row.cancelled_at,
    failedAt: row.failed_at,
    failed_at: row.failed_at,
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

function pickUpdate(updates, key, fallback) {
  return Object.prototype.hasOwnProperty.call(updates, key) ? updates[key] : fallback;
}

async function create(data, client = db) {
  const id = data.id || randomUUID();
  const now = data.createdAt || new Date().toISOString();

  await client.run(
    `
      INSERT INTO orders (
        id, user_id, idempotency_key, service_id, service_slug, service_template_id,
        service_template_key, status, point_cost, point_reservation_id, input_json,
        output_json, metadata_json, failure_code, failure_message, queue_status,
        attempt_count, queued_at, processing_started_at, completed_at, cancelled_at,
        failed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.userId,
      data.idempotencyKey,
      data.serviceId,
      data.serviceSlug,
      data.serviceTemplateId || null,
      data.serviceTemplateKey || null,
      data.status,
      Number(data.pointCost || 0),
      data.pointReservationId || null,
      serializeJson(data.input || {}),
      serializeJson(data.output || {}),
      serializeJson(data.metadata || {}),
      data.failureCode || null,
      data.failureMessage || null,
      data.queueStatus,
      Number(data.attemptCount || 0),
      data.queuedAt || null,
      data.processingStartedAt || null,
      data.completedAt || null,
      data.cancelledAt || null,
      data.failedAt || null,
      now,
      now
    ]
  );

  return findById(id, client);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM orders WHERE id = ?', [id]);
  return mapOrder(row);
}

async function findByIdempotencyKey(idempotencyKey, client = db) {
  const row = await client.get('SELECT * FROM orders WHERE idempotency_key = ?', [idempotencyKey]);
  return mapOrder(row);
}

async function findManyByUserId(userId, filters = {}, client = db) {
  const where = ['user_id = ?'];
  const params = [userId];

  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }

  const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 100);
  const rows = await client.all(
    `
      SELECT *
      FROM orders
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [...params, limit]
  );

  return rows.map(mapOrder);
}

async function findDispatchPending({ limit = 25 } = {}, client = db) {
  const safeLimit = Math.min(Math.max(Number(limit || 25), 1), 100);
  const rows = await client.all(
    `
      SELECT *
      FROM orders
      WHERE status = 'queued'
        AND queue_status = 'dispatch_pending'
      ORDER BY queued_at ASC, created_at ASC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows.map(mapOrder);
}

async function update(id, updates, client = db) {
  const existing = await findById(id, client);
  if (!existing) {
    return null;
  }

  await client.run(
    `
      UPDATE orders
      SET
        status = ?,
        point_reservation_id = ?,
        output_json = ?,
        metadata_json = ?,
        failure_code = ?,
        failure_message = ?,
        queue_status = ?,
        attempt_count = ?,
        queued_at = ?,
        processing_started_at = ?,
        completed_at = ?,
        cancelled_at = ?,
        failed_at = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      pickUpdate(updates, 'status', existing.status),
      pickUpdate(updates, 'pointReservationId', existing.pointReservationId),
      serializeJson(pickUpdate(updates, 'output', existing.output) || {}),
      serializeJson(pickUpdate(updates, 'metadata', existing.metadata) || {}),
      pickUpdate(updates, 'failureCode', existing.failureCode),
      pickUpdate(updates, 'failureMessage', existing.failureMessage),
      pickUpdate(updates, 'queueStatus', existing.queueStatus),
      pickUpdate(updates, 'attemptCount', existing.attemptCount),
      pickUpdate(updates, 'queuedAt', existing.queuedAt),
      pickUpdate(updates, 'processingStartedAt', existing.processingStartedAt),
      pickUpdate(updates, 'completedAt', existing.completedAt),
      pickUpdate(updates, 'cancelledAt', existing.cancelledAt),
      pickUpdate(updates, 'failedAt', existing.failedAt),
      new Date().toISOString(),
      id
    ]
  );

  return findById(id, client);
}

module.exports = {
  orderRepository: {
    create,
    findDispatchPending,
    findById,
    findByIdempotencyKey,
    findManyByUserId,
    update
  }
};
