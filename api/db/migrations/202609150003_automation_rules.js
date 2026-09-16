module.exports = {
  id: '202609150003',
  name: 'automation_rules',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS automation_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        trigger TEXT NOT NULL,
        condition_json TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        paused_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_automation_rules_status_updated
        ON automation_rules(status, updated_at);
    `);
  }
};
