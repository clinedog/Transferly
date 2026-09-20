module.exports = {
  id: '202607240001',
  name: 'payout_manual_hold',
  async up(client) {
    const columns = await client.all('PRAGMA table_info(payouts)');
    const existingColumns = new Set(columns.map((column) => column.name));

    const columnDefinitions = [
      ['on_hold', 'INTEGER NOT NULL DEFAULT 0'],
      ['held_by_actor_id', 'TEXT'],
      ['held_at', 'TEXT'],
      ['hold_reason', 'TEXT']
    ];

    for (const [columnName, columnDefinition] of columnDefinitions) {
      if (!existingColumns.has(columnName)) {
        await client.exec(`ALTER TABLE payouts ADD COLUMN ${columnName} ${columnDefinition};`);
      }
    }

    await client.exec(`CREATE INDEX IF NOT EXISTS idx_payouts_on_hold ON payouts(on_hold) WHERE on_hold = 1;`);
  },
  async down(client) {
    // SQLite does not support DROP COLUMN before 3.35; leave columns in place
    await client.exec(`DROP INDEX IF EXISTS idx_payouts_on_hold;`);
  }
};
