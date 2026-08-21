module.exports = {
  id: '202607240002',
  name: 'risk_flag_operator_escalation',
  async up(client) {
    await client.exec(`
      ALTER TABLE risk_flags ADD COLUMN operator_id TEXT;
      ALTER TABLE risk_flags ADD COLUMN assigned_at TEXT;
      ALTER TABLE risk_flags ADD COLUMN escalated_at TEXT;
      ALTER TABLE risk_flags ADD COLUMN escalation_note TEXT;

      CREATE INDEX IF NOT EXISTS idx_risk_flags_operator ON risk_flags(operator_id)
        WHERE operator_id IS NOT NULL;
    `);
  },
  async down(client) {
    await client.exec(`DROP INDEX IF EXISTS idx_risk_flags_operator;`);
  }
};
