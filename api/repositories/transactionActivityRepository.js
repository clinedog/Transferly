const { db } = require('../db');

function mapActivity(row) {
  return {
    id: row.id,
    kind: row.kind,
    reference: row.reference || '',
    provider: row.provider || '',
    operation: row.operation || '',
    status: row.status || 'UNKNOWN',
    amountMinor: row.amount_minor == null ? null : Number(row.amount_minor),
    points: row.points == null ? null : Number(row.points),
    currency: row.currency || '',
    createdAt: row.created_at,
    reconciliationState: row.reconciliation_state || 'NOT_APPLICABLE'
  };
}

async function listForUser(userId, { query = '', kind = '', status = '', limit = 50 } = {}, client = db) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const params = [userId, userId, userId];
  const clauses = [];
  if (kind) clauses.push('kind = ?'), params.push(kind);
  if (status) clauses.push('status = ?'), params.push(status);
  if (normalizedQuery) {
    clauses.push('(lower(id) LIKE ? OR lower(reference) LIKE ? OR lower(provider) LIKE ? OR lower(operation) LIKE ?)');
    const value = `%${normalizedQuery}%`;
    params.push(value, value, value, value);
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 100));
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await client.all(`
    SELECT * FROM (
      SELECT id, 'funding' AS kind, public_reference AS reference, payment_method AS provider,
        'points funding' AS operation, status, expected_amount_minor AS amount_minor,
        requested_points AS points, currency, created_at, CASE WHEN status IN ('UNDER_REVIEW', 'MANUAL_REVIEW', 'NEEDS_MORE_INFORMATION') THEN 'RECONCILIATION_REQUIRED' ELSE 'NOT_APPLICABLE' END AS reconciliation_state
      FROM points_funding_requests WHERE user_id = ?
      UNION ALL
      SELECT id, 'top_up' AS kind, id AS reference, method_title AS provider,
        'points top-up' AS operation, status, NULL AS amount_minor, points, 'POINTS' AS currency,
        created_at, 'NOT_APPLICABLE' AS reconciliation_state
      FROM top_up_orders WHERE user_id = ?
      UNION ALL
      SELECT id, 'receipt' AS kind, id AS reference, 'transferly' AS provider,
        type AS operation, status, NULL AS amount_minor, cost_points AS points, 'POINTS' AS currency,
        created_at, 'NOT_APPLICABLE' AS reconciliation_state
      FROM receipts WHERE user_id = ?
    ) ${where} ORDER BY created_at DESC LIMIT ?`, params);
  return rows.map(mapActivity);
}

module.exports = { transactionActivityRepository: { listForUser }, mapActivity };
