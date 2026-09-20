const assert = require('node:assert/strict');
const test = require('node:test');

const { classifyFailure, FAILURE_CLASSES } = require('../core/reliability/failureClassification');
const {
  RECOVERY_OUTCOME,
  classifyObservation
} = require('../services/providerOperationRecoveryService');
const { PAYOUT_STATUS } = require('../utils/constants');

function payout(overrides = {}) {
  return {
    id: 'failure-injection-payout',
    userId: 'failure-injection-user',
    amountCents: 1500,
    currencyCode: 'USD',
    status: PAYOUT_STATUS.PROCESSING,
    metadata: {
      provider: 'stripe',
      pricing: { total_debit_cents: 1500 },
      ...overrides.metadata
    },
    ...overrides
  };
}

function observation(overrides = {}) {
  return {
    id: 'failure-injection-observation',
    provider: 'stripe',
    operationType: 'payout.status_observed',
    aggregateType: 'payout',
    providerStatus: 'SUCCESS',
    providerResourceId: 'tr_failure_injection',
    payload: {
      amountCents: 1500,
      currencyCode: 'USD'
    },
    ...overrides
  };
}

function validEvidence(overrides = {}) {
  return {
    reserve: {
      wallet_id: 'wallet-1',
      user_id: 'failure-injection-user',
      type: 'PAYOUT_RESERVE',
      debit_bucket: 'available',
      credit_bucket: 'frozen',
      amount_cents: 1500,
      currency_code: 'USD',
      reference_type: 'PAYOUT',
      reference_id: 'failure-injection-payout'
    },
    settlement: null,
    refund: null,
    audits: [],
    walletReconciliation: { walletId: 'wallet-1', reconciled: true },
    ...overrides
  };
}

test('failure injection classifies provider timeout and 5xx as retryable', () => {
  assert.equal(classifyFailure({ code: 'PROVIDER_TIMEOUT' }).class, FAILURE_CLASSES.TIMEOUT);
  assert.equal(classifyFailure({ statusCode: 503, code: 'PROVIDER_UNAVAILABLE' }).retryable, true);
});

test('failure injection preserves UNKNOWN provider outcomes for finance review', () => {
  const result = classifyObservation(
    observation({ providerStatus: 'UNKNOWN_STATUS' }),
    payout(),
    validEvidence()
  );
  assert.deepEqual(result, {
    outcome: RECOVERY_OUTCOME.FINANCE_REVIEW,
    reason: 'provider_status_unknown'
  });
});

test('failure injection refuses duplicate or conflicting terminal effects', () => {
  const result = classifyObservation(
    observation(),
    payout({ status: PAYOUT_STATUS.FAILED }),
    validEvidence()
  );
  assert.deepEqual(result, {
    outcome: RECOVERY_OUTCOME.CONFLICT,
    reason: 'terminal_status_mismatch'
  });
});

test('failure injection requires refresh for nonterminal provider outcomes', () => {
  const result = classifyObservation(
    observation({ providerStatus: 'PENDING' }),
    payout(),
    validEvidence()
  );
  assert.deepEqual(result, {
    outcome: RECOVERY_OUTCOME.REFRESH_REQUIRED,
    reason: 'provider_status_nonterminal'
  });
});
