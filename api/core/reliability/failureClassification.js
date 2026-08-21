'use strict';

const FAILURE_CLASSES = Object.freeze({
  AUTHENTICATION: 'authentication_failure',
  AUTHORIZATION: 'authorization_failure',
  DATABASE: 'database_failure',
  DUPLICATE: 'duplicate_request',
  INTERNAL: 'internal_unexpected_failure',
  INVALID_INPUT: 'invalid_input',
  NETWORK: 'network_failure',
  PROVIDER: 'provider_failure',
  QUEUE: 'queue_failure',
  RATE_LIMIT: 'rate_limit',
  STORAGE: 'storage_failure',
  TIMEOUT: 'timeout',
  UNAVAILABLE: 'unavailable_dependency'
});

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  'REQUEST_TIMEOUT',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'QUEUE_UNAVAILABLE',
  'SERVICE_UNAVAILABLE'
]);

function readStatus(error) {
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  return Number.isInteger(status) && status > 0 ? status : null;
}

function readCode(error) {
  return String(error?.code || error?.errorCode || '').trim().toUpperCase() || null;
}

function classifyFailure(error = {}) {
  const status = readStatus(error);
  const code = readCode(error);
  const message = String(error?.message || '').toLowerCase();

  if (typeof error.retryable === 'boolean') {
    return buildClassification({
      className: error.retryable ? FAILURE_CLASSES.UNAVAILABLE : FAILURE_CLASSES.INVALID_INPUT,
      retryable: error.retryable,
      status,
      code
    });
  }

  if (status === 401) return buildClassification({ className: FAILURE_CLASSES.AUTHENTICATION, retryable: false, status, code });
  if (status === 403) return buildClassification({ className: FAILURE_CLASSES.AUTHORIZATION, retryable: false, status, code });
  if (status === 409) return buildClassification({ className: FAILURE_CLASSES.DUPLICATE, retryable: false, status, code });
  if (status === 429) return buildClassification({ className: FAILURE_CLASSES.RATE_LIMIT, retryable: true, status, code });
  if (status === 408 || code === 'REQUEST_TIMEOUT' || code === 'ETIMEDOUT' || code === 'ECONNABORTED' || message.includes('timeout')) {
    return buildClassification({ className: FAILURE_CLASSES.TIMEOUT, retryable: true, status, code });
  }
  if (code?.startsWith('SQLITE_')) {
    return buildClassification({
      className: FAILURE_CLASSES.DATABASE,
      retryable: RETRYABLE_ERROR_CODES.has(code),
      status,
      code
    });
  }
  if (code?.includes('PROVIDER') || code?.includes('PAYPAL') || code?.includes('STRIPE') || code?.includes('WEBHOOK')) {
    return buildClassification({
      className: FAILURE_CLASSES.PROVIDER,
      retryable: status ? RETRYABLE_STATUS_CODES.has(status) : RETRYABLE_ERROR_CODES.has(code),
      status,
      code
    });
  }
  if (code?.includes('QUEUE') || code?.includes('JOB')) {
    return buildClassification({ className: FAILURE_CLASSES.QUEUE, retryable: true, status, code });
  }
  if (code?.includes('STORAGE') || code?.includes('ASSET')) {
    return buildClassification({ className: FAILURE_CLASSES.STORAGE, retryable: RETRYABLE_ERROR_CODES.has(code), status, code });
  }
  if (['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return buildClassification({ className: FAILURE_CLASSES.NETWORK, retryable: true, status, code });
  }
  if (status && status >= 400 && status < 500 && !RETRYABLE_STATUS_CODES.has(status)) {
    return buildClassification({ className: FAILURE_CLASSES.INVALID_INPUT, retryable: false, status, code });
  }
  if (status && RETRYABLE_STATUS_CODES.has(status)) {
    return buildClassification({ className: FAILURE_CLASSES.UNAVAILABLE, retryable: true, status, code });
  }

  return buildClassification({ className: FAILURE_CLASSES.INTERNAL, retryable: false, status, code });
}

function buildClassification({ className, retryable, status, code }) {
  return {
    class: className,
    retryable: Boolean(retryable),
    recoverable: Boolean(retryable),
    status: status || null,
    code: code || null
  };
}

function buildRecoveryHint(classification, { retryAfter = null } = {}) {
  if (!classification?.retryable) {
    return {
      retryable: false,
      retryAfter: null,
      action: 'contact_support_if_unexpected'
    };
  }

  return {
    retryable: true,
    retryAfter: retryAfter || (classification.class === FAILURE_CLASSES.RATE_LIMIT ? 60 : null),
    action: classification.class === FAILURE_CLASSES.RATE_LIMIT ? 'wait_then_retry' : 'retry_with_backoff'
  };
}

module.exports = {
  FAILURE_CLASSES,
  RETRYABLE_ERROR_CODES,
  RETRYABLE_STATUS_CODES,
  buildRecoveryHint,
  classifyFailure
};