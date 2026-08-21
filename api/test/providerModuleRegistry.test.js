const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'paypal-client-id';
process.env.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'paypal-webhook-id';

const {
  ProviderModuleRegistry,
  discoverProviderModules
} = require('../providers/moduleRegistry');

test('discovers provider modules with a shared adapter contract', () => {
  const providers = discoverProviderModules();
  assert.deepEqual(providers.map((provider) => provider.key), [
    'paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto', 'binance', 'cashapp'
  ]);
  assert.ok(providers.every((provider) => provider.adapter.getAdapterContract));
  assert.ok(providers.every((provider) => provider.getReadiness));
});

test('discovery-only providers remain dark until explicitly feature-flagged', () => {
  const providers = discoverProviderModules();
  const registry = new ProviderModuleRegistry({ modules: providers });

  assert.deepEqual(registry.list().map((provider) => provider.key), [
    'paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto'
  ]);
  assert.deepEqual(
    registry.list({ includeDisabled: true }).map((provider) => provider.key),
    ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto', 'binance', 'cashapp']
  );

  const flaggedRegistry = new ProviderModuleRegistry({
    modules: providers,
    enabledKeys: new Set(['binance', 'cashapp'])
  });
  assert.deepEqual(flaggedRegistry.list().map((provider) => provider.key), ['binance', 'cashapp']);
});

test('provider feature gates hide disabled modules without changing installed modules', () => {
  const providers = discoverProviderModules();
  const registry = new ProviderModuleRegistry({ modules: providers, enabledKeys: new Set(['paypal']) });
  assert.deepEqual(registry.list().map((provider) => provider.key), ['paypal']);
  assert.equal(registry.get('paypal').key, 'paypal');
  assert.throws(() => registry.get('stripe'), (error) => error.code === 'PAYMENT_PROVIDER_NOT_FOUND');
});
