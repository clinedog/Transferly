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

module.exports = {
  financeOpsService: {
    getOverview,
    getUserFinanceProfile,
    listPaymentTransactions,
    listReconciliationAlerts,
    listTransactions
  }
};