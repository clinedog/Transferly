'use strict';

const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function map(row) {
  if (!row) return null;
  return {
    id: row.id,
    ruleId: row.rule_id,
    mode: row.mode,
    status: row.status,
    event: parseJson(row.event_json, {}),
    result: parseJson(row.result_json, {}),
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

async function findByIdempotencyKey(key, client = db) {
  return map(await client.get('SELECT * FROM automation_executions WHERE idempotency_key = ?', [key]));
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();
  await client.run(
    `INSERT INTO automation_executions
      (id, rule_id, mode, status, event_json, result_json, idempotency_key, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.ruleId, data.mode, data.status, serializeJson(data.event), serializeJson(data.result), data.idempotencyKey, now, data.completedAt || now]
  );
  return map(await client.get('SELECT * FROM automation_executions WHERE id = ?', [id]));
}

async function update(id, data, client = db) {
  const fields = [];
  const values = [];
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }
  if (data.result !== undefined) {
    fields.push('result_json = ?');
    values.push(serializeJson(data.result));
  }
  if (data.completedAt !== undefined) {
    fields.push('completed_at = ?');
    values.push(data.completedAt);
  }
  if (!fields.length) return findById(id, client);
  values.push(id);
  await client.run(`UPDATE automation_executions SET ${fields.join(', ')} WHERE id = ?`, values);
  return map(await client.get('SELECT * FROM automation_executions WHERE id = ?', [id]));
}

async function findById(id, client = db) {
  return map(await client.get('SELECT * FROM automation_executions WHERE id = ?', [id]));
}

async function list(filters = {}, client = db) {
  const params = [];
  const where = [];
  if (filters.ruleId) {
    where.push('rule_id = ?');
    params.push(filters.ruleId);
  }
  const rows = await client.all(
    `SELECT * FROM automation_executions ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 100), 250)]
  );
  return rows.map(map);
}

module.exports = { automationExecutionRepository: { create, findById, findByIdempotencyKey, list, update } };
