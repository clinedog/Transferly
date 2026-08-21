module.exports = {
  id: '202608090005',
  name: 'risk_engine_foundation',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS account_risk_states (
        user_id TEXT PRIMARY KEY,
        state TEXT NOT NULL DEFAULT 'NORMAL',
        risk_level TEXT NOT NULL DEFAULT 'LOW',
        last_decision_id TEXT,
        last_signal_at TEXT,
        changed_by_actor_id TEXT,
        changed_reason TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS risk_events (
        id TEXT PRIMARY KEY,
        event_key TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        domain TEXT NOT NULL,
        user_id TEXT,
        source TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        correlation_id TEXT NOT NULL,
        metadata_json TEXT,
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS risk_signals (
        id TEXT PRIMARY KEY,
        signal_key TEXT NOT NULL UNIQUE,
        risk_event_id TEXT,
        signal_type TEXT NOT NULL,
        domain TEXT NOT NULL,
        severity TEXT NOT NULL,
        source TEXT NOT NULL,
        user_id TEXT,
        resource_type TEXT,
        resource_id TEXT,
        correlation_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (risk_event_id) REFERENCES risk_events(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS risk_decisions (
        id TEXT PRIMARY KEY,
        decision_key TEXT NOT NULL UNIQUE,
        risk_event_id TEXT,
        domain TEXT NOT NULL,
        user_id TEXT,
        decision TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        account_state TEXT,
        reasons_json TEXT,
        signal_ids_json TEXT,
        resource_type TEXT,
        resource_id TEXT,
        correlation_id TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (risk_event_id) REFERENCES risk_events(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS account_restrictions (
        id TEXT PRIMARY KEY,
        restriction_key TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        capability TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        reason TEXT NOT NULL,
        risk_decision_id TEXT,
        case_id TEXT,
        created_by_actor_id TEXT,
        expires_at TEXT,
        lifted_at TEXT,
        lifted_by_actor_id TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (risk_decision_id) REFERENCES risk_decisions(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS risk_cases (
        id TEXT PRIMARY KEY,
        case_number TEXT NOT NULL UNIQUE,
        user_id TEXT,
        domain TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        assigned_to TEXT,
        opened_by_decision_id TEXT,
        signal_ids_json TEXT,
        related_resources_json TEXT,
        resolution TEXT,
        resolution_reason TEXT,
        resolved_by_actor_id TEXT,
        resolved_at TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (opened_by_decision_id) REFERENCES risk_decisions(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS risk_case_notes (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        note TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES risk_cases(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS risk_rule_configurations (
        id TEXT PRIMARY KEY,
        rule_code TEXT NOT NULL UNIQUE,
        domain TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        threshold_value INTEGER,
        window_seconds INTEGER,
        severity TEXT NOT NULL,
        decision TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 100,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_risk_events_user_created ON risk_events(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_risk_events_type_created ON risk_events(event_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_risk_events_correlation ON risk_events(correlation_id);
      CREATE INDEX IF NOT EXISTS idx_risk_signals_user_created ON risk_signals(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_risk_signals_type_created ON risk_signals(signal_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_risk_signals_severity_created ON risk_signals(severity, created_at);
      CREATE INDEX IF NOT EXISTS idx_risk_decisions_user_created ON risk_decisions(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_account_restrictions_user_status ON account_restrictions(user_id, status, capability);
      CREATE INDEX IF NOT EXISTS idx_account_restrictions_expires ON account_restrictions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_risk_cases_status_created ON risk_cases(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_risk_cases_user_status ON risk_cases(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_risk_cases_level_created ON risk_cases(risk_level, created_at);
    `);
  }
};