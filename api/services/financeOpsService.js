const { db } = require('../db');
const { paymentProviderTransactionRepository } = require('../repositories/paymentProviderTransactionRepository');
const { parseJson } = require('../utils/records');

function todayPrefix() {
  return new Date().toISOString().slice(0, 10);
}

function monthPrefix() {
  return new Date().toISOString().slice(0, 7);
}

function mapTransaction(row) {
  return {
    id: row.id,
    entry_key: row.entry_key,
    user_id: row.user_id,
    type: row.type,
    direction: Number(row.amount || 0) >= 0 ? 'CREDIT' : 'DEBIT',
    points: Math.abs(Number(row.amount || 0)),
    signed_points: Number(row.amount || 0),
    description: row.description,
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    balance_after: row.balance_after,
    metadata: parseJson(row.metadata_json, {}),
    created_at: row.created_at
  };
}

function mapAlert(row) {
  return {
    id: row.id,
    alert_type: row.alert_type,
    severity: row.severity,
    status: row.status,
    user_id: row.user_id,
    funding_request_id: row.funding_request_id,
    expected_points: row.expected_points,
    actual_points: row.actual_points,
    details: parseJson(row.details_json, {}),
    created_at: row.created_at,
    resolved_at: row.resolved_at
  };
}

async function getOverview() {
  const [ledger, funding, reconciliation] = await Promise.all([
    db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_credits,
        COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS total_debits,
        COALESCE(SUM(amount), 0) AS outstanding_points,
        COALESCE(SUM(CASE WHEN type IN ('POINT_RESERVATION_HOLD', 'RECEIPT_SPEND', 'EMAIL_SPEND') AND amount < 0 THEN -amount ELSE 0 END), 0) AS consumed_points,
        COALESCE(SUM(CASE WHEN type IN ('POINT_RESERVATION_RELEASE', 'REFUND', 'REVERSAL') AND amount > 0 THEN amount ELSE 0 END), 0) AS refunded_points,
        COALESCE(SUM(CASE WHEN type = 'ADMIN_ADJUSTMENT' THEN amount ELSE 0 END), 0) AS adjustment_points
      FROM points_transactions
    `),
    db.get(
      `
        SELECT
          COALESCE(SUM(CASE WHEN status = 'POINTS_CREDITED' THEN expected_amount_minor ELSE 0 END), 0) AS total_funding_minor,
          COALESCE(SUM(CASE WHEN status = 'POINTS_CREDITED' AND substr(credited_at, 1, 10) = ? THEN expected_amount_minor ELSE 0 END), 0) AS funding_today_minor,
          COALESCE(SUM(CASE WHEN status = 'POINTS_CREDITED' AND substr(credited_at, 1, 7) = ? THEN expected_amount_minor ELSE 0 END), 0) AS funding_month_minor,
          SUM(CASE WHEN status IN ('PAYMENT_REPORTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION') THEN 1 ELSE 0 END) AS pending_funding,
          SUM(CASE WHEN status IN ('PAYMENT_REPORTED', 'UNDER_REVIEW') THEN 1 ELSE 0 END) AS needs_review,
          SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_funding,
          SUM(CASE WHEN possible_duplicate = 1 OR risk_status <> 'NORMAL' THEN 1 ELSE 0 END) AS suspicious_transactions
        FROM points_funding_requests
      `,
      [todayPrefix(), monthPrefix()]
    ),
    db.get("SELECT COUNT(*) AS count FROM points_reconciliation_alerts WHERE status = 'OPEN'")
  ]);

  return {
    total_points_in_circulation: Number(ledger?.outstanding_points || 0),
    total_points_issued: Number(ledger?.total_credits || 0),
    total_points_consumed: Number(ledger?.consumed_points || 0),
    total_points_refunded: Number(ledger?.refunded_points || 0),
    total_adjustment_points: Number(ledger?.adjustment_points || 0),
    total_funding_minor: Number(funding?.total_funding_minor || 0),
    funding_today_minor: Number(funding?.funding_today_minor || 0),
    funding_month_minor: Number(funding?.funding_month_minor || 0),
    pending_funding: Number(funding?.pending_funding || 0),
    needs_review: Number(funding?.needs_review || 0),
    rejected_funding: Number(funding?.rejected_funding || 0),
    suspicious_transactions: Number(funding?.suspicious_transactions || 0),
    reconciliation_issues: Number(reconciliation?.count || 0),
    reconciliation_status: Number(reconciliation?.count || 0) > 0 ? 'ERROR' : 'HEALTHY'
  };
}

async function listTransactions(filters = {}) {
  const where = [];
  const params = [];
  if (filters.userId) {
    where.push('user_id = ?');
    params.push(filters.userId);
  }
  if (filters.type) {
    where.push('type = ?');
    params.push(filters.type);
  }
  if (filters.reference) {
    where.push('(reference_id LIKE ? OR entry_key LIKE ? OR description LIKE ?)');
    const term = `%${filters.reference}%`;
    params.push(term, term, term);
  }
  if (filters.direction === 'CREDIT') {
    where.push('amount > 0');
  }
  if (filters.direction === 'DEBIT') {
    where.push('amount < 0');
  }
  const limit = Math.min(Number(filters.limit || 100), 250);
  const rows = await db.all(
    `SELECT * FROM points_transactions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  );
  return { data: rows.map(mapTransaction) };
}

async function getUserFinanceProfile(userId) {
  const [profile, ledger, reservations, funding] = await Promise.all([
    db.get('SELECT user_id, points FROM profiles WHERE user_id = ?', [userId]),
    db.get(
      `
        SELECT
          COALESCE(SUM(amount), 0) AS balance,
          COALESCE(SUM(CASE WHEN type = 'PURCHASE_CREDIT' THEN amount ELSE 0 END), 0) AS purchased,
          COALESCE(SUM(CASE WHEN type IN ('POINT_RESERVATION_HOLD', 'RECEIPT_SPEND', 'EMAIL_SPEND') AND amount < 0 THEN -amount ELSE 0 END), 0) AS consumed,
          COALESCE(SUM(CASE WHEN type IN ('POINT_RESERVATION_RELEASE', 'REFUND', 'REVERSAL') AND amount > 0 THEN amount ELSE 0 END), 0) AS refunded,
          COALESCE(SUM(CASE WHEN type = 'ADMIN_ADJUSTMENT' THEN amount ELSE 0 END), 0) AS adjustments
        FROM points_transactions
        WHERE user_id = ?
      `,
      [userId]
    ),
    db.get(
      "SELECT COALESCE(SUM(amount), 0) AS reserved FROM point_reservations WHERE user_id = ? AND status = 'RESERVED'",
      [userId]
    ),
    db.get(
      `
        SELECT
          SUM(CASE WHEN status IN ('PAYMENT_REPORTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION') THEN 1 ELSE 0 END) AS pending_funding,
          SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_funding,
          SUM(CASE WHEN possible_duplicate = 1 OR risk_status <> 'NORMAL' THEN 1 ELSE 0 END) AS risk_flags
        FROM points_funding_requests
        WHERE user_id = ?
      `,
      [userId]
    )
  ]);

  return {
    user_id: userId,
    available_points: Number(profile?.points ?? ledger?.balance ?? 0),
    reserved_points: Number(reservations?.reserved || 0),
    total_points: Number(profile?.points ?? ledger?.balance ?? 0) + Number(reservations?.reserved || 0),
    purchased_points: Number(ledger?.purchased || 0),
    consumed_points: Number(ledger?.consumed || 0),
    refunded_points: Number(ledger?.refunded || 0),
    adjustment_points: Number(ledger?.adjustments || 0),
    pending_funding: Number(funding?.pending_funding || 0),
    rejected_funding: Number(funding?.rejected_funding || 0),
    risk_flags: Number(funding?.risk_flags || 0)
  };
}

async function listReconciliationAlerts(filters = {}) {
  const where = [];
  const params = [];
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.userId) {
    where.push('user_id = ?');
    params.push(filters.userId);
  }
  const limit = Math.min(Number(filters.limit || 100), 250);
  const rows = await db.all(
    `SELECT * FROM points_reconciliation_alerts ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  );
  return { data: rows.map(mapAlert) };
}

async function listPaymentTransactions(filters = {}) {
  return { data: await paymentProviderTransactionRepository.list(filters) };
}

async function getAnalytics({ period = '30d', from, to } = {}) {
  const days = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[period] || 30;
  const since = period === 'custom' && from ? new Date(from).toISOString() : new Date(Date.now() - days * 86400000).toISOString();
  const until = period === 'custom' && to ? new Date(to).toISOString() : new Date().toISOString();
  const range = 'created_at >= ? AND created_at < ?';
  const [ledger, payments, providerRows, funding, issues, payouts, invoices] = await Promise.all([
    db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS money_in,
        COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS money_out,
        COUNT(*) AS transaction_count
      FROM points_transactions WHERE ${range}
    `, [since, until]),
    db.get(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(amount_minor), 0) AS volume,
        COALESCE(SUM(CASE WHEN lower(status) IN ('success', 'succeeded', 'completed', 'paid') THEN 1 ELSE 0 END), 0) AS successful,
        COALESCE(SUM(CASE WHEN lower(status) IN ('failed', 'rejected', 'cancelled', 'canceled') THEN 1 ELSE 0 END), 0) AS failed
      FROM payment_provider_transactions WHERE ${range}
    `, [since, until]),
    db.all(`
      SELECT provider, COUNT(*) AS count, COALESCE(SUM(amount_minor), 0) AS volume,
        COALESCE(SUM(CASE WHEN lower(status) IN ('success', 'succeeded', 'completed', 'paid') THEN 1 ELSE 0 END), 0) AS successful,
        COALESCE(SUM(CASE WHEN lower(status) IN ('failed', 'rejected', 'cancelled', 'canceled') THEN 1 ELSE 0 END), 0) AS failed,
        COALESCE(SUM(CASE WHEN json_valid(metadata_json) THEN CAST(json_extract(metadata_json, '$.fee_minor') AS INTEGER) ELSE 0 END), 0) AS fees,
        AVG(CASE WHEN transaction_time IS NOT NULL THEN MAX(0, (julianday(updated_at) - julianday(transaction_time)) * 86400000) END) AS average_latency_ms
      FROM payment_provider_transactions
      WHERE ${range}
      GROUP BY provider
      ORDER BY volume DESC
    `, [since, until]),
    db.get(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(expected_amount_minor), 0) AS volume,
        COALESCE(SUM(CASE WHEN status = 'POINTS_CREDITED' THEN 1 ELSE 0 END), 0) AS collected,
        COALESCE(SUM(CASE WHEN status IN ('PAYMENT_REPORTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION', 'MANUAL_REVIEW') THEN 1 ELSE 0 END), 0) AS pending
      FROM points_funding_requests WHERE ${range}
    `, [since, until]),
    db.get(`
      SELECT COUNT(*) AS count
      FROM payment_ops_issues
      WHERE status NOT IN ('RESOLVED', 'IGNORED_WITH_REASON') AND ${range}
    `, [since, until]),
    db.get(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS volume,
        COALESCE(SUM(CASE WHEN lower(status) IN ('completed', 'paid', 'success', 'succeeded') THEN 1 ELSE 0 END), 0) AS successful,
        COALESCE(SUM(CASE WHEN lower(status) IN ('failed', 'rejected', 'cancelled', 'canceled') THEN 1 ELSE 0 END), 0) AS failed
      FROM payouts WHERE ${range}
    `, [since, until]),
    db.get(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS revenue,
        COALESCE(SUM(CASE WHEN lower(status) IN ('paid', 'completed', 'success', 'succeeded') THEN amount_cents ELSE 0 END), 0) AS collected,
        COALESCE(SUM(CASE WHEN lower(status) IN ('sent', 'created', 'pending', 'unpaid') THEN amount_cents ELSE 0 END), 0) AS outstanding,
        COALESCE(SUM(CASE WHEN due_date < ? AND lower(status) NOT IN ('paid', 'completed', 'cancelled', 'canceled') THEN amount_cents ELSE 0 END), 0) AS overdue
      FROM invoices WHERE ${range}
    `, [until, since, until])
  ]);
  const paymentCount = Number(payments?.count || 0);
  return {
    period,
    since,
    until,
    money_in_points: Number(ledger?.money_in || 0),
    money_out_points: Number(ledger?.money_out || 0),
    net_flow_points: Number(ledger?.money_in || 0) - Number(ledger?.money_out || 0),
    ledger_transaction_count: Number(ledger?.transaction_count || 0),
    payment_volume_minor: Number(payments?.volume || 0),
    payment_count: paymentCount,
    payment_success_count: Number(payments?.successful || 0),
    payment_failure_count: Number(payments?.failed || 0),
    payment_success_rate: paymentCount ? Number(payments.successful || 0) / paymentCount : null,
    payment_average_value_minor: paymentCount ? Number(payments.volume || 0) / paymentCount : 0,
    provider_distribution: providerRows.map((row) => ({
      provider: row.provider,
      count: Number(row.count || 0),
      volume_minor: Number(row.volume || 0),
      successful: Number(row.successful || 0),
      failed: Number(row.failed || 0),
      success_rate: Number(row.count || 0) ? Number(row.successful || 0) / Number(row.count) : null,
      fees_minor: Number(row.fees || 0)
      ,
      average_latency_ms: row.average_latency_ms == null ? null : Number(row.average_latency_ms)
    })),
    funding_volume_minor: Number(funding?.volume || 0),
    funding_count: Number(funding?.count || 0),
    funding_collected_count: Number(funding?.collected || 0),
    funding_pending_count: Number(funding?.pending || 0),
    open_payment_issues: Number(issues?.count || 0)
    ,
    payout_volume_minor: Number(payouts?.volume || 0),
    payout_count: Number(payouts?.count || 0),
    payout_success_count: Number(payouts?.successful || 0),
    payout_failure_count: Number(payouts?.failed || 0),
    payout_success_rate: Number(payouts?.count || 0) ? Number(payouts.successful || 0) / Number(payouts.count) : null,
    payout_average_value_minor: Number(payouts?.count || 0) ? Number(payouts.volume || 0) / Number(payouts.count) : 0,
    invoice_count: Number(invoices?.count || 0),
    invoice_revenue_minor: Number(invoices?.revenue || 0),
    invoice_collected_minor: Number(invoices?.collected || 0),
    invoice_outstanding_minor: Number(invoices?.outstanding || 0),
    invoice_overdue_minor: Number(invoices?.overdue || 0)
    ,
    invoice_average_value_minor: Number(invoices?.count || 0) ? Number(invoices.revenue || 0) / Number(invoices.count) : 0
  };
}

module.exports = {
  financeOpsService: {
    getOverview,
    getUserFinanceProfile,
    listPaymentTransactions,
    listReconciliationAlerts,
    listTransactions
    ,getAnalytics
  }
};