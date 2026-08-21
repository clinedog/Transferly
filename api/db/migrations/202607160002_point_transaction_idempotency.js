module.exports = {
  id: '202607160002',
  name: 'point_transaction_idempotency',
  async up(client) {
    await client.exec(`
      UPDATE points_transactions
      SET entry_key = 'legacy:' || id
      WHERE entry_key IS NULL OR trim(entry_key) = ''
    `);
    await client.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_points_transactions_entry_key
      ON points_transactions (entry_key)
    `);
    await client.exec(`
      CREATE INDEX IF NOT EXISTS idx_points_transactions_reference
      ON points_transactions (reference_type, reference_id, created_at)
    `);
  }
};
