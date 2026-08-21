const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.NODE_ENV = 'test';

const { paymentReconciliationService } = require('../services/paymentReconciliationService');
const { RECOVERY_OUTCOME } = require('../services/providerOperationRecoveryService');
const { PAYOUT_STATUS } = require('../utils/constants');

test('reconciliation never submits or refreshes payouts with unresolved provider observations', async () => {
  const providerCalls = [];
  const payouts = [
    {
      id: 'refresh-required-stripe',
      status: PAYOUT_STATUS.PROCESSING,
      metadata: { provider: 'stripe' }
    },
    {
      id: 'finance-review-paypal',
      status: PAYOUT_STATUS.PENDING,
      metadata: { provider: 'paypal' }
    },
    {
      id: 'conflict-stripe',
      status: PAYOUT_STATUS.QUEUED,
      metadata: { provider: 'stripe' }
    },
    {
      id: 'ordinary-paypal',
      status: PAYOUT_STATUS.PROCESSING,
      metadata: { provider: 'paypal' }
    }
  ];

  const result = await paymentReconciliationService.runPaymentReconciliation(
    { invoiceLimit: 1, payoutLimit: 10 },
    {
      recovery: {
        async recoverPending() {
          return [
            { payoutId: 'refresh-required-stripe', outcome: RECOVERY_OUTCOME.REFRESH_REQUIRED },
            { payoutId: 'finance-review-paypal', outcome: RECOVERY_OUTCOME.FINANCE_REVIEW },
            { payoutId: 'conflict-stripe', outcome: RECOVERY_OUTCOME.CONFLICT },
            { payoutId: 'already-applied', outcome: RECOVERY_OUTCOME.ALREADY_APPLIED }
          ];
        }
      },
      invoices: {
        async findMany() {
          return [];
        }
      },
      payouts: {
        async findMany() {
          return payouts;
        }
      },
      stripePayouts: {
        async processQueuedPayout(payoutId) {
          providerCalls.push(['stripe', payoutId]);
          return { payout_id: payoutId };
        }
      },
      paypalPayouts: {
        async refreshPayout({ payoutId }) {
          providerCalls.push(['paypal', payoutId]);
          return { payout_id: payoutId };
        }
      }
    }
  );

  assert.deepEqual(providerCalls, [['paypal', 'ordinary-paypal']]);
  assert.deepEqual(result.payouts, [{ payout_id: 'ordinary-paypal' }]);
  assert.equal(result.summary.provider_operation_count, 4);
});