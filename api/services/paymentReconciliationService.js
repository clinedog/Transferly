const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { providerInvoiceService } = require('./providerInvoiceService');
const { paypalPayoutService } = require('./paypalPayoutService');
const { providerPayoutService } = require('./providerPayoutService');
const { RECOVERY_OUTCOME, providerOperationRecoveryService } = require('./providerOperationRecoveryService');
const { AUDIT_ACTOR_TYPE, INVOICE_STATUS, PAYOUT_STATUS } = require('../utils/constants');

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

  return {
    reconciled_at: new Date().toISOString(),
    invoices,
    payouts,
    provider_operations: providerOperations,
    summary: {
      invoice_count: invoices.length,
      payout_count: payouts.length,
      provider_operation_count: providerOperations.length
    }
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
