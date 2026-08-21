const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'error-handler-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'error-handler-webhook';

const { buildErrorResponse } = require('../middleware/errorHandler');
const { AppError } = require('../utils/errors');

test('buildErrorResponse includes safe reliability metadata for clients', () => {
  const response = buildErrorResponse(
    new AppError(503, 'PROVIDER_UNAVAILABLE', 'Provider is temporarily unavailable.'),
    { id: 'request-recovery-1' }
  );

  assert.deepEqual(response, {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Provider is temporarily unavailable.',
    details: undefined,
    classification: 'provider_failure',
    retryable: true,
    recovery: {
      retryable: true,
      retryAfter: null,
      action: 'retry_with_backoff'
    },
    requestId: 'request-recovery-1'
  });
});