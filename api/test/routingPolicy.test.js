'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RETRY_CLASSIFICATION,
  classifyProviderFailure,
  assertFailoverAllowed
} = require('../core/financial/routingPolicy');

test('classifies transient provider failures as retryable and failover-safe', () => {
  const result = classifyProviderFailure({ code: 'PROVIDER_DOWN', message: '503 service unavailable' });
  assert.equal(result.classification, RETRY_CLASSIFICATION.RETRYABLE);
  assert.equal(result.retryable, true);
  assert.equal(result.failoverAllowed, true);
});

test('requires reconciliation for timeout or unknown provider outcomes', () => {
  const result = classifyProviderFailure({ code: 'PROVIDER_TIMEOUT', message: 'request timed out' });
  assert.equal(result.classification, RETRY_CLASSIFICATION.RECONCILIATION_REQUIRED);
  assert.equal(result.failoverAllowed, false);
  assert.throws(
    () => assertFailoverAllowed({ providerResult: { outcome: 'unknown' } }),
    (error) => error.code === 'PROVIDER_FAILOVER_REQUIRES_RECONCILIATION'
  );
});

test('blocks failover for user-action and non-retryable failures', () => {
  const failure = classifyProviderFailure({ code: 'CARD_DECLINED', message: 'card declined' });
  assert.equal(failure.classification, RETRY_CLASSIFICATION.USER_ACTION_REQUIRED);
  assert.throws(
    () => assertFailoverAllowed({ failure: { code: 'CARD_DECLINED', message: 'card declined' } }),
    (error) => error.code === 'PROVIDER_FAILOVER_NOT_ALLOWED'
  );
});

test('allows failover only for explicitly transient failures', () => {
  const result = assertFailoverAllowed({
    failure: { code: 'RATE_LIMIT', message: '429 too many requests' }
  });
  assert.equal(result.allowed, true);
});
