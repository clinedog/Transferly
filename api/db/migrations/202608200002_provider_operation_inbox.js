module.exports = {
  id: '202608200002',
  name: 'provider_operation_inbox',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS provider_operation_inbox (
        id TEXT PRIMARY KEY,
        semantic_key TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('submission', 'poll', 'webhook')),
        provider_resource_type TEXT,
        provider_resource_id TEXT,
        provider_status TEXT,
        payload_json TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        received_at TEXT NOT NULL,
        consumed_at TEXT,
        consumed_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (consumed_at IS NULL AND consumed_by IS NULL)
          OR (consumed_at IS NOT NULL AND consumed_by IS NOT NULL)
        )
      );

      CREATE INDEX IF NOT EXISTS idx_provider_operation_inbox_unconsumed
      ON provider_operation_inbox (consumed_at, received_at, provider);

      CREATE INDEX IF NOT EXISTS idx_provider_operation_inbox_aggregate
      ON provider_operation_inbox (aggregate_type, aggregate_id, received_at);

      CREATE INDEX IF NOT EXISTS idx_provider_operation_inbox_resource
      ON provider_operation_inbox (provider, provider_resource_type, provider_resource_id);
    `);
  }
};