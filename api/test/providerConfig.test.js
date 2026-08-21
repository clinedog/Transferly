const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'paypal-client-id';
process.env.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'paypal-webhook-id';

const { getProviderConfig, listProviderConfigs } = require('../providers/shared/providerConfig');

test('central provider configuration exposes dark-launch provider readiness without secrets', () => {
  const binance = getProviderConfig('binance');
  const cashapp = getProviderConfig('cashapp');

  assert.equal(binance.key, 'binance');
  assert.equal(binance.configured, false);
  assert.deepEqual(binance.missingKeys, ['apiKey', 'apiSecret']);
  assert.equal(cashapp.key, 'cashapp');
  assert.equal(cashapp.configured, false);
  assert.deepEqual(cashapp.missingKeys, ['apiKey']);

  const summaries = listProviderConfigs();
  assert.deepEqual(
    summaries.filter((entry) => ['binance', 'cashapp'].includes(entry.key)),
    [
      { key: 'binance', configured: false, missingKeys: ['apiKey', 'apiSecret'] },
      { key: 'cashapp', configured: false, missingKeys: ['apiKey'] }
    ]
  );
});
