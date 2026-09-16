'use strict';

const { createHash } = require('node:crypto');

const { db } = require('../db');
const { auditLogRepository } = require('../repositories/auditLogRepository');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { walletRepository } = require('../repositories/walletRepository');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');
const { ledgerService } = require('./ledgerService');
const { riskEngineService } = require('./riskEngineService');
const {
  INVOICE_STATUS,
  PAYOUT_STATUS,
  POINT_RESERVATION_STATUS,
  POINT_TRANSACTION_TYPE,
  POINTS_FUNDING_STATUS,
  RISK_DOMAIN,
  WEBHOOK_PROCESSING_STATUS,
  LEDGER_ENTRY_TYPE
} = require('../utils/constants');
const { paymentOpsIssueRepository } = require('../repositories/paymentOpsIssueRepository');

// How long (ms) a payout can stay in a non-terminal state before flagged stale
const STALE_PAYOUT_MS = 24 * 60 * 60 * 1000; // 24 h
const STALE_INVOICE_MS = 72 * 60 * 60 * 1000; // 72 h

const TERMINAL_INVOICE = new Set([INVOICE_STATUS.PAID, INVOICE_STATUS.CANCELLED, INVOICE_STATUS.REFUNDED, INVOICE_STATUS.FAILED]);
const TERMINAL_PAYOUT = new Set([PAYOUT_STATUS.SUCCESS, PAYOUT_STATUS.FAILED, PAYOUT_STATUS.DENIED, PAYOUT_STATUS.REJECTED, PAYOUT_STATUS.QUEUED]);

function isTerminalPayoutStatus(status) {
  return TERMINAL_PAYOUT.has(status);
}

async function findDispositionMismatchInternal(payoutId) {
  const payout = await payoutRepository.findById(payoutId);
  if (!payout) return undefined;

  const [settlements, refunds] = await Promise.all([
    db.all(
      `SELECT id, type, amount_cents, currency_code, debit_bucket, credit_bucket, created_at
       FROM ledger_entries
       WHERE reference_type = 'PAYOUT' AND reference_id = ? AND type = ?`,
      [payoutId, LEDGER_ENTRY_TYPE.PAYOUT_SETTLED]
    ),
    db.all(
      `SELECT id, type, amount_cents, currency_code, debit_bucket, credit_bucket, created_at
       FROM ledger_entries
       WHERE reference_type = 'PAYOUT' AND reference_id = ? AND type = ?`,
      [payoutId, LEDGER_ENTRY_TYPE.PAYOUT_RELEASE_REFUND]
    )
  ]);

  const settlementCount = settlements.length;
  const refundCount = refunds.length;

  // Contradictory: both settlement and refund dispositions exist
  if (settlementCount > 0 && refundCount > 0) {
    return {
      type: 'payout_reservation_disposition_mismatch',
      entityType: 'payout',
      entityId: payoutId,
      severity: 'critical',
      settlementCount,
      refundCount,
      detail: `Payout ${payoutId} has both settlement and refund dispositions (contradictory)`
    };
  }

  // Non-terminal payouts should not have any disposition yet
  if (!isTerminalPayoutStatus(payout.status)) {
    if (settlementCount > 0) {
      return {
        type: 'payout_reservation_disposition_mismatch',
        entityType: 'payout',
        entityId: payoutId,
        severity: 'high',
        settlementCount,
        refundCount,
        detail: `Payout ${payoutId} is in status ${payout.status} but has ${settlementCount} settlement(s) and ${refundCount} refund(s)`
      };
    }
    if (refundCount > 0) {
      return {
        type: 'payout_reservation_disposition_mismatch',
        entityType: 'payout',
        entityId: payoutId,
        severity: 'high',
        settlementCount,
        refundCount,
        detail: `Payout ${payoutId} is in status ${payout.status} but has ${refundCount} refund(s)`
      };
    }
    return undefined;
  }

  // Terminal payouts need exactly one valid disposition (settlement OR refund)
  const totalDispositions = settlementCount + refundCount;

  if (totalDispositions === 0) {
    return {
      type: 'payout_reservation_disposition_mismatch',
      entityType: 'payout',
      entityId: payoutId,
      severity: 'critical',
      settlementCount: 0,
      refundCount: 0,
      detail: `Payout ${payoutId} is ${payout.status} but has no disposition`
    };
  }

  if (totalDispositions > 1) {
    return {
      type: 'payout_reservation_disposition_mismatch',
      entityType: 'payout',
      entityId: payoutId,
      severity: 'critical',
      settlementCount,
      refundCount,
      detail: `Payout ${payoutId} has ${totalDispositions} dispositions (expected 1)`
    };
  }

  // Exactly one disposition — validate it matches the payout
  const disposition = settlementCount > 0 ? settlements[0] : refunds[0];

  if (Number(disposition.amount_cents) !== Number(payout.amountCents)) {
    return {
      type: 'payout_reservation_disposition_mismatch',
      entityType: 'payout',
      entityId: payoutId,
      severity: 'critical',
      settlementCount,
      refundCount,
      expectedAmountCents: Number(payout.amountCents),
      actualAmountCents: Number(disposition.amount_cents),
      detail: `Payout ${payoutId} disposition amount (${disposition.amount_cents}) does not match payout amount (${payout.amountCents})`
    };
  }

  if (disposition.currency_code && String(disposition.currency_code) !== String(payout.currencyCode)) {
    return {
      type: 'payout_reservation_disposition_mismatch',
      entityType: 'payout',
      entityId: payoutId,
      severity: 'critical',
      settlementCount,
      refundCount,
      expectedCurrencyCode: payout.currencyCode,
      actualCurrencyCode: disposition.currency_code,
      detail: `Payout ${payoutId} disposition currency (${disposition.currency_code}) does not match payout currency (${payout.currencyCode})`
    };
  }

  return undefined;
}

async function ensurePayoutDispositionIssue(payoutId, client = db) {
  const mismatch = await findDispositionMismatchInternal(payoutId);

  if (!mismatch) {
    // No mismatch — resolve any existing OPEN issue for this payout
    const existing = await paymentOpsIssueRepository.findByUniqueKey(
      'payout',
      payoutId,
      'PAYOUT_RESERVATION_DISPOSITION_MISMATCH',
      client
    );
    if (existing && existing.status === 'OPEN') {
      return paymentOpsIssueRepository.updateById(existing.id, {
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        metadata: {
          ...existing.metadata,
          resolved_at: new Date().toISOString(),
          resolved_by_actor_id: existing.metadata?.resolved_by_actor_id || null,
          resolution_note: 'Disposition reconciled — no mismatch detected.'
        }
      }, client);
    }
    return undefined;
  }

  // Mismatch exists — create or refresh the OPEN issue
  
  const payout = await payoutRepository.findById(payoutId, client)
  
  const issue = await paymentOpsIssueRepository.upsert(
    {
      entityType: 'payout',
      entityId: payoutId,
      issueType: 'PAYOUT_RESERVATION_DISPOSITION_MISMATCH',
      severity: mismatch.severity.toUpperCase(),
      status: 'OPEN',
      summary: mismatch.detail,
      metadata: {
        payout_id: payoutId,
        payout_status: payout?.status || 'unknown',
        settlement_count: mismatch.settlementCount ?? 0,
        refund_count: mismatch.refundCount ?? 0,
        mismatch_type: mismatch.type,
        detail: mismatch.detail
      }
    },
    client
  );

  return issue;
}

function ageMs(isoString) {
  return Date.now() - Date.parse(isoString || 0);
}

function buildAlertId(mismatch) {
  const source = [mismatch.type, mismatch.entityType, mismatch.entityId, mismatch.referenceType, mismatch.referenceId]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .join(':');
  return `points-recon:${createHash('sha256').update(source).digest('hex').slice(0, 32)}`;
}

async function persistReconciliationAlerts(mismatches) {
  const now = new Date().toISOString();
  const alerts = [];

  for (const mismatch of mismatches) {
    if (!String(mismatch.type || '').startsWith('points_') && mismatch.type !== 'point_reservation_ledger_mismatch') {
      continue;
    }

    const alertId = buildAlertId(mismatch);
    await db.run(
      `
        INSERT INTO points_reconciliation_alerts (
          id, alert_type, severity, status, user_id, funding_request_id,
          expected_points, actual_points, details_json, created_at, resolved_at
        ) VALUES (?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          severity = excluded.severity,
          status = 'OPEN',
          user_id = excluded.user_id,
          funding_request_id = excluded.funding_request_id,
          expected_points = excluded.expected_points,
          actual_points = excluded.actual_points,
          details_json = excluded.details_json,
          resolved_at = NULL
      `,
      [
        alertId,
        mismatch.type,
        String(mismatch.severity || 'medium').toUpperCase(),
        mismatch.userId || (mismatch.entityType === 'user' ? mismatch.entityId : null),
        mismatch.entityType === 'points_funding_request' ? mismatch.entityId : null,
        mismatch.expectedPoints ?? mismatch.expectedBalance ?? null,
        mismatch.actualPoints ?? mismatch.actualBalance ?? null,
        JSON.stringify(mismatch),
        now
      ]
    );
    alerts.push({ ...mismatch, alert_id: alertId, alert_status: 'OPEN' });
    if (String(mismatch.severity || '').toUpperCase() === 'CRITICAL' || mismatch.type === 'points_funding_credit_without_verified_payment') {
      await riskEngineService.evaluateEvent({
        eventType: 'FINANCIAL_ANOMALY',
        domain: RISK_DOMAIN.PAYMENT,
        userId: mismatch.userId || (mismatch.entityType === 'user' ? mismatch.entityId : null),
        source: 'reconciliation-timeline-service',
        resourceType: mismatch.entityType || 'reconciliation_alert',
        resourceId: mismatch.entityId || alertId,
        correlationId: alertId,
        metadata: {
          criticalFinancialAnomaly: true,
          anomalyType: mismatch.type,
          alertId,
          expectedPoints: mismatch.expectedPoints ?? mismatch.expectedBalance ?? null,
          actualPoints: mismatch.actualPoints ?? mismatch.actualBalance ?? null
        }
      });
    }
  }

  return alerts;
}

// ── Ledger entries for an entity ─────────────────────────────────────────────

async function fetchLedgerEntries(referenceType, referenceId, limit = 50) {
  const rows = await db.all(
    `SELECT id, type, debit_bucket, credit_bucket, amount_cents, currency_code,
            reference_type, reference_id, description, created_at
     FROM ledger_entries
     WHERE reference_type = ? AND reference_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [referenceType, referenceId, limit]
  );
  return rows.map((r) => ({
    kind: 'ledger',
    id: r.id,
    type: r.type,
    debitBucket: r.debit_bucket,
    creditBucket: r.credit_bucket,
    amountCents: r.amount_cents,
    currencyCode: r.currency_code,
    description: r.description,
    timestamp: r.created_at
  }));
}

// ── Unified timeline for a single entity ─────────────────────────────────────

async function getEntityTimeline({ entityType, entityId, limit = 50 }) {
  const [auditLogs, ledgerEntries] = await Promise.all([
    auditLogRepository.findManyForEntity(entityType, entityId, { limit }),
    fetchLedgerEntries(entityType, entityId, limit)
  ]);

  const auditItems = auditLogs.map((e) => ({
    kind: 'audit',
    id: e.id,
    action: e.action,
    actorType: e.actorType,
    actorId: e.actorId,
    metadata: e.metadata,
    timestamp: e.createdAt
  }));

  const items = [...auditItems, ...ledgerEntries].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
  );

  return { entityType, entityId, items };
}

// ── Cross-entity mismatch detection ──────────────────────────────────────────

async function detectPointProjectionMismatches(limit = 200) {
  const rows = await db.all(
    `
      SELECT p.user_id, p.points AS projection_balance, COALESCE(SUM(t.amount), 0) AS ledger_balance
      FROM profiles p
      LEFT JOIN points_transactions t ON t.user_id = p.user_id
      GROUP BY p.user_id, p.points
      HAVING p.points <> COALESCE(SUM(t.amount), 0)
      LIMIT ?
    `,
    [limit]
  );

  return rows.map((row) => ({
    type: 'points_projection_mismatch',
    severity: 'critical',
    entityType: 'user',
    entityId: row.user_id,
    detail: `User ${row.user_id} projected points do not match the points ledger.`,
    expectedBalance: Number(row.ledger_balance || 0),
    actualBalance: Number(row.projection_balance || 0),
    difference: Number(row.projection_balance || 0) - Number(row.ledger_balance || 0),
    since: null
  }));
}

async function detectFundingCreditMismatches(limit = 200) {
  const rows = await db.all(
    `
      SELECT r.id, r.user_id, r.requested_points, r.status, COUNT(t.id) AS credit_count,
             COALESCE(SUM(t.amount), 0) AS credited_points
      FROM points_funding_requests r
      LEFT JOIN points_transactions t
        ON t.reference_type = 'POINTS_FUNDING_REQUEST'
       AND t.reference_id = r.id
       AND t.type = ?
      WHERE r.status = ?
      GROUP BY r.id, r.user_id, r.requested_points, r.status
      HAVING credit_count <> 1 OR credited_points <> r.requested_points
      LIMIT ?
    `,
    [POINT_TRANSACTION_TYPE.PURCHASE_CREDIT, POINTS_FUNDING_STATUS.POINTS_CREDITED, limit]
  );

  return rows.map((row) => ({
    type: Number(row.credit_count || 0) === 0 ? 'points_funding_missing_credit' : 'points_funding_credit_mismatch',
    severity: 'critical',
    entityType: 'points_funding_request',
    entityId: row.id,
    userId: row.user_id,
    detail: `Funding request ${row.id} is POINTS_CREDITED but its purchase credit ledger entries do not match requested points.`,
    expectedPoints: Number(row.requested_points || 0),
    actualPoints: Number(row.credited_points || 0),
    ledgerEntryCount: Number(row.credit_count || 0),
    since: null
  }));
}

async function detectReservationLedgerMismatches(limit = 200) {
  const rows = await db.all(
    `
      SELECT r.id, r.user_id, r.reference_type, r.reference_id, r.amount, r.status,
             SUM(CASE WHEN t.entry_key LIKE '%:hold' THEN 1 ELSE 0 END) AS hold_count,
             SUM(CASE WHEN t.entry_key LIKE '%:hold' THEN t.amount ELSE 0 END) AS hold_points,
             SUM(CASE WHEN t.entry_key LIKE '%:commit' THEN 1 ELSE 0 END) AS commit_count,
             SUM(CASE WHEN t.entry_key LIKE '%:release' OR t.entry_key LIKE '%:expire' THEN 1 ELSE 0 END) AS release_count,
             SUM(CASE WHEN t.entry_key LIKE '%:release' OR t.entry_key LIKE '%:expire' THEN t.amount ELSE 0 END) AS released_points
      FROM point_reservations r
      LEFT JOIN points_transactions t
        ON t.entry_key LIKE 'point-reservation:' || r.id || ':%'
       AND t.reference_type = r.reference_type
       AND t.reference_id = r.reference_id
      GROUP BY r.id, r.user_id, r.reference_type, r.reference_id, r.amount, r.status
      HAVING
        hold_count <> 1
        OR hold_points <> -r.amount
        OR (r.status = ? AND commit_count <> 1)
        OR (r.status IN (?, ?) AND (release_count <> 1 OR released_points <> r.amount))
      LIMIT ?
    `,
    [
      POINT_RESERVATION_STATUS.COMMITTED,
      POINT_RESERVATION_STATUS.RELEASED,
      POINT_RESERVATION_STATUS.EXPIRED,
      limit
    ]
  );

  return rows.map((row) => ({
    type: 'point_reservation_ledger_mismatch',
    severity: 'critical',
    entityType: 'point_reservation',
    entityId: row.id,
    userId: row.user_id,
    detail: `Point reservation ${row.id} ledger entries do not match its lifecycle state.`,
    status: row.status,
    expectedPoints: Number(row.amount || 0),
    holdCount: Number(row.hold_count || 0),
    holdPoints: Number(row.hold_points || 0),
    commitCount: Number(row.commit_count || 0),
    releaseCount: Number(row.release_count || 0),
    releasedPoints: Number(row.released_points || 0),
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    since: null
  }));
}

async function detectMismatches({ invoiceLimit = 50, payoutLimit = 50, webhookLimit = 100, pointsLimit = 200 } = {}) {
  const [invoices, payouts, webhooks] = await Promise.all([
    invoiceRepository.findMany({ limit: invoiceLimit }),
    payoutRepository.findMany({ limit: payoutLimit }),
    webhookEventRepository.findMany({ limit: webhookLimit })
  ]);

  const mismatches = [];

  mismatches.push(...await detectPointProjectionMismatches(pointsLimit));
  mismatches.push(...await detectFundingCreditMismatches(pointsLimit));
  mismatches.push(...await detectReservationLedgerMismatches(pointsLimit));

  // 1. Stale pending invoices — sent but not paid/cancelled for > 72 h
  for (const inv of invoices) {
    if (!TERMINAL_INVOICE.has(inv.status) && ageMs(inv.updatedAt || inv.createdAt) > STALE_INVOICE_MS) {
      mismatches.push({
        type: 'stale_pending_invoice',
        severity: 'medium',
        entityType: 'invoice',
        entityId: inv.id,
        detail: `Invoice ${inv.id} has been in status "${inv.status}" for over 72 h`,
        since: inv.updatedAt || inv.createdAt
      });
    }
  }

  // 2. Stale pending payouts — non-terminal for > 24 h
  for (const payout of payouts) {
    if (!TERMINAL_PAYOUT.has(payout.status) && ageMs(payout.updatedAt || payout.createdAt) > STALE_PAYOUT_MS) {
      mismatches.push({
        type: 'stale_pending_payout',
        severity: 'high',
        entityType: 'payout',
        entityId: payout.id,
        detail: `Payout ${payout.id} has been in status "${payout.status}" for over 24 h`,
        since: payout.updatedAt || payout.createdAt
      });
    }
  }

  // 3. Failed webhook processing — events that failed and were never retried to success
  const failedWebhooks = webhooks.filter((w) => w.status === WEBHOOK_PROCESSING_STATUS.FAILED);
  for (const wh of failedWebhooks) {
    mismatches.push({
      type: 'failed_webhook',
      severity: 'high',
      entityType: 'webhook_event',
      entityId: wh.id,
      detail: `Webhook event ${wh.eventId || wh.id} (${wh.eventType}) failed processing after ${wh.processingAttempts} attempt(s)`,
      since: wh.updatedAt || wh.createdAt
    });
  }

  // 4. Paid invoices with no ledger credit — webhook may have been missed
  const paidInvoiceIds = invoices.filter((i) => i.status === INVOICE_STATUS.PAID).map((i) => i.id);
  if (paidInvoiceIds.length > 0) {
    const placeholders = paidInvoiceIds.map(() => '?').join(',');
    const ledgerRows = await db.all(
      `SELECT DISTINCT reference_id FROM ledger_entries
       WHERE reference_type = 'INVOICE' AND reference_id IN (${placeholders})`,
      paidInvoiceIds
    );
    const coveredIds = new Set(ledgerRows.map((r) => r.reference_id));
    for (const id of paidInvoiceIds) {
      if (!coveredIds.has(id)) {
        mismatches.push({
          type: 'missing_ledger_credit',
          severity: 'critical',
          entityType: 'invoice',
          entityId: id,
          detail: `Invoice ${id} is PAID but has no ledger entry — webhook may have been missed`,
          since: null
        });
      }
    }
  }

  // 5. Wallet bucket drift — wallet balances should match ledger bucket projection.
  const walletUserIds = new Set([
    ...invoices.map((invoice) => invoice.userId),
    ...payouts.map((payout) => payout.userId)
  ].filter(Boolean));
  for (const userId of walletUserIds) {
    const wallet = await walletRepository.findByUserId(userId);
    if (!wallet) {
      continue;
    }
    const reconciliation = await ledgerService.verifyWalletLedgerInvariant(wallet.id);
    if (!reconciliation.reconciled) {
      mismatches.push({
        type: 'wallet_ledger_mismatch',
        severity: 'critical',
        entityType: 'wallet',
        entityId: wallet.id,
        detail: `Wallet ${wallet.id} balances do not match ledger bucket projection`,
        mismatches: reconciliation.mismatches,
        since: wallet.updatedAt || wallet.createdAt
      });
    }
  }

  // 6. Payout disposition mismatches — payouts in terminal status must have
  //    exactly one settlement disposition with correct amount/currency
  for (const payout of payouts) {
    const mismatch = await reconciliationTimelineService
      .findDispositionMismatch(payout.id);
    if (mismatch) {
      mismatches.push({
        ...mismatch,
        since: payout.updatedAt || payout.createdAt
      });
    }
  }

  const alerts = await persistReconciliationAlerts(mismatches);

  return {
    checked_at: new Date().toISOString(),
    mismatch_count: mismatches.length,
    points_alert_count: alerts.length,
    points_alerts: alerts,
    mismatches
  };
}

const reconciliationTimelineService = {
  getEntityTimeline,
  detectMismatches,
  async findDispositionMismatch(payoutId) {
    const mismatch = await findDispositionMismatchInternal(payoutId);
    await ensurePayoutDispositionIssue(payoutId);
    return mismatch;
  },
  ensurePayoutDispositionIssue
};

module.exports = {
  reconciliationTimelineService
};
