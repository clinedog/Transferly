const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapReservation(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    reservationKey: row.reservation_key,
    reservation_key: row.reservation_key,
    userId: row.user_id,
    user_id: row.user_id,
    status: row.status,
    amount: row.amount,
    availablePointsBefore: row.available_points_before,
    available_points_before: row.available_points_before,
    availablePointsAfter: row.available_points_after,
    available_points_after: row.available_points_after,
    referenceType: row.reference_type,
    reference_type: row.reference_type,
    referenceId: row.reference_id,
    reference_id: row.reference_id,
    metadata: parseJson(row.metadata_json, {}),
    reservedAt: row.reserved_at,
    reserved_at: row.reserved_at,
    expiresAt: row.expires_at,
    expires_at: row.expires_at,
    committedAt: row.committed_at,
    committed_at: row.committed_at,
    releasedAt: row.released_at,
    released_at: row.released_at,
    expiredAt: row.expired_at,
    expired_at: row.expired_at,
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

async function create(data, client = db) {
  const id = data.id || randomUUID();
  const now = data.createdAt || new Date().toISOString();
  const reservedAt = data.reservedAt || now;

  await client.run(
    `
      INSERT INTO point_reservations (
        id, reservation_key, user_id, status, amount, available_points_before,
        available_points_after, reference_type, reference_id, metadata_json,
        reserved_at, expires_at, committed_at, released_at, expired_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.reservationKey,
      data.userId,
      data.status,
      data.amount,
      data.availablePointsBefore,
      data.availablePointsAfter,
      data.referenceType,
      data.referenceId || null,
      serializeJson(data.metadata || {}),
      reservedAt,
      data.expiresAt || null,
      data.committedAt || null,
      data.releasedAt || null,
      data.expiredAt || null,
      now,
      now
    ]
  );

  return findById(id, client);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM point_reservations WHERE id = ?', [id]);
  return mapReservation(row);
}

async function findByReservationKey(reservationKey, client = db) {
  const row = await client.get('SELECT * FROM point_reservations WHERE reservation_key = ?', [reservationKey]);
  return mapReservation(row);
}

async function update(id, updates, client = db) {
  const existing = await findById(id, client);
  if (!existing) {
    return null;
  }

  await client.run(
    `
      UPDATE point_reservations
      SET
        status = ?,
        reference_id = ?,
        metadata_json = ?,
        expires_at = ?,
        committed_at = ?,
        released_at = ?,
        expired_at = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      updates.status ?? existing.status,
      updates.referenceId ?? existing.referenceId,
      serializeJson(updates.metadata ?? existing.metadata),
      updates.expiresAt ?? existing.expiresAt,
      updates.committedAt ?? existing.committedAt,
      updates.releasedAt ?? existing.releasedAt,
      updates.expiredAt ?? existing.expiredAt,
      new Date().toISOString(),
      id
    ]
  );

  return findById(id, client);
}

async function findExpired({ before, limit, referenceType }, client = db) {
  const params = ['RESERVED', before];
  let referenceFilter = '';
  if (referenceType) {
    referenceFilter = 'AND reference_type = ?';
    params.push(referenceType);
  }
  params.push(limit);

  const rows = await client.all(
    `
      SELECT *
      FROM point_reservations
      WHERE status = ?
        AND expires_at IS NOT NULL
        AND expires_at <= ?
        ${referenceFilter}
      ORDER BY expires_at ASC, id ASC
      LIMIT ?
    `,
    params
  );
  return rows.map(mapReservation);
}

async function findByReference(referenceType, referenceId, client = db) {
  const rows = await client.all(
    'SELECT * FROM point_reservations WHERE reference_type = ? AND reference_id = ? ORDER BY created_at DESC',
    [referenceType, referenceId]
  );
  return rows.map(mapReservation);
}

module.exports = {
  pointReservationRepository: {
    create,
    findById,
    findExpired,
    findByReservationKey,
    findByReference,
    update
  }
};
