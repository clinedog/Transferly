const { db } = require('../db');
const { randomUUID } = require('node:crypto');

// Compatibility adapter for point_reservations (legacy name: wallet_reservations)
module.exports = {
  async createReservation({ userId, amount, referenceType, referenceId, expiresAt, metadata = {} }) {
    const id = `res:${randomUUID()}`;
    const reservationKey = `reservation:${id}`;
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO point_reservations (id, reservation_key, user_id, status, amount, available_points_before, available_points_after, reference_type, reference_id, metadata_json, reserved_at, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        reservationKey,
        userId,
        'active',
        amount,
        0,
        0,
        referenceType,
        referenceId,
        JSON.stringify(metadata),
        now,
        expiresAt || null,
        now,
        now
      ]
    );
    return { id, reservationKey };
  },

  async commitReservation(reservationId, _actor = 'system') {
    await db.run(`UPDATE point_reservations SET status = 'committed', committed_at = ?, updated_at = ? WHERE id = ? AND status = 'active'`, [new Date().toISOString(), new Date().toISOString(), reservationId]);
  },

  async releaseReservation(reservationId, _reason = null) {
    await db.run(`UPDATE point_reservations SET status = 'released', released_at = ?, updated_at = ? WHERE id = ? AND status IN ('active','expired')`, [new Date().toISOString(), new Date().toISOString(), reservationId]);
  },

  async findById(id) {
    return db.get(`SELECT * FROM point_reservations WHERE id = ?`, [id]);
  }
};
