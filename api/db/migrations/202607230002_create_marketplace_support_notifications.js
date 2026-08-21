module.exports = {
  id: '202607230002',
  name: 'create_marketplace_support_notifications',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS marketplace_listings (
        id TEXT PRIMARY KEY,
        seller_user_id TEXT NOT NULL,
        points_available INTEGER NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        currency_code TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        minimum_points INTEGER NOT NULL DEFAULT 1,
        maximum_points INTEGER,
        status TEXT NOT NULL DEFAULT 'draft',
        expires_at TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_status
      ON marketplace_listings (seller_user_id, status);

      CREATE TABLE IF NOT EXISTS marketplace_trades (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL,
        buyer_user_id TEXT NOT NULL,
        seller_user_id TEXT NOT NULL,
        points INTEGER NOT NULL,
        monetary_amount_cents INTEGER NOT NULL,
        currency_code TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at TEXT,
        completed_at TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
        FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS idx_marketplace_trades_status
      ON marketplace_trades (status, created_at);

      CREATE TABLE IF NOT EXISTS disputes (
        id TEXT PRIMARY KEY,
        trade_id TEXT,
        opened_by_user_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT NOT NULL,
        resolution TEXT,
        resolved_by_user_id TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (trade_id) REFERENCES marketplace_trades(id) ON DELETE SET NULL,
        FOREIGN KEY (opened_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_disputes_status
      ON disputes (status, created_at);

      CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        category TEXT,
        status TEXT NOT NULL,
        priority TEXT,
        assigned_to_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status
      ON support_tickets (user_id, status);

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data_json TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
      ON notifications (user_id, created_at);
    `);
  }
};
