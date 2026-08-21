module.exports = {
  id: '202608090002',
  name: 'points_funding_system',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS points_funding_packages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        points INTEGER NOT NULL CHECK (points > 0),
        price_minor INTEGER NOT NULL CHECK (price_minor > 0),
        currency TEXT NOT NULL DEFAULT 'NGN',
        min_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (min_amount_minor >= 0),
        max_amount_minor INTEGER CHECK (max_amount_minor IS NULL OR max_amount_minor >= min_amount_minor),
        bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points >= 0),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payment_destinations (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        account_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'NGN',
        instructions TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_destinations_primary_currency
      ON payment_destinations(currency)
      WHERE active = 1 AND is_primary = 1;

      CREATE TABLE IF NOT EXISTS points_funding_requests (
        id TEXT PRIMARY KEY,
        public_reference TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        package_id TEXT NOT NULL,
        requested_points INTEGER NOT NULL CHECK (requested_points > 0),
        expected_amount_minor INTEGER NOT NULL CHECK (expected_amount_minor > 0),
        currency TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        payment_destination_id TEXT NOT NULL,
        payment_reference TEXT NOT NULL UNIQUE,
        destination_snapshot_json TEXT NOT NULL,
        user_transaction_reference TEXT,
        user_note TEXT,
        evidence_file_id TEXT,
        evidence_storage_key TEXT,
        evidence_metadata_json TEXT,
        status TEXT NOT NULL CHECK (status IN (
          'DRAFT', 'PAYMENT_INSTRUCTIONS', 'PAYMENT_REPORTED', 'UNDER_REVIEW',
          'APPROVED', 'POINTS_CREDITED', 'REJECTED', 'NEEDS_MORE_INFORMATION',
          'CANCELLED', 'MANUAL_REVIEW'
        )),
        risk_status TEXT NOT NULL DEFAULT 'NORMAL',
        possible_duplicate INTEGER NOT NULL DEFAULT 0 CHECK (possible_duplicate IN (0, 1)),
        submitted_at TEXT,
        reviewed_at TEXT,
        reviewed_by TEXT,
        assigned_to TEXT,
        assigned_by TEXT,
        assigned_at TEXT,
        rejection_reason TEXT,
        admin_note TEXT,
        credited_at TEXT,
        ledger_entry_key TEXT UNIQUE,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (package_id) REFERENCES points_funding_packages(id) ON DELETE RESTRICT,
        FOREIGN KEY (payment_destination_id) REFERENCES payment_destinations(id) ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS idx_points_funding_requests_user_created_at
      ON points_funding_requests(user_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_points_funding_requests_status_created_at
      ON points_funding_requests(status, created_at);

      CREATE INDEX IF NOT EXISTS idx_points_funding_requests_user_transaction_reference
      ON points_funding_requests(user_transaction_reference);

      CREATE TABLE IF NOT EXISTS points_reconciliation_alerts (
        id TEXT PRIMARY KEY,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        user_id TEXT,
        funding_request_id TEXT,
        expected_points INTEGER,
        actual_points INTEGER,
        details_json TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (funding_request_id) REFERENCES points_funding_requests(id) ON DELETE SET NULL
      );
    `);

    const now = new Date().toISOString();
    const packages = [
      ['points_pkg_1000_ngn', '1,000 Points', 1000, 100000, 'NGN', 1],
      ['points_pkg_5000_ngn', '5,000 Points', 5000, 500000, 'NGN', 2],
      ['points_pkg_10000_ngn', '10,000 Points', 10000, 1000000, 'NGN', 3]
    ];

    for (const pack of packages) {
      await client.run(
        `
          INSERT INTO points_funding_packages (
            id, name, points, price_minor, currency, min_amount_minor, max_amount_minor,
            bonus_points, active, sort_order, metadata_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, '{}', ?, ?)
          ON CONFLICT(id) DO NOTHING
        `,
        [pack[0], pack[1], pack[2], pack[3], pack[4], pack[3], pack[3], pack[5], now, now]
      );
    }

    await client.run(
      `
        INSERT INTO payment_destinations (
          id, provider, account_name, account_number, currency, instructions,
          active, is_primary, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `,
      [
        'manual_ngn_destination_default',
        process.env.POINTS_FUNDING_BANK_PROVIDER || 'Configured Bank',
        process.env.POINTS_FUNDING_ACCOUNT_NAME || 'TRANSFERLY CONFIG REQUIRED',
        process.env.POINTS_FUNDING_ACCOUNT_NUMBER || '0000000000',
        'NGN',
        process.env.POINTS_FUNDING_INSTRUCTIONS || 'Transfer exactly the amount shown. 1 Transferly Point equals ₦1.',
        String(process.env.POINTS_FUNDING_DESTINATION_ACTIVE || 'true').toLowerCase() === 'false' ? 0 : 1,
        JSON.stringify({
          seeded_from_environment: true,
          production_review_required: true,
          payment_note: process.env.POINTS_FUNDING_PAYMENT_NOTE || 'Include your Transferly payment reference in the bank transfer narration.',
          points_value_note: '1 Transferly Point = ₦1'
        }),
        now,
        now
      ]
    );
  }
};