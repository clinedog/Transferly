const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { providerInvoiceService } = require('./providerInvoiceService');
const { paypalPayoutService } = require('./paypalPayoutService');
const { providerPayoutService } = require('./providerPayoutService');
const { RECOVERY_OUTCOME, providerOperationRecoveryService } = require('./providerOperationRecoveryService');
const { reconciliationTimelineService } = require('./reconciliationTimelineService');
const { AUDIT_ACTOR_TYPE, INVOICE_STATUS, PAYOUT_STATUS } = require('../utils/constants');
const { auditLogService } = require('./auditLogService');

const RECONCILABLE_INVOICE_STATUSES = new Set([
  INVOICE_STATUS.SENT,
  INVOICE_STATUS.SCHEDULED,
  INVOICE_STATUS.UPDATED
]);

const RECONCILABLE_PAYOUT_STATUSES = new Set([
  PAYOUT_STATUS.QUEUED,
  PAYOUT_STATUS.PROCESSING,
  PAYOUT_STATUS.PENDING
]);

const UNRESOLVED_RECOVERY_OUTCOMES = new Set([
  RECOVERY_OUTCOME.REFRESH_REQUIRED,
  RECOVERY_OUTCOME.FINANCE_REVIEW,
  RECOVERY_OUTCOME.CONFLICT
]);

async function reconcileInvoices(limit, dependencies = {}) {
  const invoicesRepository = dependencies.invoices || invoiceRepository;
  const providerInvoices = dependencies.providerInvoices || providerInvoiceService;
  const invoices = await invoicesRepository.findMany({ limit });
  const reconciled = [];

  for (const invoice of invoices) {
    if (!RECONCILABLE_INVOICE_STATUSES.has(invoice.status)) {
      continue;
    }

    reconciled.push(
      await providerInvoices.refreshInvoice({
        invoiceId: invoice.id,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: null
      })
    );
  }

  return reconciled;
}

async function reconcilePayouts(limit, excludedPayoutIds = new Set(), dependencies = {}) {
  const payoutsRepository = dependencies.payouts || payoutRepository;
  const stripePayouts = dependencies.stripePayouts || providerPayoutService;
  const paypalPayouts = dependencies.paypalPayouts || paypalPayoutService;
  const payouts = await payoutsRepository.findMany({ limit });
  const reconciled = [];

  for (const payout of payouts) {
    if (!RECONCILABLE_PAYOUT_STATUSES.has(payout.status) || excludedPayoutIds.has(payout.id)) {
      continue;
    }

    reconciled.push(
      String(payout.metadata?.provider || '').toLowerCase() === 'stripe'
        ? await stripePayouts.processQueuedPayout(payout.id)
        : await paypalPayouts.refreshPayout({
            payoutId: payout.id,
            actorType: AUDIT_ACTOR_TYPE.SYSTEM,
            actorId: null
          })
    );
  }

  return reconciled;
}

async function runPaymentReconciliation(options = {}, dependencies = {}) {
  const invoiceLimit = options.invoiceLimit || 25;
  const payoutLimit = options.payoutLimit || 25;
  const timeline = dependencies.timeline || reconciliationTimelineService;
  const audit = dependencies.audit || auditLogService;

  const recoveryService = dependencies.recovery || providerOperationRecoveryService;
  const providerOperations = await recoveryService.recoverPending({ limit: payoutLimit });
  const blockedPayoutIds = new Set(
    providerOperations
      .filter((result) => UNRESOLVED_RECOVERY_OUTCOMES.has(result.outcome))
      .map((result) => result.payoutId)
      .filter(Boolean)
  );
  const [invoices, payouts] = await Promise.all([
    reconcileInvoices(invoiceLimit, dependencies),
    reconcilePayouts(payoutLimit, blockedPayoutIds, dependencies)
  ]);
  const mismatchReport = await timeline.detectMismatches({
    invoiceLimit,
    payoutLimit,
    webhookLimit: options.webhookLimit || 100,
    pointsLimit: options.pointsLimit || 200
  });
  const summary = {
    invoice_count: invoices.length,
    payout_count: payouts.length,
    provider_operation_count: providerOperations.length,
    mismatch_count: mismatchReport.mismatch_count,
    alert_count: mismatchReport.points_alert_count || 0
  };
  const summaryHash = createHash('sha256').update(JSON.stringify(summary)).digest('hex');
  const runId = randomUUID();
  const summarySignature = createHmac('sha256', config.FINANCE_RECONCILIATION_SIGNING_SECRET)
    .update(`${runId}.${summaryHash}`)
    .digest('hex');
  await audit.log({
    actorType: AUDIT_ACTOR_TYPE.SYSTEM,
    actorId: null,
    action: 'payment_reconciliation.completed',
    entityType: 'reconciliation_run',
    entityId: runId,
    metadata: {
      ...summary,
      summary_hash: summaryHash,
      summary_signature: summarySignature,
      checked_at: mismatchReport.checked_at
    }
  });

  return {
    reconciled_at: new Date().toISOString(),
    invoices,
    payouts,
    provider_operations: providerOperations,
    reconciliation: {
      mismatch_count: mismatchReport.mismatch_count,
      alert_count: mismatchReport.points_alert_count || 0,
      checked_at: mismatchReport.checked_at
    },
    summary: { ...summary, run_id: runId, summary_hash: summaryHash, summary_signature: summarySignature }
  };
}

module.exports = {
  paymentReconciliationService: {
    runPaymentReconciliation
  },
  RECONCILABLE_INVOICE_STATUSES,
  RECONCILABLE_PAYOUT_STATUSES,
  UNRESOLVED_RECOVERY_OUTCOMES
};
'use strict';

const { createHash, createHmac, randomUUID } = require('node:crypto');
const config = require('../config');
