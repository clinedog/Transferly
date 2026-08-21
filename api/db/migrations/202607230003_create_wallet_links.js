module.exports = {
  id: '202607230003',
  name: 'create_wallet_links',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS wallet_links (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        address TEXT NOT NULL,
        public_key_hex TEXT NOT NULL,
        metadata_json TEXT,
        verified_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_links_address ON wallet_links(address);
      CREATE INDEX IF NOT EXISTS idx_wallet_links_user ON wallet_links(user_id);
    `);
  }
};
