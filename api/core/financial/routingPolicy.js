'use strict';

const { AppError } = require('../../utils/errors');
const {
  RESULT_STATE,
  PROVIDER_ERROR_CATEGORY,
  categorizeProviderError
} = require('./providerContract');

const RETRY_CLASSIFICATION = Object.freeze({
  RETRYABLE: 'retryable',
  NON_RETRYABLE: 'non-retryable',
  UNKNOWN: 'unknown',
  RECONCILIATION_REQUIRED: 'requires-reconciliation',
  USER_ACTION_REQUIRED: 'requires-user-action'
});

const RETRYABLE_CATEGORIES = new Set([
  PROVIDER_ERROR_CATEGORY.TIMEOUT,
  PROVIDER_ERROR_CATEGORY.RATE_LIMIT,
  PROVIDER_ERROR_CATEGORY.PROVIDER_DOWN,
  PROVIDER_ERROR_CATEGORY.CONNECTIVITY
]);

const USER_ACTION_CATEGORIES = new Set([
  PROVIDER_ERROR_CATEGORY.AUTHENTICATION,
  PROVIDER_ERROR_CATEGORY.INSUFFICIENT_FUNDS,
  PROVIDER_ERROR_CATEGORY.DECLINED
]);

function classifyProviderFailure(error) {
  const normalized = categorizeProviderError(error);
  const explicitOutcome = String(error?.outcome || error?.status || '').toLowerCase();
  const uncertainOutcome = explicitOutcome === RESULT_STATE.UNKNOWN ||
    error?.reconciliationRequired === true ||
    error?.reconciliation_required === true;
  if (uncertainOutcome || normalized.timeout) {
    return {
      classification: RETRY_CLASSIFICATION.RECONCILIATION_REQUIRED,
      retryable: false,
      failoverAllowed: false,
      reason: 'Provider outcome is uncertain; reconcile before retrying or failing over.',
      error: normalized
    };
  }
  if (USER_ACTION_CATEGORIES.has(normalized.category)) {
    return {
      classification: RETRY_CLASSIFICATION.USER_ACTION_REQUIRED,
      retryable: false,
      failoverAllowed: false,
      reason: 'The operation requires user or administrator action before retrying.',
      error: normalized
    };
  }
  if (RETRYABLE_CATEGORIES.has(normalized.category)) {
    return {
      classification: RETRY_CLASSIFICATION.RETRYABLE,
      retryable: true,
      failoverAllowed: true,
      reason: 'The provider failure is transient and safe to retry according to policy.',
      error: normalized
    };
  }
  return {
    classification: RETRY_CLASSIFICATION.NON_RETRYABLE,
    retryable: false,
    failoverAllowed: false,
    reason: 'The provider rejected the operation or the failure is not known to be transient.',
    error: normalized
  };
}

function assertFailoverAllowed({ executionState, providerResult, failure } = {}) {
  const state = String(executionState || '').toLowerCase();
  const resultState = String(providerResult?.outcome || providerResult?.status || '').toLowerCase();
  if (state === 'unknown' || resultState === RESULT_STATE.UNKNOWN ||
      providerResult?.reconciliation_required === true) {
    throw new AppError(409, 'PROVIDER_FAILOVER_REQUIRES_RECONCILIATION',
      'Provider failover is blocked until the uncertain operation is reconciled.');
  }

  const classification = failure ? classifyProviderFailure(failure) : null;
  if (classification && !classification.failoverAllowed) {
    throw new AppError(409, 'PROVIDER_FAILOVER_NOT_ALLOWED',
      classification.reason, { classification: classification.classification });
  }

  return {
    allowed: true,
    reason: classification?.reason || 'Failover is allowed by the retry policy.'
  };
}

module.exports = {
  RETRY_CLASSIFICATION,
  classifyProviderFailure,
  assertFailoverAllowed
};
