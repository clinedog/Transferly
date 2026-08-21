module.exports = {
  id: '202608090003',
  name: 'finance_center_ops',
  async up(client) {
    const columns = await client.all('PRAGMA table_info(points_funding_requests)');
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('assigned_to')) {
      await client.exec('ALTER TABLE points_funding_requests ADD COLUMN assigned_to TEXT');
    }
    if (!columnNames.has('assigned_by')) {
      await client.exec('ALTER TABLE points_funding_requests ADD COLUMN assigned_by TEXT');
    }
    if (!columnNames.has('assigned_at')) {
      await client.exec('ALTER TABLE points_funding_requests ADD COLUMN assigned_at TEXT');
    }

    await client.exec(`
      CREATE INDEX IF NOT EXISTS idx_points_funding_requests_assigned_to_status
      ON points_funding_requests(assigned_to, status);

      CREATE INDEX IF NOT EXISTS idx_points_reconciliation_alerts_status_created_at
      ON points_reconciliation_alerts(status, created_at);
    `);
  }
};