const { randomUUID } = require('node:crypto');
const { db } = require('../db');

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    data: row.data_json ? JSON.parse(row.data_json) : {},
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

const notificationRepository = {
  async createNotification({ userId, type, title, message, data = {} }, client = db) {
    const id = `notif:${randomUUID()}`;
    const now = new Date().toISOString();
    await client.run(
      `INSERT INTO notifications (id, user_id, type, title, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, type, title, message, JSON.stringify(data), now]
    );
    await client.run(
      `INSERT INTO notification_deliveries
        (id, notification_id, channel, status, attempt_count, sent_at, created_at, updated_at)
       VALUES (?, ?, 'in_app', 'delivered', 1, ?, ?, ?)`,
      [`delivery:${randomUUID()}`, id, now, now, now]
    );
    return mapNotification(await client.get('SELECT * FROM notifications WHERE id = ?', [id]));
  },

  async listPendingDeliveries({ limit = 50, now = new Date().toISOString() } = {}, client = db) {
    return client.all(
      `SELECT * FROM notification_deliveries
       WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at ASC LIMIT ?`,
      [now, Math.min(Math.max(Number(limit) || 50, 1), 100)]
    );
  },

  async recordDeliveryFailure({ id, errorCode, errorMessage, nextAttemptAt }, client = db) {
    const result = await client.run(
      `UPDATE notification_deliveries
       SET status = 'pending', attempt_count = attempt_count + 1,
           next_attempt_at = ?, last_error_code = ?, last_error_message = ?, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
      [nextAttemptAt, errorCode, String(errorMessage || '').slice(0, 1000), new Date().toISOString(), id]
    );
    return result.changes === 1;
  },

  async listForUser(userId, { limit = 50 } = {}, client = db) {
    const rows = await client.all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, Math.min(Math.max(Number(limit) || 50, 1), 100)]
    );
    return rows.map(mapNotification);
  },

  async markRead(userId, notificationId, client = db) {
    const readAt = new Date().toISOString();
    const result = await client.run(
      'UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?',
      [readAt, notificationId, userId]
    );
    if (result.changes !== 1) return null;
    return mapNotification(await client.get('SELECT * FROM notifications WHERE id = ?', [notificationId]));
  }
};

module.exports = { notificationRepository, mapNotification };
