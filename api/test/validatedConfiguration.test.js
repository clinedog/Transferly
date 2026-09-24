'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildValidatedConfiguration } = require('../core/config/validatedConfiguration');

test('builds a grouped immutable configuration without exposing provider secrets', () => {
  const configuration = buildValidatedConfiguration({
    NODE_ENV: 'test',
    APP_BASE_URL: 'http://localhost:3001',
    FRONTEND_URL: 'http://localhost:3000',
    SQLITE_DATABASE_PATH: './data/test.sqlite',
    INLINE_QUEUE_MODE: true,
    PAYPAL_CLIENT_ID: 'paypal-id',
    PAYPAL_CLIENT_SECRET: 'paypal-secret',
    PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: 300,
    MAX_SINGLE_PAYOUT: 1000,
    DAILY_PAYOUT_LIMIT: 5000,
    PAYOUT_AUTO_APPROVAL_MAX_CENTS: 0,
    PAYMENT_RECONCILIATION_INTERVAL_MS: 900000,
    POINTS_TO_NAIRA_RATE: 1,
    DEFAULT_SERVICE_POINT_CHARGE: 250,
    POINT_RESERVATION_TTL_MS: 86400000,
    POINT_RESERVATION_EXPIRY_INTERVAL_MS: 300000,
    SERVICE_FEATURE_FLAGS: 'wallet,points',
    PAYMENT_PROVIDER_FEATURE_FLAGS: 'paypal',
    PAYMENT_VERIFICATION_ENABLED: false,
    RISK_ENGINE_ENABLED: true
  }, {
    SQLITE_DATABASE_PATH: '/tmp/test.sqlite',
    ADMIN_AUTH_ENABLED: true,
    JOB_WAIT_MS: 30000,
    WEBHOOK_QUEUE_WAIT_MS: 30000
  });

  assert.equal(Object.isFrozen(configuration), true);
  assert.equal(Object.isFrozen(configuration.financial), true);
  assert.equal(configuration.providers.paypal.configured, true);
  assert.deepEqual(configuration.features.service, ['wallet', 'points']);
  assert.equal(JSON.stringify(configuration).includes('paypal-secret'), false);
  assert.throws(() => {
    configuration.financial.maxSinglePayout = 1;
  }, TypeError);
});
