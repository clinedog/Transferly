module.exports = {
  id: '202609240001',
  name: 'notification_delivery',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id TEXT PRIMARY KEY,
        notification_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        sent_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
        UNIQUE (notification_id, channel)
      );

      CREATE INDEX IF NOT EXISTS idx_notification_deliveries_due
      ON notification_deliveries (status, next_attempt_at, created_at);
    `);
  }
};
