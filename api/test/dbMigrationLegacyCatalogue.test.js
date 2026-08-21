const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-legacy-catalogue-migration-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'catalogue-migration-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'catalogue-migration-webhook';

const { db, close } = require('../db');
const { migrate } = require('../db/migrate');
const { serviceRepository } = require('../repositories/serviceRepository');
const { serviceTemplateRepository } = require('../repositories/serviceTemplateRepository');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('migration upgrades a populated legacy catalogue without losing first-class manifest data', async () => {
  await db.exec(`
    CREATE TABLE services (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      badge TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      receipt_type TEXT,
      is_payment_provider INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE service_templates (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      template_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      receipt_type TEXT,
      cost_points INTEGER CHECK (cost_points IS NULL OR cost_points >= 0),
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
      UNIQUE(service_id, template_key)
    );

    INSERT INTO services (
      id, slug, title, category, badge, status, receipt_type,
      is_payment_provider, display_order, metadata_json, created_at, updated_at
    ) VALUES (
      'legacy-service', 'legacy-catalogue-service', 'Legacy catalogue service',
      'utilities', 'Legacy', 'available', 'legacy_receipt', 0, 500,
      '{"pointCost":7,"legacy":true}',
      '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
    );

    INSERT INTO service_templates (
      id, service_id, template_key, title, description, status,
      receipt_type, cost_points, metadata_json, created_at, updated_at
    ) VALUES (
      'legacy-template', 'legacy-service', 'legacy_standard', 'Legacy standard',
      'A legacy template.', 'active', 'legacy_receipt', 7,
      '{"legacy":true}',
      '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
    );
  `);

  await migrate();
  await migrate();

  const serviceColumns = new Set(
    (await db.all('PRAGMA table_info(services)')).map((column) => column.name)
  );
  const templateColumns = new Set(
    (await db.all('PRAGMA table_info(service_templates)')).map((column) => column.name)
  );
  const idempotencyRecordColumns = new Set(
    (await db.all('PRAGMA table_info(idempotency_records)')).map((column) => column.name)
  );

  for (const columnName of [
    'description',
    'point_price',
    'generator_key',
    'generator_version',
    'input_schema_json',
    'output_type',
    'configuration_json',
    'permissions_json',
    'queue_behavior_json',
    'retention_days',
    'execution_mode',
    'version',
    'feature_flag'
  ]) {
    assert.equal(serviceColumns.has(columnName), true, `services.${columnName} should exist`);
  }

  for (const columnName of [
    'input_schema_json',
    'renderer_config_json',
    'preview_asset',
    'version'
  ]) {
    assert.equal(templateColumns.has(columnName), true, `service_templates.${columnName} should exist`);
  }

  for (const columnName of [
    'user_id',
    'idempotency_key',
    'operation',
    'request_hash',
    'response_status',
    'response_payload'
  ]) {
    assert.equal(
      idempotencyRecordColumns.has(columnName),
      true,
      `idempotency_records.${columnName} should exist`
    );
  }

  const legacyService = await serviceRepository.findBySlug('legacy-catalogue-service');
  const legacyTemplate = await serviceTemplateRepository.findByServiceIdAndKey(
    legacyService.id,
    'legacy_standard'
  );

  assert.equal(legacyService.title, 'Legacy catalogue service');
  assert.equal(legacyService.status, 'disabled');
  assert.equal(legacyService.pointPrice, 0);
  assert.equal(legacyService.generatorKey, null);
  assert.deepEqual(legacyService.inputSchema, {});
  assert.deepEqual(legacyService.permissions, []);
  assert.equal(legacyService.executionMode, 'production');
  assert.equal(legacyService.version, '1');
  assert.deepEqual(legacyService.metadata, { pointCost: 7, legacy: true });
  assert.equal(legacyTemplate.costPoints, 7);
  assert.deepEqual(legacyTemplate.inputSchema, {});
  assert.deepEqual(legacyTemplate.rendererConfig, {});
  assert.equal(legacyTemplate.version, '1');

  const serviceStatusTriggers = await db.all(
    "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'services'"
  );
  assert.deepEqual(
    new Set(serviceStatusTriggers.map((trigger) => trigger.name)),
    new Set(['validate_services_status_insert', 'validate_services_status_update'])
  );

  const seededService = await serviceRepository.findBySlug('opay');
  await serviceRepository.upsert({
    slug: seededService.slug,
    description: 'A sandbox transaction record generator.',
    pointPrice: 12,
    generatorKey: 'transaction-record',
    generatorVersion: '1',
    inputSchema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string' }
      }
    },
    outputType: 'application/pdf',
    configuration: { maxBytes: 100000 },
    permissions: ['authenticated'],
    queueBehavior: { attempts: 3 },
    retentionDays: 7,
    executionMode: 'sandbox',
    version: '2',
    featureFlag: 'TRANSACTION_RECORDS_V1'
  });

  await serviceTemplateRepository.upsert({
    serviceId: seededService.id,
    templateKey: 'migration_standard',
    title: 'Migration standard',
    costPoints: '15',
    inputSchema: { type: 'object' },
    rendererConfig: { renderer: 'pdf-v1' },
    previewAsset: '/assets/migration-standard.png',
    version: '2'
  });

  await migrate();

  const preservedService = await serviceRepository.findBySlug('opay');
  const preservedTemplate = await serviceTemplateRepository.findByServiceIdAndKey(
    preservedService.id,
    'migration_standard'
  );

  assert.equal(preservedService.description, 'A sandbox transaction record generator.');
  assert.equal(preservedService.pointPrice, 12);
  assert.equal(preservedService.generatorKey, 'transaction-record');
  assert.equal(preservedService.generatorVersion, '1');
  assert.deepEqual(preservedService.inputSchema, {
    type: 'object',
    properties: {
      transactionId: { type: 'string' }
    }
  });
  assert.equal(preservedService.outputType, 'application/pdf');
  assert.deepEqual(preservedService.configuration, { maxBytes: 100000 });
  assert.deepEqual(preservedService.permissions, ['authenticated']);
  assert.deepEqual(preservedService.queueBehavior, { attempts: 3 });
  assert.equal(preservedService.retentionDays, 7);
  assert.equal(preservedService.executionMode, 'sandbox');
  assert.equal(preservedService.version, '2');
  assert.equal(preservedService.featureFlag, 'TRANSACTION_RECORDS_V1');

  assert.equal(preservedTemplate.costPoints, 15);
  assert.deepEqual(preservedTemplate.inputSchema, { type: 'object' });
  assert.deepEqual(preservedTemplate.rendererConfig, { renderer: 'pdf-v1' });
  assert.equal(preservedTemplate.previewAsset, '/assets/migration-standard.png');
  assert.equal(preservedTemplate.version, '2');
});
