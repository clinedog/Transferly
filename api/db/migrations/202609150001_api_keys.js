module.exports = {
  id: '202609150001',
  name: 'api_keys',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        secret_hash TEXT NOT NULL UNIQUE,
        scopes_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_used_at TEXT,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        rotated_from_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_status
        ON api_keys(user_id, status, created_at);
    `);
  }
};
