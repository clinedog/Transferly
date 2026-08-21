const assert = require('node:assert/strict');
const { test } = require('node:test');

test('PayPal sandbox smoke reports missing prerequisites without a config stack trace', () => {
  const { assertRequiredEnvironment } = require('../scripts/paypalSandboxSmoke');
  const originalEnv = {};
  const requiredNames = [
    'REDIS_URL',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'PAYPAL_SANDBOX_INVOICE_RECIPIENT_EMAIL',
    'PAYPAL_SANDBOX_PAYOUT_RECEIVER'
  ];

  for (const name of requiredNames) {
    originalEnv[name] = process.env[name];
    delete process.env[name];
  }

  try {
    assert.throws(
      () => assertRequiredEnvironment(requiredNames),
      (error) => {
        assert.match(error.message, /Missing required environment variables for PayPal sandbox smoke verification/);
        assert.match(error.message, /PAYPAL_CLIENT_ID/);
        assert.match(error.message, /PAYPAL_SANDBOX_PAYOUT_RECEIVER/);
        assert.doesNotMatch(error.message, /ZodError/);
        assert.doesNotMatch(error.message, /\n\s+at /);
        return true;
      }
    );
  } finally {
    for (const name of requiredNames) {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    }
  }
});
