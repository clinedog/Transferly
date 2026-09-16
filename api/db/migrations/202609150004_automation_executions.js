module.exports = {
  id: '202609150004',
  name: 'automation_executions',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS automation_executions (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        event_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_automation_executions_rule_created
        ON automation_executions(rule_id, created_at);
    `);
  }
};
