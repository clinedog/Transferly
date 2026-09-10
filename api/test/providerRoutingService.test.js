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

test('invoice_payment routes to the invoices operation with deterministic ranks', async () => {
  const result = await providerRoutingService.routeProviders({ transactionType: 'invoice_payment' });

  assert.equal(result.decision.operation, 'invoices');
  assert.equal(result.decision.transactionType, 'invoice_payment');
  assert.ok(result.candidates.length >= 1);
  assert.deepEqual(result.candidates.map((candidate) => candidate.rank), result.candidates.map((_, index) => index + 1));
  assert.equal(result.selected_provider.provider, result.candidates[0].provider);
  assert.equal(typeof result.decision.explanation, 'string');
  assert.equal(typeof result.execution.production_eligible, 'boolean');
});

test('generic payment NEVER silently maps to invoices', async () => {
  // Regression guard: generic payment must be routed as the `payments`
  // operation. Invoices are one payment flow — routing may not substitute
  // invoices for a generic payment, and vice versa.
  await assert.rejects(
    providerRoutingService.routeProviders({ transactionType: 'payment' }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'NO_PROVIDER_ROUTE');
      assert.equal(error.details.operation, 'payments');
      assert.notEqual(error.details.operation, 'invoices');
      return true;
    }
  );
});

test('payout routing honors preferred and excluded providers within the eligible set', async () => {
  const preferred = await providerRoutingService.routeProviders({
    transactionType: 'payout',
    preferredProvider: 'paypal',
    onlyImplemented: false
  });

  assert.equal(preferred.decision.operation, 'payouts');
  assert.equal(preferred.selected_provider.provider, 'paypal');
  assert.ok(preferred.selected_provider.preferred);

  // Excluding the only eligible provider must surface a no-route failure.
  await assert.rejects(
    providerRoutingService.routeProviders({
      transactionType: 'payout',
      excludedProviders: 'paypal',
      onlyImplemented: false
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'NO_PROVIDER_ROUTE');
      assert.equal(error.details.operation, 'payouts');
      return true;
    }
  );
});

test('preferred provider cannot override eligibility', async () => {
  // Stripe is registered but not configured/ready in this environment, so it
  // must NOT be selected even when the caller prefers it.
  const result = await providerRoutingService.routeProviders({
    transactionType: 'payout',
    preferredProvider: 'stripe',
    onlyImplemented: false
  });

  assert.equal(result.selected_provider.provider, 'paypal');
  assert.ok(!result.selected_provider.preferred);
  assert.ok(!result.eligibility.eligible_providers.includes('stripe'));
});

test('country filtering requires an explicit provider declaration', async () => {
  // PayPal's adapter does not declare a supported-country allowlist, so its
  // scope is UNSPECIFIED — it must not be treated as universal coverage.
  await assert.rejects(
    providerRoutingService.routeProviders({ transactionType: 'payout', country: 'US' }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'NO_PROVIDER_ROUTE');
      const paypalSkip = error.details.skipped.find((entry) => entry.provider === 'paypal');
      assert.ok(paypalSkip, 'paypal should be skipped for an undeclared country');
      assert.match(paypalSkip.reason, /scope/i);
      return true;
    }
  );
});

test('environment sandbox keeps sandbox-eligible providers routable', async () => {
  const result = await providerRoutingService.routeProviders({
    transactionType: 'payout',
    environment: 'sandbox',
    onlyImplemented: false
  });

  assert.equal(result.execution.environment, 'sandbox');
  assert.ok(result.eligibility.eligible_providers.includes('paypal'));
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
