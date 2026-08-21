module.exports = {
  id: '202608090004',
  name: 'payment_matching_engine',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS payment_provider_transactions (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_transaction_id TEXT NOT NULL,
        provider_reference TEXT,
        event_id TEXT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        status TEXT NOT NULL,
        destination_json TEXT,
        sender_json TEXT,
        transaction_time TEXT,
        verification_status TEXT NOT NULL,
        match_status TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        funding_request_id TEXT,
        match_result_json TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (funding_request_id) REFERENCES points_funding_requests(id) ON DELETE SET NULL,
        UNIQUE(provider, provider_transaction_id),
        UNIQUE(provider, event_id)
      );

      CREATE INDEX IF NOT EXISTS idx_payment_provider_transactions_match_status
      ON payment_provider_transactions(match_status, created_at);

      CREATE INDEX IF NOT EXISTS idx_payment_provider_transactions_funding_request
      ON payment_provider_transactions(funding_request_id);
    `);
  }
};