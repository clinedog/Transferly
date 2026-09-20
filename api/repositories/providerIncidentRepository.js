'use strict';

const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function map(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    affectedOperation: row.affected_operation,
    impact: row.impact,
    evidence: parseJson(row.evidence_json, {}),
    actions: parseJson(row.actions_json, []),
    runbookKey: row.runbook_key,
    ownerRole: row.owner_role,
    detectedAt: row.detected_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at
  };
}

async function findById(id, client = db) {
  return map(await client.get('SELECT * FROM provider_incidents WHERE id = ?', [id]));
}

async function list(filters = {}, client = db) {
  const params = [];
  const where = [];
  if (filters.provider) {
    where.push('provider = ?');
    params.push(filters.provider);
  }
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  const rows = await client.all(
    `SELECT * FROM provider_incidents ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY updated_at DESC LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 100), 250)]
  );
  return rows.map(map);
}

async function upsertActive(data, client = db) {
  const existing = await client.get(
    `SELECT id FROM provider_incidents WHERE provider = ? AND status NOT IN ('RESOLVED', 'CLOSED')`,
    [data.provider]
  );
  const now = new Date().toISOString();
  if (existing) {
    await client.run(
      `UPDATE provider_incidents SET affected_operation = ?, impact = ?, evidence_json = ?, actions_json = ?, runbook_key = ?, owner_role = ?, updated_at = ?
       WHERE id = ?`,
      [data.affectedOperation, data.impact, serializeJson(data.evidence), serializeJson(data.actions), data.runbookKey, data.ownerRole, now, existing.id]
    );
    return findById(existing.id, client);
  }
  const id = data.id || randomUUID();
  await client.run(
    `INSERT INTO provider_incidents
      (id, provider, status, affected_operation, impact, evidence_json, actions_json, runbook_key, owner_role, detected_at, updated_at)
     VALUES (?, ?, 'DETECTED', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.provider, data.affectedOperation, data.impact, serializeJson(data.evidence), serializeJson(data.actions), data.runbookKey, data.ownerRole, data.detectedAt || now, now]
  );
  return findById(id, client);
}

async function transition(id, status, client = db) {
  const now = new Date().toISOString();
  const result = await client.run(
    `UPDATE provider_incidents SET status = ?, updated_at = ?,
      resolved_at = CASE WHEN ? = 'RESOLVED' THEN ? ELSE resolved_at END,
      closed_at = CASE WHEN ? = 'CLOSED' THEN ? ELSE closed_at END
     WHERE id = ?`,
    [status, now, status, now, status, now, id]
  );
  return result.changes === 1 ? findById(id, client) : null;
}

module.exports = { providerIncidentRepository: { findById, list, transition, upsertActive } };
