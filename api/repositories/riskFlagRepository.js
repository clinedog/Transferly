const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapRiskFlag(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    invoiceId: row.invoice_id,
    payoutId: row.payout_id,
    ruleCode: row.rule_code,
    severity: row.severity,
    status: row.status,
    reason: row.reason,
    metadata: parseJson(row.metadata_json, {}),
    operatorId: row.operator_id,
    assignedAt: row.assigned_at,
    escalatedAt: row.escalated_at,
    escalationNote: row.escalation_note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at
  };
}

async function createMany(flags, client = db) {
  if (!flags.length) {
    return;
  }

  const now = new Date().toISOString();
  for (const flag of flags) {
    await client.run(
      `
        INSERT INTO risk_flags (
          id, user_id, invoice_id, payout_id, rule_code, severity, status, reason, metadata_json, created_at, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        flag.userId || null,
        flag.invoiceId || null,
        flag.payoutId || null,
        flag.ruleCode,
        flag.severity,
        flag.status || (flag.severity === 'HIGH' ? 'ESCALATED' : 'OPEN'),
        flag.reason,
        serializeJson(flag.metadata || {}),
        now,
        flag.resolvedAt || null
      ]
    );
  }
}

async function findMany(filters = {}, client = db) {
  const clauses = [];
  const params = [];

  if (filters.userId) { clauses.push('user_id = ?'); params.push(filters.userId); }
  if (filters.status) { clauses.push('status = ?'); params.push(filters.status); }
  if (filters.severity) { clauses.push('severity = ?'); params.push(filters.severity); }
  if (filters.operatorId) { clauses.push('operator_id = ?'); params.push(filters.operatorId); }
  if (filters.escalated === true) { clauses.push('escalated_at IS NOT NULL'); }

  let sql = 'SELECT * FROM risk_flags';
  if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
  sql += ' ORDER BY created_at DESC';
  if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit); }

  const rows = await client.all(sql, params);
  return rows.map(mapRiskFlag);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM risk_flags WHERE id = ?', [id]);
  return mapRiskFlag(row);
}

async function update(id, updates, client = db) {
  const fields = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(updates, 'status')) { fields.push('status = ?'); params.push(updates.status); }
  if (Object.prototype.hasOwnProperty.call(updates, 'operatorId')) { fields.push('operator_id = ?'); params.push(updates.operatorId); }
  if (Object.prototype.hasOwnProperty.call(updates, 'assignedAt')) { fields.push('assigned_at = ?'); params.push(updates.assignedAt); }
  if (Object.prototype.hasOwnProperty.call(updates, 'escalatedAt')) { fields.push('escalated_at = ?'); params.push(updates.escalatedAt); }
  if (Object.prototype.hasOwnProperty.call(updates, 'escalationNote')) { fields.push('escalation_note = ?'); params.push(updates.escalationNote); }
  if (Object.prototype.hasOwnProperty.call(updates, 'resolvedAt')) { fields.push('resolved_at = ?'); params.push(updates.resolvedAt); }

  if (!fields.length) return findById(id, client);
  params.push(id);
  await client.run(`UPDATE risk_flags SET ${fields.join(', ')} WHERE id = ?`, params);
  return findById(id, client);
}

module.exports = {
  riskFlagRepository: {
    createMany,
    findMany,
    findById,
    update
  }
};
