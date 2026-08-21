const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'logger-security-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'logger-security-webhook';

const { REDACT_PATHS } = require('../utils/logger');

test('API logger redacts auth, webhook, provider, and Telegram init data fields', () => {
  for (const path of [
    'req.headers.authorization',
    'req.headers.x-api-signature',
    'req.headers.x-telegram-init-data',
    'authorization',
    'initData',
    'client_secret',
    'webhookSecret',
    '*.signature'
  ]) {
    assert.ok(REDACT_PATHS.includes(path), `expected ${path} to be redacted`);
  }
});