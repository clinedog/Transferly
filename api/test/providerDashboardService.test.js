const assert = require('node:assert/strict');
const { before, test } = require('node:test');

process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.SQLITE_DATABASE_PATH = process.env.SQLITE_DATABASE_PATH || './data/provider-dashboard-test.sqlite';
process.env.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'paypal-client-id';
process.env.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'paypal-webhook-id';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_provider_dashboard_test';
process.env.WISE_API_TOKEN = '';
process.env.WISE_PROFILE_ID = '';
process.env.CRYPTO_COMMERCE_API_KEY = process.env.CRYPTO_COMMERCE_API_KEY || 'crypto-commerce-key';

const { providerDashboardService } = require('../services/providerDashboardService');
const { migrate } = require('../db/migrate');

before(async () => {
  await migrate();
});

test('providerDashboardService returns a combined provider dashboard without secret values', async () => {
  const dashboard = await providerDashboardService.getProviderDashboard({
    provider: 'stripe',
    requestId: 'dashboard-test'
  });

  assert.equal(dashboard.provider.slug, 'stripe');
  assert.equal(dashboard.metadata.request_id, 'dashboard-test');
  assert.equal(dashboard.metadata.data_classification, 'no-secret-values');
  assert.equal(dashboard.settings.secret_values_exposed, false);
  assert.equal(dashboard.settings.status, 'needs-env');
  assert.equal(dashboard.balances.status, 'needs-env');
  assert.ok(dashboard.settings.missing_env.includes('STRIPE_SECRET_KEY'));
  assert.ok(Array.isArray(dashboard.operation_support));
  assert.ok(Array.isArray(dashboard.preflight));
  assert.ok(dashboard.preflight.some((entry) => entry.operation === 'balance'));
  assert.ok(dashboard.reconciliation.checks.some((entry) => entry.code === 'DUPLICATE_PAYOUTS'));
  assert.equal(dashboard.customer_profiles.status, 'preview');
  assert.equal(dashboard.recipient_profiles.status, 'preview');
  assert.equal(dashboard.adapter_contract.operations.createInvoice.status, 'preview');
  assert.equal(dashboard.adapter_contract.operations.previewPayout.status, 'preview');

  const serialized = JSON.stringify(dashboard);
  assert.equal(serialized.includes('paypal-client-secret'), false);
  assert.equal(serialized.includes('whsec_provider_dashboard_test'), false);
  assert.equal(serialized.includes('crypto-commerce-key'), false);
});

test('providerDashboardService gates unsupported or setup provider actions cleanly', async () => {
  const dashboard = await providerDashboardService.getProviderDashboard({
    provider: 'wise',
    requestId: 'wise-dashboard-test'
  });
  const payoutPreflight = dashboard.preflight.find((entry) => entry.operation === 'payouts');
  const invoicePreflight = dashboard.preflight.find((entry) => entry.operation === 'invoices');

  assert.equal(dashboard.provider.slug, 'wise');
  assert.equal(dashboard.recent_payouts.status, 'setup');
  assert.equal(dashboard.recent_invoices.status, 'unsupported');
  assert.equal(payoutPreflight.allowed, false);
  assert.equal(payoutPreflight.status, 'setup');
  assert.equal(payoutPreflight.checks.operation_support.passed, false);
  assert.equal(payoutPreflight.requirements.idempotency_key_required, true);
  assert.equal(invoicePreflight.allowed, false);
  assert.equal(invoicePreflight.status, 'unsupported');
  assert.equal(dashboard.settings.secret_values_exposed, false);
});
