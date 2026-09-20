'use strict';

const { AppError } = require('../utils/errors');

const RECONCILIATION_SCHEDULER_ID = 'payment-reconciliation';
const RECONCILIATION_JOB_NAME = 'run-payment-reconciliation';

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(500, 'RECONCILIATION_CONFIG_INVALID', `${fieldName} must be a positive integer.`);
  }
}

async function registerPaymentReconciliationSchedule(queue, {
  intervalMs,
  invoiceLimit,
  payoutLimit
}) {
  if (!queue?.upsertJobScheduler) {
    throw new AppError(500, 'RECONCILIATION_QUEUE_INVALID', 'Reconciliation queue is unavailable.');
  }
  assertPositiveInteger(intervalMs, 'Reconciliation interval');
  assertPositiveInteger(invoiceLimit, 'Reconciliation invoice limit');
  assertPositiveInteger(payoutLimit, 'Reconciliation payout limit');

  return queue.upsertJobScheduler(
    RECONCILIATION_SCHEDULER_ID,
    { every: intervalMs },
    {
      name: RECONCILIATION_JOB_NAME,
      data: { invoiceLimit, payoutLimit }
    }
  );
}

module.exports = {
  RECONCILIATION_JOB_NAME,
  RECONCILIATION_SCHEDULER_ID,
  registerPaymentReconciliationSchedule
};
