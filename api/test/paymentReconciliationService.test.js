const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { test } = require('node:test');

process.env.NODE_ENV = 'test';

const { paymentReconciliationService } = require('../services/paymentReconciliationService');
const { RECOVERY_OUTCOME } = require('../services/providerOperationRecoveryService');
const { PAYOUT_STATUS } = require('../utils/constants');
const config = require('../config');

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
      },
      timeline: {
        async detectMismatches() {
          return {
            checked_at: '2026-09-16T00:00:00.000Z',
            mismatch_count: 2,
            points_alert_count: 1
          };
        }
      },
      audit: {
        async log(entry) {
          assert.equal(entry.action, 'payment_reconciliation.completed');
          assert.equal(entry.entityType, 'reconciliation_run');
          assert.equal(entry.metadata.mismatch_count, 2);
          assert.match(entry.metadata.summary_hash, /^[a-f0-9]{64}$/);
          assert.match(entry.metadata.summary_signature, /^[a-f0-9]{64}$/);
        }
      }
    }
  );

  assert.deepEqual(providerCalls, [['paypal', 'ordinary-paypal']]);
  assert.deepEqual(result.payouts, [{ payout_id: 'ordinary-paypal' }]);
  assert.equal(result.summary.provider_operation_count, 4);
  assert.equal(result.summary.mismatch_count, 2);
  assert.equal(result.summary.alert_count, 1);
  assert.match(result.summary.run_id, /^[0-9a-f-]{36}$/);
  assert.match(result.summary.summary_hash, /^[a-f0-9]{64}$/);
  assert.equal(
    result.summary.summary_signature,
    createHmac('sha256', config.FINANCE_RECONCILIATION_SIGNING_SECRET)
      .update(`${result.summary.run_id}.${result.summary.summary_hash}`)
      .digest('hex')
  );
});