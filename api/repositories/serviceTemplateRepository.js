const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { serviceTemplateRecordSchema } = require('../schemas/serviceSchemas');
const { parseJson, serializeJson } = require('../utils/records');

function mapServiceTemplate(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    serviceId: row.service_id,
    service_id: row.service_id,
    templateKey: row.template_key,
    template_key: row.template_key,
    title: row.title,
    description: row.description,
    status: row.status,
    receiptType: row.receipt_type,
    receipt_type: row.receipt_type,
    costPoints: row.cost_points,
    cost_points: row.cost_points,
    inputSchema: parseJson(row.input_schema_json, {}),
    input_schema: parseJson(row.input_schema_json, {}),
    rendererConfig: parseJson(row.renderer_config_json, {}),
    renderer_config: parseJson(row.renderer_config_json, {}),
    previewAsset: row.preview_asset,
    preview_asset: row.preview_asset,
    version: row.version,
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
  const serviceId = input.serviceId || input.service_id;
  const templateKey = input.templateKey || input.template_key;
  const existing = await findByServiceIdAndKey(serviceId, templateKey, client);
  const costPoints = resolveInputValue(
    input,
    ['costPoints', 'cost_points'],
    existing?.costPoints,
    null
  );
  const candidate = serviceTemplateRecordSchema.parse({
    serviceId,
    templateKey,
    title: resolveInputValue(input, ['title', 'name'], existing?.title, null),
    description: resolveInputValue(input, ['description'], existing?.description, null),
    status: resolveInputValue(input, ['status'], existing?.status, 'active'),
    receiptType: resolveInputValue(input, ['receiptType', 'receipt_type'], existing?.receiptType, null),
    costPoints: costPoints === null ? null : Number(costPoints),
    inputSchema: resolveInputValue(input, ['inputSchema', 'input_schema'], existing?.inputSchema, {}),
    rendererConfig: resolveInputValue(
      input,
      ['rendererConfig', 'renderer_config'],
      existing?.rendererConfig,
      {}
    ),
    previewAsset: resolveInputValue(
      input,
      ['previewAsset', 'preview_asset'],
      existing?.previewAsset,
      null
    ),
    version: String(resolveInputValue(input, ['version'], existing?.version, '1')),
    metadata: resolveInputValue(input, ['metadata'], existing?.metadata, {})
  });

  await client.run(
    `
      INSERT INTO service_templates (
        id, service_id, template_key, title, description, status, receipt_type,
        cost_points, input_schema_json, renderer_config_json, preview_asset, version,
        metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(service_id, template_key) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        receipt_type = excluded.receipt_type,
        cost_points = excluded.cost_points,
        input_schema_json = excluded.input_schema_json,
        renderer_config_json = excluded.renderer_config_json,
        preview_asset = excluded.preview_asset,
        version = excluded.version,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `,
    [
      id,
      candidate.serviceId,
      candidate.templateKey,
      candidate.title,
      candidate.description,
      candidate.status,
      candidate.receiptType,
      candidate.costPoints,
      serializeJson(candidate.inputSchema),
      serializeJson(candidate.rendererConfig),
      candidate.previewAsset,
      candidate.version,
      serializeJson(candidate.metadata),
      existing?.createdAt || now,
      now
    ]
  );

  return findByServiceIdAndKey(serviceId, templateKey, client);
}

async function findByServiceIdAndKey(serviceId, templateKey, client = db) {
  const row = await client.get(
    'SELECT * FROM service_templates WHERE service_id = ? AND template_key = ?',
    [serviceId, templateKey]
  );
  return mapServiceTemplate(row);
}

async function findByServiceIdAndIdentifier(serviceId, identifier, client = db) {
  const normalizedIdentifier = String(identifier || '').trim();
  const row = await client.get(
    `
      SELECT *
      FROM service_templates
      WHERE service_id = ? AND (id = ? OR template_key = ?)
      LIMIT 1
    `,
    [serviceId, normalizedIdentifier, normalizedIdentifier]
  );
  return mapServiceTemplate(row);
}

async function findManyByServiceId(serviceId, filters = {}, client = db) {
  const where = ['service_id = ?'];
  const params = [serviceId];

  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }

  const rows = await client.all(
    `
      SELECT *
      FROM service_templates
      WHERE ${where.join(' AND ')}
      ORDER BY created_at ASC, title ASC
    `,
    params
  );

  return rows.map(mapServiceTemplate);
}

module.exports = {
  serviceTemplateRepository: {
    upsert,
    findByServiceIdAndKey,
    findByServiceIdAndIdentifier,
    findManyByServiceId
  }
};
