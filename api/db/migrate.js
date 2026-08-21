const {
  initializeDatabase,
  db,
  loadSchemaSql,
  transaction,
  close,
  sqliteDatabasePath
} = require('./index');
const { runPendingMigrations } = require('./migrationRunner');
const { seedDefaultCatalogue } = require('./seeds/serviceCatalogueSeed');

const REQUIRED_TABLES = Object.freeze([
  'schema_migrations',
  'users',
  'auth_sessions',
  'wallets',
  'ledger_entries',
  'invoices',
  'invoice_templates',
  'services',
  'service_templates',
  'payout_batches',
  'payouts',
  'audit_logs',
  'outbox_events',
  'provider_operation_inbox',
  'risk_flags',
  'webhook_events',
  'auth_credentials',
  'profiles',
  'platform_config',
  'faqs',
  'testimonials',
  'payment_ops_issues',
  'receipts',
  'points_transactions',
  'point_reservations',
  'points_funding_packages',
  'payment_destinations',
  'points_funding_requests',
  'points_reconciliation_alerts',
  'payment_provider_transactions',
    'account_risk_states',
    'risk_events',
    'risk_signals',
    'risk_decisions',
    'account_restrictions',
    'risk_cases',
    'risk_case_notes',
    'risk_rule_configurations',
  'orders',
  'idempotency_records',
  'order_events',
  'order_attempts',
  'dead_letter_records',
  'generated_assets',
  'top_up_orders',
  'email_dispatches',
  'referral_events',
  'telegram_accounts',
  'telegram_command_logs'
]);

async function ensureColumn(client, tableName, columnName, columnDefinition) {
  const columns = await client.all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await client.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

async function ensureInvoiceColumns(client) {
  await ensureColumn(client, 'invoices', 'paypal_qr_details_json', 'TEXT');
  await ensureColumn(client, 'invoices', 'paypal_synced_at', 'TEXT');
  await ensureColumn(client, 'invoices', 'template_id', 'TEXT');
  await ensureColumn(client, 'invoices', 'issue_date', 'TEXT');
  await ensureColumn(client, 'invoices', 'auto_reminders_cancelled_at', 'TEXT');
}

async function ensurePlatformConfigColumns(client) {
  await ensureColumn(client, 'platform_config', 'payout_minimum_cents', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(client, 'platform_config', 'payout_fee_fixed_cents', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(client, 'platform_config', 'payout_fee_percentage_bps', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(client, 'platform_config', 'payout_manual_review_cents', 'INTEGER NOT NULL DEFAULT 0');
}

async function ensureUserStatusColumn(client) {
  await ensureColumn(client, 'users', 'status', "TEXT NOT NULL DEFAULT 'active'");
}

async function ensureProfileRoleColumn(client) {
  await ensureColumn(client, 'profiles', 'role', "TEXT NOT NULL DEFAULT 'USER'");
  await client.exec(`
    UPDATE profiles
    SET role = CASE
      WHEN upper(role) IN ('OWNER', 'ADMIN', 'SUPPORT', 'USER') THEN upper(role)
      WHEN is_admin = 1 THEN 'ADMIN'
      ELSE 'USER'
    END
  `);
  await client.exec(`
    UPDATE profiles
    SET is_admin = CASE WHEN upper(role) IN ('OWNER', 'ADMIN') THEN 1 ELSE 0 END
  `);
}

async function ensureTelegramAccountColumns(client) {
  await ensureColumn(client, 'telegram_accounts', 'language_code', 'TEXT');
  await ensureColumn(client, 'telegram_accounts', 'last_authenticated_at', 'TEXT');
}

async function ensurePointTransactionColumns(client) {
  await ensureColumn(client, 'points_transactions', 'entry_key', 'TEXT');
  await ensureColumn(client, 'points_transactions', 'reference_type', 'TEXT');
  await ensureColumn(client, 'points_transactions', 'reference_id', 'TEXT');
  await ensureColumn(client, 'points_transactions', 'balance_after', 'INTEGER');
}

async function ensurePointReservationColumns(client) {
  await ensureColumn(client, 'point_reservations', 'expires_at', 'TEXT');
  await ensureColumn(client, 'point_reservations', 'expired_at', 'TEXT');
}

async function ensureServiceCatalogueColumns(client) {
  await ensureColumn(client, 'services', 'description', 'TEXT');
  await ensureColumn(client, 'services', 'point_price', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(client, 'services', 'generator_key', 'TEXT');
  await ensureColumn(client, 'services', 'generator_version', 'TEXT');
  await ensureColumn(client, 'services', 'input_schema_json', "TEXT NOT NULL DEFAULT '{}'");
  await ensureColumn(client, 'services', 'output_type', 'TEXT');
  await ensureColumn(client, 'services', 'configuration_json', "TEXT NOT NULL DEFAULT '{}'");
  await ensureColumn(client, 'services', 'permissions_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn(client, 'services', 'queue_behavior_json', "TEXT NOT NULL DEFAULT '{}'");
  await ensureColumn(client, 'services', 'retention_days', 'INTEGER');
  await ensureColumn(client, 'services', 'execution_mode', "TEXT NOT NULL DEFAULT 'production'");
  await ensureColumn(client, 'services', 'version', "TEXT NOT NULL DEFAULT '1'");
  await ensureColumn(client, 'services', 'feature_flag', 'TEXT');

  await ensureColumn(client, 'service_templates', 'input_schema_json', "TEXT NOT NULL DEFAULT '{}'");
  await ensureColumn(client, 'service_templates', 'renderer_config_json', "TEXT NOT NULL DEFAULT '{}'");
  await ensureColumn(client, 'service_templates', 'preview_asset', 'TEXT');
  await ensureColumn(client, 'service_templates', 'version', "TEXT NOT NULL DEFAULT '1'");
}

async function verifyRequiredTables(client = db) {
  const placeholders = REQUIRED_TABLES.map(() => '?').join(', ');
  const rows = await client.all(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
    REQUIRED_TABLES
  );
  const existingTables = new Set(rows.map((row) => row.name));
  const missingTables = REQUIRED_TABLES.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(
      `SQLite schema migration incomplete for ${sqliteDatabasePath}. Missing tables: ${missingTables.join(', ')}`
    );
  }
}

async function migrate() {
  await initializeDatabase();
  return transaction(async (client) => {
    await client.exec(loadSchemaSql());
    await ensureInvoiceColumns(client);
    await ensurePlatformConfigColumns(client);
    await ensureUserStatusColumn(client);
    await ensureProfileRoleColumn(client);
    await ensureTelegramAccountColumns(client);
    await ensurePointTransactionColumns(client);
    await ensurePointReservationColumns(client);
    await ensureServiceCatalogueColumns(client);

    const migrationResult = await runPendingMigrations({ client });
    await seedDefaultCatalogue(client);
    await verifyRequiredTables(client);
    return migrationResult;
  });
}

if (require.main === module) {
  migrate()
    .then(async (result) => {
      await close();
      process.stdout.write(
        `SQLite schema is up to date at ${sqliteDatabasePath}; applied ${result.applied.length} migration(s).\n`
      );
    })
    .catch(async (error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      try {
        await close();
      } catch (_closeError) {
        // Ignore close failures during migration shutdown.
      }
      process.exit(1);
    });
}

module.exports = {
  REQUIRED_TABLES,
  migrate,
  verifyRequiredTables
};
