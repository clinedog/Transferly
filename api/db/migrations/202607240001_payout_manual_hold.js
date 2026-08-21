module.exports = {
  id: '202607240001',
  name: 'payout_manual_hold',
  async up(client) {
    await client.exec(`
      ALTER TABLE payouts ADD COLUMN on_hold INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE payouts ADD COLUMN held_by_actor_id TEXT;
      ALTER TABLE payouts ADD COLUMN held_at TEXT;
      ALTER TABLE payouts ADD COLUMN hold_reason TEXT;

      CREATE INDEX IF NOT EXISTS idx_payouts_on_hold ON payouts(on_hold) WHERE on_hold = 1;
    `);
  },
  async down(client) {
    // SQLite does not support DROP COLUMN before 3.35; leave columns in place
    await client.exec(`DROP INDEX IF EXISTS idx_payouts_on_hold;`);
  }
};
