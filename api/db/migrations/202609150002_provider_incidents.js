module.exports = {
  id: '202609150002',
  name: 'provider_incidents',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS provider_incidents (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        affected_operation TEXT,
        impact TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT,
        closed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_provider_incidents_status_updated
        ON provider_incidents(status, updated_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_incidents_provider_active
        ON provider_incidents(provider)
        WHERE status NOT IN ('RESOLVED', 'CLOSED');
    `);
  }
};
