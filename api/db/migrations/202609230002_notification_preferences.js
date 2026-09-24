module.exports = {
  id: '202609230002',
  name: 'notification_preferences',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id TEXT PRIMARY KEY,
        channels_json TEXT NOT NULL,
        categories_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  }
};
