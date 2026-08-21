const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { AVAILABLE_SERVICE_STATUSES } = require('../constants/serviceCatalogue');
const { serviceManifestRecordSchema } = require('../schemas/serviceSchemas');
const { parseJson, serializeJson } = require('../utils/records');

function mapService(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    title: row.title,
    category: row.category,
    description: row.description,
    pointPrice: row.point_price,
    point_price: row.point_price,
    badge: row.badge,
    status: row.status,
    generatorKey: row.generator_key,
    generator_key: row.generator_key,
    generatorVersion: row.generator_version,
    generator_version: row.generator_version,
    inputSchema: parseJson(row.input_schema_json, {}),
    input_schema: parseJson(row.input_schema_json, {}),
    outputType: row.output_type,
    output_type: row.output_type,
    configuration: parseJson(row.configuration_json, {}),
    permissions: parseJson(row.permissions_json, []),
    queueBehavior: parseJson(row.queue_behavior_json, {}),
    queue_behavior: parseJson(row.queue_behavior_json, {}),
    retentionDays: row.retention_days,
    retention_days: row.retention_days,
    executionMode: row.execution_mode,
    execution_mode: row.execution_mode,
    version: row.version,
    featureFlag: row.feature_flag,
    feature_flag: row.feature_flag,
    receiptType: row.receipt_type,
    receipt_type: row.receipt_type,
    isPaymentProvider: Boolean(row.is_payment_provider),
    is_payment_provider: Boolean(row.is_payment_provider),
    displayOrder: row.display_order,
    display_order: row.display_order,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

const MISSING = Symbol('missing');

function getInputValue(input, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(input, alias) && input[alias] !== undefined) {
      return input[alias];
    }
  }

  return MISSING;
}

function resolveInputValue(input, aliases, existingValue, defaultValue) {
  const value = getInputValue(input, aliases);
  if (value !== MISSING) {
    return value;
  }

  return existingValue ?? defaultValue;
}

async function upsert(input, client = db) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const slug = String(input.slug || '').trim().toLowerCase();
  const existing = await findBySlug(slug, client);
  const candidate = serviceManifestRecordSchema.parse({
    slug,
    title: resolveInputValue(input, ['title', 'name'], existing?.title, null),
    category: resolveInputValue(input, ['category'], existing?.category, null),
    description: resolveInputValue(input, ['description'], existing?.description, null),
    pointPrice: Number(resolveInputValue(input, ['pointPrice', 'point_price'], existing?.pointPrice, 0)),
    badge: resolveInputValue(input, ['badge'], existing?.badge, null),
    status: resolveInputValue(input, ['status'], existing?.status, 'draft'),
    generatorKey: resolveInputValue(
      input,
      ['generatorKey', 'generator_key', 'generator'],
      existing?.generatorKey,
      null
    ),
    generatorVersion: resolveInputValue(
      input,
      ['generatorVersion', 'generator_version'],
      existing?.generatorVersion,
      null
    ),
    inputSchema: resolveInputValue(input, ['inputSchema', 'input_schema'], existing?.inputSchema, {}),
    outputType: resolveInputValue(input, ['outputType', 'output_type'], existing?.outputType, null),
    configuration: resolveInputValue(input, ['configuration'], existing?.configuration, {}),
    permissions: resolveInputValue(input, ['permissions'], existing?.permissions, []),
    queueBehavior: resolveInputValue(
      input,
      ['queueBehavior', 'queue_behavior'],
      existing?.queueBehavior,
      {}
    ),
    retentionDays: resolveInputValue(
      input,
      ['retentionDays', 'retention_days'],
      existing?.retentionDays,
      null
    ),
    executionMode: resolveInputValue(
      input,
      ['executionMode', 'execution_mode', 'mode'],
      existing?.executionMode,
      'production'
    ),
    version: String(resolveInputValue(input, ['version'], existing?.version, '1')),
    featureFlag: resolveInputValue(
      input,
      ['featureFlag', 'feature_flag'],
      existing?.featureFlag,
      null
    ),
    receiptType: resolveInputValue(input, ['receiptType', 'receipt_type'], existing?.receiptType, null),
    isPaymentProvider: Boolean(resolveInputValue(
      input,
      ['isPaymentProvider', 'is_payment_provider'],
      existing?.isPaymentProvider,
      false
    )),
    displayOrder: Number(resolveInputValue(
      input,
      ['displayOrder', 'display_order'],
      existing?.displayOrder,
      0
    )),
    metadata: resolveInputValue(input, ['metadata'], existing?.metadata, {})
  });

  await client.run(
    `
      INSERT INTO services (
        id, slug, title, category, description, point_price, badge, status,
        generator_key, generator_version, input_schema_json, output_type,
        configuration_json, permissions_json, queue_behavior_json, retention_days,
        execution_mode, version, feature_flag, receipt_type, is_payment_provider,
        display_order, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        description = excluded.description,
        point_price = excluded.point_price,
        badge = excluded.badge,
        status = excluded.status,
        generator_key = excluded.generator_key,
        generator_version = excluded.generator_version,
        input_schema_json = excluded.input_schema_json,
        output_type = excluded.output_type,
        configuration_json = excluded.configuration_json,
        permissions_json = excluded.permissions_json,
        queue_behavior_json = excluded.queue_behavior_json,
        retention_days = excluded.retention_days,
        execution_mode = excluded.execution_mode,
        version = excluded.version,
        feature_flag = excluded.feature_flag,
        receipt_type = excluded.receipt_type,
        is_payment_provider = excluded.is_payment_provider,
        display_order = excluded.display_order,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `,
    [
      id,
      candidate.slug,
      candidate.title,
      candidate.category,
      candidate.description,
      candidate.pointPrice,
      candidate.badge,
      candidate.status,
      candidate.generatorKey,
      candidate.generatorVersion,
      serializeJson(candidate.inputSchema),
      candidate.outputType,
      serializeJson(candidate.configuration),
      serializeJson(candidate.permissions),
      serializeJson(candidate.queueBehavior),
      candidate.retentionDays,
      candidate.executionMode,
      candidate.version,
      candidate.featureFlag,
      candidate.receiptType,
      candidate.isPaymentProvider ? 1 : 0,
      candidate.displayOrder,
      serializeJson(candidate.metadata),
      existing?.createdAt || now,
      now
    ]
  );

  return findBySlug(slug, client);
}

async function findMany(filters = {}, client = db) {
  const where = [];
  const params = [];

  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }

  if (filters.statuses?.length) {
    where.push(`status IN (${filters.statuses.map(() => '?').join(', ')})`);
    params.push(...filters.statuses);
  }

  if (filters.category) {
    where.push('category = ?');
    params.push(filters.category);
  }

  const rows = await client.all(
    `
      SELECT *
      FROM services
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY display_order ASC, title ASC
    `,
    params
  );

  return rows.map(mapService);
}

async function findBySlug(slug, client = db) {
  const row = await client.get('SELECT * FROM services WHERE slug = ?', [String(slug || '').trim().toLowerCase()]);
  return mapService(row);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM services WHERE id = ?', [id]);
  return mapService(row);
}

async function findAvailableBySlug(slug, client = db) {
  const row = await client.get(
    `SELECT * FROM services WHERE slug = ? AND status IN (${AVAILABLE_SERVICE_STATUSES.map(() => '?').join(', ')})`,
    [String(slug || '').trim().toLowerCase(), ...AVAILABLE_SERVICE_STATUSES]
  );
  return mapService(row);
}

module.exports = {
  AVAILABLE_SERVICE_STATUSES,
  serviceRepository: {
    upsert,
    findMany,
    findById,
    findBySlug,
    findAvailableBySlug
  }
};
