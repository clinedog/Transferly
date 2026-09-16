'use strict';

const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function map(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    condition: parseJson(row.condition_json, {}),
    action: row.action,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pausedAt: row.paused_at
  };
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();
  await client.run(
    `INSERT INTO automation_rules
      (id, name, trigger, condition_json, action, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
    [id, data.name, data.trigger, serializeJson(data.condition), data.action, data.createdBy, now, now]
  );
  return findById(id, client);
}

async function findById(id, client = db) {
  return map(await client.get('SELECT * FROM automation_rules WHERE id = ?', [id]));
}

async function list(filters = {}, client = db) {
  const params = [];
  const where = [];
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  const rows = await client.all(
    `SELECT * FROM automation_rules ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY updated_at DESC LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 100), 250)]
  );
  return rows.map(map);
}

async function setStatus(id, status, client = db) {
  const now = new Date().toISOString();
  const result = await client.run(
    `UPDATE automation_rules SET status = ?, updated_at = ?, paused_at = CASE WHEN ? = 'PAUSED' THEN ? ELSE paused_at END WHERE id = ?`,
    [status, now, status, now, id]
  );
  return result.changes === 1 ? findById(id, client) : null;
}

module.exports = { automationRuleRepository: { create, findById, list, setStatus } };
