module.exports = {
  id: '202608200001',
  name: 'transactional_outbox',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id TEXT PRIMARY KEY,
        semantic_key TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        queue_name TEXT NOT NULL,
        job_name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'leased', 'dispatched', 'failed')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        max_attempts INTEGER NOT NULL DEFAULT 10 CHECK (max_attempts > 0),
        next_attempt_at TEXT NOT NULL,
        lease_token TEXT,
        lease_expires_at TEXT,
        fence_token INTEGER NOT NULL DEFAULT 0 CHECK (fence_token >= 0),
        queue_job_id TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        correlation_id TEXT NOT NULL,
        dispatched_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (status = 'leased' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
          OR status <> 'leased'
        )
      );

      CREATE INDEX IF NOT EXISTS idx_outbox_events_dispatch_due
      ON outbox_events (status, next_attempt_at, lease_expires_at, created_at);

      CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate
      ON outbox_events (aggregate_type, aggregate_id, created_at);
    `);

    await client.run(`
      INSERT INTO outbox_events (
        id, semantic_key, event_type, aggregate_type, aggregate_id, queue_name,
        job_name, payload_json, status, max_attempts, next_attempt_at,
        correlation_id, created_at, updated_at
      )
      SELECT
        'outbox-payout-' || id,
        'payout:process:' || id,
        'payout.processing.requested',
        'payout',
        id,
        'payout-process',
        'process-payout',
        json_object('payoutId', id, 'correlationId', id),
        'pending',
        10,
        updated_at,
        id,
        updated_at,
        updated_at
      FROM payouts
      WHERE status = 'QUEUED'
      ON CONFLICT(semantic_key) DO NOTHING
    `);
  }
};