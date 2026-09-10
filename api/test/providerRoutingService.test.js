'use strict';

const assert = require('node:assert/strict');
const { before, test } = require('node:test');

process.env.SQLITE_DATABASE_PATH = process.env.SQLITE_DATABASE_PATH || './data/provider-routing-test.sqlite';
process.env.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'paypal-client-id';
process.env.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'paypal-webhook-id';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const { providerRoutingService } = require('../services/providerRoutingService');
const { migrate } = require('../db/migrate');

before(async () => {
  await migrate();
});

test('provider routing returns implemented payment providers with deterministic ranks', async () => {
  const result = await providerRoutingService.routeProviders({ transactionType: 'payment' });

  assert.equal(result.decision.operation, 'invoices');
  assert.ok(result.candidates.length >= 2);
  assert.deepEqual(result.candidates.map((candidate) => candidate.rank), result.candidates.map((_, index) => index + 1));
  const providers = result.candidates.map((candidate) => candidate.provider);
  assert.ok(providers.includes('paypal'));
  assert.ok(providers.includes('stripe'));
  assert.ok(providers.includes('crypto'));
  assert.ok(['paypal', 'stripe', 'crypto'].includes(result.selected_provider.provider));
  assert.equal(typeof result.decision.explanation, 'string');
});

test('provider routing honors preferred and excluded payout providers', async () => {
  const preferred = await providerRoutingService.routeProviders({
    transactionType: 'payout',
    preferredProvider: 'stripe',
    onlyImplemented: false
  });

  assert.equal(preferred.decision.operation, 'payouts');
  assert.equal(preferred.selected_provider.provider, 'stripe');
  assert.ok(preferred.selected_provider.preferred);

  const excluded = await providerRoutingService.routeProviders({
    transactionType: 'payout',
    excludedProviders: 'paypal,stripe',
    onlyImplemented: false
  });

  assert.ok(!excluded.candidates.some((candidate) => ['paypal', 'stripe'].includes(candidate.provider)));
  assert.equal(excluded.selected_provider.provider, excluded.candidates[0].provider);
});

test('provider routing reports an actionable no-route failure', async () => {
  await assert.rejects(
    providerRoutingService.routeProviders({
      transactionType: 'payout',
      excludedProviders: 'paypal,stripe,wise,paystack,flutterwave,crypto'
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'NO_PROVIDER_ROUTE');
      assert.equal(error.details.operation, 'payouts');
      return true;
    }
  );
});
