const assert = require('node:assert/strict');
const { before, test } = require('node:test');

process.env.SQLITE_DATABASE_PATH = process.env.SQLITE_DATABASE_PATH || './data/provider-capability-test.sqlite';
process.env.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'paypal-client-id';
process.env.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'paypal-webhook-id';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_transferly';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_provider_capability_test';
process.env.CRYPTO_COMMERCE_API_KEY = process.env.CRYPTO_COMMERCE_API_KEY || 'crypto-commerce-key';

const { providerCapabilityService } = require('../services/providerCapabilityService');
const { providerReadinessService } = require('../services/providerReadinessService');
const { providerManifestService } = require('../services/providerManifestService');
const { providerReadinessReportService } = require('../services/providerReadinessReportService');
const { providerStatusService } = require('../services/providerStatusService');
const { AppError } = require('../utils/errors');
const { migrate } = require('../db/migrate');

before(async () => {
  await migrate();
});

test('providerCapabilityService lists provider capabilities without exposing secrets', () => {
  const providers = providerCapabilityService.listProviderCapabilities();
  const providerSlugs = providers.map((provider) => provider.slug);

  assert.deepEqual(providerSlugs, ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']);
  assert.ok(providers.every((provider) => Array.isArray(provider.lanes)));
  assert.equal(providers.find((provider) => provider.slug === 'paypal').operations.invoices.implemented, true);
  assert.equal(providers.find((provider) => provider.slug === 'stripe').operations.balance.implemented, true);
  assert.equal(providers.find((provider) => provider.slug === 'stripe').operations.balance.label, 'Live');
  assert.equal(providers.find((provider) => provider.slug === 'wise').operations.invoices.actionable, false);
  assert.match(providers.find((provider) => provider.slug === 'wise').operations.invoices.reason, /does not support/);

  const serialized = JSON.stringify(providers);
  assert.equal(serialized.includes('paypal-client-secret'), false);
  assert.equal(serialized.includes('sk_test_transferly'), false);
  assert.equal(serialized.includes('crypto-commerce-key'), false);
});

test('providerCapabilityService allows implemented provider operations', () => {
  assert.deepEqual(providerCapabilityService.assertProviderOperation('stripe', 'payouts'), {
    provider: 'stripe',
    operation: 'payouts',
    status: 'live'
  });
  assert.deepEqual(providerCapabilityService.assertProviderOperation('crypto', 'invoices'), {
    provider: 'crypto',
    operation: 'invoices',
    status: 'live'
  });
});

test('providerCapabilityService reports setup and unsupported operations with supported providers', () => {
  assert.throws(
    () => providerCapabilityService.assertProviderOperation('wise', 'payouts'),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 501);
      assert.equal(error.code, 'PROVIDER_OPERATION_NOT_AVAILABLE');
      assert.equal(error.details.provider, 'wise');
      assert.equal(error.details.status, 'setup');
      assert.deepEqual(error.details.supported_providers, ['paypal', 'stripe']);
      return true;
    }
  );

  assert.throws(
    () => providerCapabilityService.assertProviderOperation('crypto', 'payouts'),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 501);
      assert.equal(error.details.status, 'unsupported');
      assert.deepEqual(error.details.supported_providers, ['paypal', 'stripe']);
      return true;
    }
  );
});

test('providerCapabilityService returns provider lane contracts and typed missing-lane errors', () => {
  const lanes = providerCapabilityService.listProviderLanes('paypal');
  assert.ok(lanes.some((lane) => lane.id === 'invoices'));

  const lane = providerCapabilityService.getProviderLaneCapability('paypal', 'invoices');
  assert.equal(lane.id, 'invoices');
  assert.equal(typeof lane.label, 'string');

  assert.throws(
    () => providerCapabilityService.getProviderLaneCapability('paypal', 'missing-lane'),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'PROVIDER_LANE_NOT_FOUND');
      assert.equal(error.details.provider, 'paypal');
      assert.ok(error.details.available_lanes.includes('invoices'));
      return true;
    }
  );
});

test('providerReadinessService summarizes provider operations and next steps safely', () => {
  const readiness = providerReadinessService.getProviderReadiness('stripe');

  assert.equal(readiness.provider, 'stripe');
  assert.equal(readiness.display_name, 'Stripe');
  assert.equal(typeof readiness.ready, 'boolean');
  assert.ok(readiness.operations.some((operation) => operation.operation === 'balance'));
  assert.ok(Array.isArray(readiness.lanes));
  assert.ok(Array.isArray(readiness.recommended_next_steps));

  const serialized = JSON.stringify(readiness);
  assert.equal(serialized.includes('sk_test_transferly'), false);
});

test('providerReadinessService lists all provider readiness contracts', () => {
  const readiness = providerReadinessService.listProviderReadiness();

  assert.deepEqual(readiness.map((provider) => provider.provider), ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']);
  assert.ok(readiness.every((provider) => Array.isArray(provider.operations)));
  assert.ok(readiness.every((provider) => Array.isArray(provider.recommended_next_steps)));
});

test('provider manifest lists enabled workspaces and disabled discovery modules without secrets', () => {
  const manifests = providerManifestService.listProviderManifests({ includeDisabled: true });
  const binance = manifests.find((manifest) => manifest.key === 'binance');
  const paypal = manifests.find((manifest) => manifest.key === 'paypal');

  assert.equal(manifests.length, 8);
  assert.equal(binance.enabled, false);
  assert.equal(binance.lifecycle, 'discovery-only');
  assert.equal(binance.navigation.visible, false);
  assert.equal(paypal.enabled, true);
  assert.equal(paypal.routes.dashboard, '/api/providers/paypal/dashboard');
  assert.equal(JSON.stringify(manifests).includes('sk_test_transferly'), false);
});

test('provider readiness report includes safe disabled-provider guidance', async () => {
  const report = await providerReadinessReportService.listProviderReadinessReport();
  const cashApp = report.find((entry) => entry.manifest.key === 'cashapp');

  assert.equal(report.length, 8);
  assert.equal(cashApp.readiness.status, 'disabled');
  assert.equal(cashApp.health, null);
  assert.equal(cashApp.readiness.recommended_next_steps[0].code, 'COMPLETE_PROVIDER_INTEGRATION');
});

test('providerStatusService summarizes status and preflights provider actions safely', async () => {
  const status = await providerStatusService.getProviderStatus('stripe');

  assert.equal(status.provider, 'stripe');
  assert.equal(status.display_name, 'Stripe');
  assert.equal(typeof status.ready, 'boolean');
  assert.equal(typeof status.health_score, 'number');
  assert.ok(status.operations.some((operation) => operation.operation === 'balance'));
  assert.ok(Array.isArray(status.next_actions));

  const allowed = await providerStatusService.preflightProviderAction('stripe', 'balance');
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.provider, 'stripe');
  assert.equal(allowed.operation, 'balance');
  assert.equal(allowed.code, null);
  assert.deepEqual(allowed.blocking_reasons, []);
  assert.equal(allowed.checks.idempotency_key.required, false);
  assert.equal(allowed.checks.operation_support.passed, true);
  assert.equal(allowed.setup.idempotency_key_required, false);
  assert.equal(allowed.requirements.balance_check_required, false);

  const blocked = await providerStatusService.preflightProviderAction('wise', 'payouts');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'PROVIDER_OPERATION_NOT_AVAILABLE');
  assert.equal(blocked.status, 'setup');
  assert.ok(blocked.blocking_reasons.includes('Provider operation is not available for submission.'));
  assert.deepEqual(blocked.supported_providers, ['paypal', 'stripe']);
  assert.equal(blocked.checks.operation_support.passed, false);
  assert.equal(blocked.checks.operation_support.status, 'setup');
  assert.equal(blocked.requirements.idempotency_key_required, true);
  assert.equal(blocked.requirements.balance_check_required, true);
  assert.equal(blocked.setup.idempotency_key_required, true);

  const serialized = JSON.stringify({ status, allowed, blocked });
  assert.equal(serialized.includes('paypal-client-secret'), false);
  assert.equal(serialized.includes('sk_test_transferly'), false);
});
