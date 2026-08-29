const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-db-migration-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'db-migration-client';
process.env.PAYPAL_CLIENT_SECRET = 'db-migration-secret';
process.env.PAYPAL_WEBHOOK_ID = 'db-migration-webhook';

const { sqliteDatabasePath, db, close } = require('../db');
const { REQUIRED_TABLES, migrate, verifyRequiredTables } = require('../db/migrate');
const { getMigrationStatus } = require('../db/migrationRunner');
const { loadMigrations } = require('../db/migrations');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('migration creates and verifies required operational tables', async () => {
  const migrationDefinitions = loadMigrations();
  const firstRun = await migrate();
  assert.deepEqual(
    firstRun.applied.map((migration) => migration.id),
    migrationDefinitions.map((migration) => migration.id)
  );

  const secondRun = await migrate();
  assert.deepEqual(secondRun.applied, []);
  assert.equal(secondRun.total, migrationDefinitions.length);

  await verifyRequiredTables();

  const migrationRows = await db.all(
    'SELECT id, name, checksum, applied_at FROM schema_migrations ORDER BY id ASC'
  );
  assert.equal(migrationRows.length, migrationDefinitions.length);
  for (const row of migrationRows) {
    assert.match(row.checksum, /^[a-f0-9]{64}$/);
    assert.ok(row.applied_at);
  }

  const migrationStatus = await getMigrationStatus();
  assert.ok(migrationStatus.every((migration) => migration.status === 'applied'));

  const rows = await db.all("SELECT name FROM sqlite_master WHERE type = 'table'");
  const tableNames = new Set(rows.map((row) => row.name));

  for (const tableName of REQUIRED_TABLES) {
    assert.equal(
      tableNames.has(tableName),
      true,
      `${tableName} should exist in migrated database ${sqliteDatabasePath}`
    );
  }

  const userColumns = await db.all('PRAGMA table_info(users)');
  const userStatusColumn = userColumns.find((column) => column.name === 'status');

  assert.ok(userStatusColumn);
  assert.equal(userStatusColumn.notnull, 1);
  assert.equal(userStatusColumn.dflt_value, "'active'");

  const userStatusTriggers = await db.all(
    "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'users'"
  );
  assert.deepEqual(
    new Set(userStatusTriggers.map((trigger) => trigger.name)),
    new Set(['validate_users_status_insert', 'validate_users_status_update'])
  );

  const telegramAccountColumns = await db.all('PRAGMA table_info(telegram_accounts)');
  const telegramAccountColumnNames = new Set(telegramAccountColumns.map((column) => column.name));

  assert.equal(telegramAccountColumnNames.has('language_code'), true);
  assert.equal(telegramAccountColumnNames.has('last_authenticated_at'), true);

  const authSessionColumns = await db.all('PRAGMA table_info(auth_sessions)');
  const authSessionColumnNames = new Set(authSessionColumns.map((column) => column.name));

  for (const columnName of [
    'user_id',
    'telegram_user_id',
    'telegram_exchange_hash',
    'current_token_id',
    'status',
    'expires_at',
    'last_refreshed_at',
    'revoked_at',
    'revoke_reason'
  ]) {
    assert.equal(authSessionColumnNames.has(columnName), true, `auth_sessions.${columnName} should exist`);
  }

  const authSessionIndexes = await db.all('PRAGMA index_list(auth_sessions)');
  const authSessionExchangeIndexes = [];
  for (const index of authSessionIndexes.filter((entry) => entry.unique === 1)) {
    const columns = await db.all(`PRAGMA index_info(${index.name})`);
    if (columns.some((column) => column.name === 'telegram_exchange_hash')) {
      authSessionExchangeIndexes.push(index);
    }
  }
  assert.equal(authSessionExchangeIndexes.length, 1);

  const pointReservationColumns = await db.all('PRAGMA table_info(point_reservations)');
  const pointReservationColumnNames = new Set(pointReservationColumns.map((column) => column.name));

  assert.equal(pointReservationColumnNames.has('reservation_key'), true);
  assert.equal(pointReservationColumnNames.has('available_points_before'), true);
  assert.equal(pointReservationColumnNames.has('available_points_after'), true);
  assert.equal(pointReservationColumnNames.has('expires_at'), true);
  assert.equal(pointReservationColumnNames.has('committed_at'), true);
  assert.equal(pointReservationColumnNames.has('expired_at'), true);

  const pointReservationExpiryIndex = await db.get(
    "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_point_reservations_expiry'"
  );
  assert.match(pointReservationExpiryIndex.sql, /status, expires_at/i);

  const serviceColumns = await db.all('PRAGMA table_info(services)');
  const serviceColumnNames = new Set(serviceColumns.map((column) => column.name));

  assert.equal(serviceColumnNames.has('slug'), true);
  assert.equal(serviceColumnNames.has('description'), true);
  assert.equal(serviceColumnNames.has('point_price'), true);
  assert.equal(serviceColumnNames.has('generator_key'), true);
  assert.equal(serviceColumnNames.has('generator_version'), true);
  assert.equal(serviceColumnNames.has('input_schema_json'), true);
  assert.equal(serviceColumnNames.has('output_type'), true);
  assert.equal(serviceColumnNames.has('configuration_json'), true);
  assert.equal(serviceColumnNames.has('permissions_json'), true);
  assert.equal(serviceColumnNames.has('queue_behavior_json'), true);
  assert.equal(serviceColumnNames.has('retention_days'), true);
  assert.equal(serviceColumnNames.has('execution_mode'), true);
  assert.equal(serviceColumnNames.has('version'), true);
  assert.equal(serviceColumnNames.has('feature_flag'), true);
  assert.equal(serviceColumnNames.has('is_payment_provider'), true);
  assert.equal(serviceColumnNames.has('display_order'), true);

  const serviceStatusColumn = serviceColumns.find((column) => column.name === 'status');
  assert.equal(serviceStatusColumn.notnull, 1);
  assert.equal(serviceStatusColumn.dflt_value, "'draft'");

  const serviceStatusTriggers = await db.all(
    "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'services'"
  );
  assert.deepEqual(
    new Set(serviceStatusTriggers.map((trigger) => trigger.name)),
    new Set(['validate_services_status_insert', 'validate_services_status_update'])
  );

  const serviceTemplateColumns = await db.all('PRAGMA table_info(service_templates)');
  const serviceTemplateColumnNames = new Set(serviceTemplateColumns.map((column) => column.name));

  assert.equal(serviceTemplateColumnNames.has('service_id'), true);
  assert.equal(serviceTemplateColumnNames.has('template_key'), true);
  assert.equal(serviceTemplateColumnNames.has('cost_points'), true);
  assert.equal(serviceTemplateColumnNames.has('input_schema_json'), true);
  assert.equal(serviceTemplateColumnNames.has('renderer_config_json'), true);
  assert.equal(serviceTemplateColumnNames.has('preview_asset'), true);
  assert.equal(serviceTemplateColumnNames.has('version'), true);

  const orderColumns = await db.all('PRAGMA table_info(orders)');
  const orderColumnNames = new Set(orderColumns.map((column) => column.name));

  assert.equal(orderColumnNames.has('idempotency_key'), true);
  assert.equal(orderColumnNames.has('service_id'), true);
  assert.equal(orderColumnNames.has('status'), true);
  assert.equal(orderColumnNames.has('point_reservation_id'), true);
  assert.equal(orderColumnNames.has('queue_status'), true);

  const idempotencyRecordColumns = await db.all('PRAGMA table_info(idempotency_records)');
  const idempotencyRecordColumnNames = new Set(
    idempotencyRecordColumns.map((column) => column.name)
  );

  for (const columnName of [
    'id',
    'user_id',
    'idempotency_key',
    'operation',
    'request_hash',
    'response_status',
    'response_payload',
    'expires_at',
    'created_at'
  ]) {
    assert.equal(
      idempotencyRecordColumnNames.has(columnName),
      true,
      `idempotency_records.${columnName} should exist`
    );
  }

  const orderEventColumns = await db.all('PRAGMA table_info(order_events)');
  const orderEventColumnNames = new Set(orderEventColumns.map((column) => column.name));

  assert.equal(orderEventColumnNames.has('previous_status'), true);
  assert.equal(orderEventColumnNames.has('next_status'), true);
  assert.equal(orderEventColumnNames.has('event_type'), true);

  const orderAttemptColumns = await db.all('PRAGMA table_info(order_attempts)');
  const orderAttemptColumnNames = new Set(orderAttemptColumns.map((column) => column.name));

  for (const columnName of [
    'order_id',
    'dispatch_generation',
    'attempt_number',
    'job_id',
    'correlation_id',
    'lock_token',
    'status',
    'started_at',
    'lock_expires_at',
    'finished_at',
    'failure_code',
    'failure_message',
    'metadata_json'
  ]) {
    assert.equal(orderAttemptColumnNames.has(columnName), true, `order_attempts.${columnName} should exist`);
  }

  const activeAttemptIndex = await db.get(
    "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_order_attempts_active_order'"
  );
  assert.match(activeAttemptIndex.sql, /UNIQUE INDEX/i);
  assert.match(activeAttemptIndex.sql, /WHERE status = 'processing'/i);

  const deadLetterColumns = await db.all('PRAGMA table_info(dead_letter_records)');
  const deadLetterColumnNames = new Set(deadLetterColumns.map((column) => column.name));

  for (const columnName of [
    'source_key',
    'source_queue',
    'source_job_id',
    'dead_letter_job_id',
    'payload_json',
    'failure_classification',
    'retryable',
    'status',
    'recovery_token',
    'recovery_job_id',
    'last_recovery_error'
  ]) {
    assert.equal(
      deadLetterColumnNames.has(columnName),
      true,
      `dead_letter_records.${columnName} should exist`
    );
  }

  const deadLetterSourceIndex = await db.get(
    "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_dead_letter_records_source'"
  );
  assert.match(deadLetterSourceIndex.sql, /source_queue, source_job_id/i);

  const providerInboxColumns = await db.all('PRAGMA table_info(provider_operation_inbox)');
  const providerInboxColumnNames = new Set(providerInboxColumns.map((column) => column.name));
  for (const columnName of [
    'semantic_key',
    'provider',
    'operation_type',
    'aggregate_type',
    'aggregate_id',
    'source',
    'provider_resource_id',
    'payload_hash',
    'correlation_id',
    'received_at',
    'consumed_at',
    'consumed_by'
  ]) {
    assert.equal(
      providerInboxColumnNames.has(columnName),
      true,
      `provider_operation_inbox.${columnName} should exist`
    );
  }

  const providerInboxUnconsumedIndex = await db.get(
    "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_provider_operation_inbox_unconsumed'"
  );
  assert.match(providerInboxUnconsumedIndex.sql, /consumed_at, received_at, provider/i);

  const generatedAssetColumns = await db.all('PRAGMA table_info(generated_assets)');
  const generatedAssetColumnNames = new Set(generatedAssetColumns.map((column) => column.name));

  assert.equal(generatedAssetColumnNames.has('order_id'), true);
  assert.equal(generatedAssetColumnNames.has('user_id'), true);
  assert.equal(generatedAssetColumnNames.has('storage_key'), true);
  assert.equal(generatedAssetColumnNames.has('checksum'), true);
  assert.equal(generatedAssetColumnNames.has('classification'), true);
  assert.equal(generatedAssetColumnNames.has('expires_at'), true);

  const seededServices = await db.all('SELECT slug, status FROM services ORDER BY display_order ASC');
  assert.ok(seededServices.some((service) => service.slug === 'paypal' && service.status === 'active'));
  assert.ok(seededServices.some((service) => service.slug === 'transaction-record' && service.status === 'active'));
  assert.ok(seededServices.some((service) => service.slug === 'faker-data' && service.status === 'sandbox'));
  assert.ok(seededServices.some((service) => service.slug === 'opay' && service.status === 'disabled'));
  assert.ok(seededServices.some((service) => service.slug === 'palmpay' && service.status === 'disabled'));

  await assert.rejects(
    db.run(
      `
        INSERT INTO services (id, slug, title, category, status, created_at, updated_at)
        VALUES ('invalid-status', 'invalid-status', 'Invalid', 'tests', 'available', ?, ?)
      `,
      [new Date().toISOString(), new Date().toISOString()]
    ),
    /services\.status is invalid/
  );
});
