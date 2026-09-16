const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapAuditLog(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at
  };
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  await client.run(
    `
      INSERT INTO audit_logs (id, actor_type, actor_id, action, entity_type, entity_id, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      data.actorType,
      data.actorId || null,
      data.action,
      data.entityType,
      data.entityId,
      serializeJson(data.metadata || {}),
      now
    ]
  );
}

async function findManyForEntity(entityType, entityId, options = {}, client = db) {
  const params = [entityType, entityId];
  let sql = `
    SELECT id, actor_type, actor_id, action, entity_type, entity_id, metadata_json, created_at
    FROM audit_logs
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `;

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = await client.all(sql, params);
  return rows.map(mapAuditLog);
}

async function findMany(filters = {}, client = db) {
  const where = [];
  const params = [];
  if (filters.actorType) {
    where.push('actor_type = ?');
    params.push(filters.actorType);
  }
  if (filters.action) {
    where.push('action LIKE ?');
    params.push(`%${filters.action}%`);
  }
  if (filters.entityType) {
    where.push('entity_type = ?');
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    where.push('entity_id = ?');
    params.push(filters.entityId);
  }
  if (filters.before) {
    where.push('created_at < ?');
    params.push(filters.before);
  }
  const limit = Math.min(Number(filters.limit || 100), 250);
  const rows = await client.all(
    `
      SELECT id, actor_type, actor_id, action, entity_type, entity_id, metadata_json, created_at
      FROM audit_logs
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    [...params, limit]
  );
  return rows.map(mapAuditLog);
}

module.exports = {
  auditLogRepository: {
    create,
    findManyForEntity,
    findMany
  }
};
