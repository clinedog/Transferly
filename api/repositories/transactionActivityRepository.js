const { db } = require('../db');

function mapActivity(row) {
  return {
    id: row.id,
    kind: row.kind,
    reference: row.reference || '',
    providerReference: row.provider_reference || '',
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

const activitySourcesSql = `
  SELECT id, user_id, 'funding' AS kind, public_reference AS reference, payment_reference AS provider_reference, payment_method AS provider,
    'points funding' AS operation, status, expected_amount_minor AS amount_minor,
    requested_points AS points, currency, created_at, CASE WHEN status IN ('UNDER_REVIEW', 'MANUAL_REVIEW', 'NEEDS_MORE_INFORMATION') THEN 'RECONCILIATION_REQUIRED' ELSE 'NOT_APPLICABLE' END AS reconciliation_state,
    'points_funding_request' AS entity_type
  FROM points_funding_requests
  UNION ALL
  SELECT id, user_id, 'top_up' AS kind, id AS reference, id AS provider_reference, method_title AS provider,
    'points top-up' AS operation, status, NULL AS amount_minor, points, 'POINTS' AS currency,
    created_at, 'NOT_APPLICABLE' AS reconciliation_state, 'top_up_order' AS entity_type
  FROM top_up_orders
  UNION ALL
  SELECT id, user_id, 'receipt' AS kind, id AS reference, id AS provider_reference, 'transferly' AS provider,
    type AS operation, status, NULL AS amount_minor, cost_points AS points, 'POINTS' AS currency,
    created_at, 'NOT_APPLICABLE' AS reconciliation_state, 'receipt' AS entity_type
  FROM receipts
  UNION ALL
  SELECT id, user_id, 'invoice' AS kind, COALESCE(invoice_number, paypal_invoice_id, id) AS reference,
    paypal_invoice_id AS provider_reference,
    'paypal' AS provider, 'invoice' AS operation, status, amount_cents AS amount_minor,
    NULL AS points, currency_code AS currency, created_at,
    CASE WHEN upper(status) IN ('UNKNOWN', 'RECONCILING', 'RECONCILIATION_REQUIRED')
      THEN 'RECONCILIATION_REQUIRED' ELSE 'NOT_APPLICABLE' END AS reconciliation_state,
    'invoice' AS entity_type
  FROM invoices
  UNION ALL
  SELECT id, user_id, 'payout' AS kind, COALESCE(paypal_payout_item_id, sender_batch_id, id) AS reference,
    paypal_payout_item_id AS provider_reference,
    'paypal' AS provider, 'payout' AS operation, status, amount_cents AS amount_minor,
    NULL AS points, currency_code AS currency, created_at,
    CASE WHEN upper(status) IN ('UNKNOWN', 'RECONCILING', 'RECONCILIATION_REQUIRED')
      THEN 'RECONCILIATION_REQUIRED' ELSE 'NOT_APPLICABLE' END AS reconciliation_state,
    'payout' AS entity_type
  FROM payouts
`;

function mapTimelineEvent(row) {
  return {
    id: row.id,
    action: row.action || row.type || row.operation || 'activity.recorded',
    source: row.source || row.actor_type || 'system',
    status: row.status || null,
    provider: row.provider || null,
    providerReference: row.provider_reference || null,
    createdAt: row.created_at || row.received_at || null
  };
}

function mapRelatedTransaction(row) {
  return {
    id: row.id,
    type: row.reference_type || row.type || 'transaction',
    reference: row.reference_id || row.id,
    amountMinor: row.amount_cents == null ? null : Number(row.amount_cents),
    points: row.points == null ? null : Number(row.points),
    currency: row.currency_code || row.currency || '',
    status: row.status || null,
    createdAt: row.created_at
  };
}

async function listForUser(userId, {
  query = '',
  kind = '',
  status = '',
  provider = '',
  currency = '',
  from = '',
  to = '',
  limit = 50
} = {}, client = db) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const params = [userId];
  const clauses = ['user_id = ?'];
  if (kind) clauses.push('kind = ?'), params.push(kind);
  if (status) clauses.push('status = ?'), params.push(status);
  if (provider) clauses.push('lower(provider) = lower(?)'), params.push(provider);
  if (currency) clauses.push('upper(currency) = upper(?)'), params.push(currency);
  if (from) clauses.push('created_at >= ?'), params.push(from);
  if (to) clauses.push('created_at <= ?'), params.push(to);
  if (normalizedQuery) {
    clauses.push('(lower(id) LIKE ? OR lower(reference) LIKE ? OR lower(provider_reference) LIKE ? OR lower(provider) LIKE ? OR lower(operation) LIKE ?)');
    const value = `%${normalizedQuery}%`;
    params.push(value, value, value, value, value);
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 100));
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await client.all(`
    SELECT * FROM (${activitySourcesSql}) ${where} ORDER BY created_at DESC LIMIT ?`, params);
  return rows.map(mapActivity);
}

async function findForUser(userId, activityId, client = db) {
  const row = await client.get(
    `SELECT * FROM (${activitySourcesSql}) WHERE user_id = ? AND id = ? LIMIT 1`,
    [userId, activityId]
  );
  if (!row) return null;

  const entityAliases = row.entity_type === 'points_funding_request'
    ? ['points_funding_request']
    : [row.entity_type];
  const entityPlaceholders = entityAliases.map(() => '?').join(', ');
  const auditRows = await client.all(
    `SELECT id, action, actor_type, created_at
       FROM audit_logs
      WHERE entity_type IN (${entityPlaceholders}) AND entity_id = ?
      ORDER BY created_at ASC LIMIT 100`,
    [...entityAliases, row.id]
  );
  const providerRows = await client.all(
    `SELECT id, source, provider, provider_status AS status, provider_resource_id AS provider_reference, received_at AS created_at
       FROM provider_operation_inbox
      WHERE aggregate_type = ? AND aggregate_id = ?
      ORDER BY received_at ASC LIMIT 100`,
    [row.entity_type, row.id]
  );
  const webhookSearch = [row.id, row.reference, row.provider_reference]
    .filter(Boolean)
    .map((value) => `%${String(value).toLowerCase()}%`);
  const webhookRows = webhookSearch.length
    ? await client.all(
      `SELECT id, event_id, event_type, resource_type, status, processed_at, created_at
         FROM webhook_events
        WHERE lower(payload_json) LIKE ${webhookSearch.map(() => '?').join(' OR ')}
        ORDER BY created_at ASC LIMIT 100`,
      webhookSearch
    )
    : [];
  const ledgerRows = await client.all(
    `SELECT id, type, reference_type, reference_id, amount_cents, currency_code, created_at
       FROM ledger_entries
      WHERE user_id = ? AND (reference_id = ? OR external_reference = ?)
      ORDER BY created_at ASC LIMIT 100`,
    [userId, row.id, row.reference]
  );
  const pointRows = await client.all(
    `SELECT id, type, reference_type, reference_id, amount AS points, created_at
       FROM points_transactions
      WHERE user_id = ? AND (reference_id = ? OR reference_id = ?)
      ORDER BY created_at ASC LIMIT 100`,
    [userId, row.id, row.reference]
  );

  const timeline = [
    { id: `${row.id}:created`, action: 'activity.created', source: 'transferly', status: row.status, created_at: row.created_at },
    ...auditRows,
    ...providerRows,
    ...webhookRows.map((event) => ({
      id: event.id,
      action: event.event_type || 'webhook.received',
      source: 'webhook',
      status: event.status,
      provider: row.provider,
      provider_reference: event.event_id,
      created_at: event.processed_at || event.created_at
    }))
  ].sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')));

  return {
    ...mapActivity(row),
    timeline: timeline.map(mapTimelineEvent),
    relatedTransactions: [...ledgerRows, ...pointRows]
      .sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')))
      .map(mapRelatedTransaction),
    webhookHistory: webhookRows.map((event) => ({
      id: event.id,
      eventId: event.event_id,
      eventType: event.event_type,
      resourceType: event.resource_type,
      status: event.status,
      processedAt: event.processed_at,
      createdAt: event.created_at
    }))
  };
}

module.exports = { transactionActivityRepository: { listForUser, findForUser }, mapActivity };
