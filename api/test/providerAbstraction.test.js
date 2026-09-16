'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { selectBestProvider, filterByCapability, validateCapabilities } = require('../core/financial/providerRegistry');
const {
  describeOperation,
  buildProviderReadinessDescriptor,
  normalizeCapabilities,
  supportsCountry,
  supportsCurrency,
  PAYMENT_METHOD,
  normalizePaymentMethod,
  normalizeTransactionType,
  TRANSACTION_TYPE,
  OPERATION_BY_TRANSACTION_TYPE,
  normalizeProviderOutcome,
  categorizeProviderError,
  screenSafeMetadata,
  buildProviderResult,
  normalizeWebhookEvent
} = require('../core/financial/providerContract');

describe('Provider Registry', () => {
  const mockProvider1 = {
    key: 'paypal',
    name: 'PayPal',
    order: 10,
    getCapabilities: () => ({ payouts: true, cardPayments: true, bankTransfer: true, supportedCountries: ['US', 'NG'], supportedCurrencies: ['USD', 'NGN'] }),
    getKey: () => 'paypal',
    getName: () => 'PayPal',
    getOrder: () => 10
  };

  const mockProvider2 = {
    key: 'stripe',
    name: 'Stripe',
    order: 20,
    getCapabilities: () => ({ payouts: true, cardPayments: true, supportedCountries: ['US', 'GB'], supportedCurrencies: ['USD', 'EUR'] }),
    getKey: () => 'stripe',
    getName: () => 'Stripe',
    getOrder: () => 20
  };

  test('selectBestProvider returns highest priority provider', () => {
    const result = selectBestProvider({ country: 'US', currency: 'USD', transactionType: 'payout', providers: [mockProvider1, mockProvider2] });
    assert.strictEqual(result.provider.key, 'paypal');
  });

  test('selectBestProvider filters by country', () => {
    const result = selectBestProvider({ country: 'NG', currency: 'NGN', transactionType: 'payout', providers: [mockProvider1, mockProvider2] });
    assert.strictEqual(result.provider.key, 'paypal');
  });

  test('selectBestProvider throws when no suitable provider', () => {
    assert.throws(() => selectBestProvider({ country: 'XX', currency: 'XXX', transactionType: 'payout', providers: [mockProvider1, mockProvider2] }), /No provider supports/);
  });

  test('filterByCapability returns only providers with capability', () => {
    const result = filterByCapability([mockProvider1, mockProvider2], 'cardPayments');
    assert.strictEqual(result.length, 2);
  });

  test('validateCapabilities returns missing capabilities', () => {
    const result = validateCapabilities(mockProvider1, ['payouts', 'mobileMoney']);
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.includes('mobileMoney'));
  });
});

describe('Canonical provider readiness contract', () => {
  test('does not make preview, coming-soon, degraded, or maintenance operations executable', () => {
    for (const status of ['preview', 'coming_soon', 'degraded', 'maintenance', 'disabled']) {
      const operation = describeOperation({ status, environment: 'live' });
      assert.equal(operation.executionEligible.production, false, status);
      assert.equal(operation.executionEligible.sandbox, false, status);
    }
  });

  test('limits sandbox execution to sandbox-capable operations', () => {
    const sandbox = describeOperation({ status: 'sandbox', environment: 'sandbox' });
    assert.equal(sandbox.executionEligible.production, false);
    assert.equal(sandbox.executionEligible.sandbox, true);
    assert.equal(sandbox.executionEligible.eligibleForRequestedEnvironment, true);
  });

  test('keeps empty or partially declared country and currency scopes restrictive', () => {
    const capabilities = normalizeCapabilities({ countries: ['US'], currencies: [] });
    assert.equal(supportsCountry(capabilities, 'US'), true);
    assert.equal(supportsCountry(capabilities, 'NG'), false);
    assert.equal(supportsCurrency(capabilities, 'USD'), false);
  });

  test('buildProviderReadinessDescriptor preserves canonical root arrays and execution eligibility fields', () => {
    const readiness = buildProviderReadinessDescriptor({
      provider: 'example',
      summary: {
        status: 'configured',
        mode: 'sandbox',
        capabilities: { countries: ['US'], currencies: ['USD'] }
      },
      adapterContract: {
        provider: 'example',
        configured: true,
        mode: 'sandbox',
        required_env: ['PAYPAL_CLIENT_ID'],
        missing_env: ['PAYPAL_CLIENT_SECRET'],
        operations: { createPayout: { status: 'sandbox' } }
      },
      enabled: true,
      operationStatuses: { payouts: 'sandbox' }
    });

    assert.equal(readiness.status, 'configured');
    assert.deepEqual(readiness.required_env, ['PAYPAL_CLIENT_ID']);
    assert.deepEqual(readiness.missing_env, ['PAYPAL_CLIENT_SECRET']);
    assert.deepEqual(readiness.requiredConfiguration, ['PAYPAL_CLIENT_ID']);
    assert.deepEqual(readiness.missingConfiguration, ['PAYPAL_CLIENT_SECRET']);
    assert.equal(readiness.operations.payouts.operationStatus, 'sandbox');
    assert.equal(readiness.operations.payouts.executionEligible.production, false);
    assert.equal(readiness.operations.payouts.executionEligible.sandbox, true);
    assert.equal(readiness.operations.payouts.executionEligible.eligibleForRequestedEnvironment, true);
  });

  test('normalizes BNPL and older payment-method aliases into the canonical payment-method vocabulary', () => {
    assert.equal(PAYMENT_METHOD.BNPL, 'bnpl');
    assert.equal(normalizePaymentMethod('buy-now-pay-later'), 'bnpl');
    assert.equal(normalizePaymentMethod('bnpl'), 'bnpl');
  });

  test('keeps transaction semantics distinct and non-overlapping across payment, invoice payment, payment link, transfer, payout, refund, and subscription flows', () => {
    assert.equal(normalizeTransactionType('invoice'), TRANSACTION_TYPE.INVOICE_PAYMENT);
    assert.equal(normalizeTransactionType('payment_link'), TRANSACTION_TYPE.PAYMENT_LINK);
    assert.equal(normalizeTransactionType('payout'), TRANSACTION_TYPE.PAYOUT);
    assert.equal(normalizeTransactionType('refund'), TRANSACTION_TYPE.REFUND);
    assert.equal(normalizeTransactionType('subscription'), TRANSACTION_TYPE.SUBSCRIPTION);
    assert.equal(OPERATION_BY_TRANSACTION_TYPE[TRANSACTION_TYPE.PAYMENT], 'payments');
    assert.equal(OPERATION_BY_TRANSACTION_TYPE[TRANSACTION_TYPE.INVOICE_PAYMENT], 'invoices');
    assert.equal(OPERATION_BY_TRANSACTION_TYPE[TRANSACTION_TYPE.PAYMENT_LINK], 'payment_links');
    assert.equal(OPERATION_BY_TRANSACTION_TYPE[TRANSACTION_TYPE.TRANSFER], 'transfers');
    assert.equal(OPERATION_BY_TRANSACTION_TYPE[TRANSACTION_TYPE.PAYOUT], 'payouts');
    assert.equal(OPERATION_BY_TRANSACTION_TYPE[TRANSACTION_TYPE.REFUND], 'refunds');
    assert.equal(OPERATION_BY_TRANSACTION_TYPE[TRANSACTION_TYPE.SUBSCRIPTION], 'subscriptions');
  });

  test('requires enablement and configuration before declaring a live operation executable', () => {
    const base = {
      provider: 'example',
      summary: { capabilities: { countries: ['US'], currencies: ['USD'] } },
      adapterContract: {
        provider: 'example',
        configured: true,
        mode: 'live',
        operations: { createPayout: { status: 'live' } }
      }
    };
    const disabled = buildProviderReadinessDescriptor({ ...base, enabled: false });
    const enabled = buildProviderReadinessDescriptor({ ...base, enabled: true });
    assert.equal(disabled.operations.payouts.executionEligible.production, false);
    assert.equal(enabled.operations.payouts.executionEligible.production, true);
    assert.deepEqual(enabled.countries, ['US']);
    assert.deepEqual(enabled.currencies, ['USD']);
  });
});
describe('Phase 2 canonical result + error normalization', () => {
  test('never normalizes unknown, empty, pending, or unrecognized raw outcomes to success', () => {
    for (const raw of [undefined, null, '', 'pending', 'processing', 'in_progress', 'unknown', 'weird_nonsense']) {
      const outcome = normalizeProviderOutcome(raw);
      assert.equal(outcome.state, 'unknown', `raw=${String(raw)}`);
      assert.notEqual(outcome.state, 'success');
    }
    assert.equal(normalizeProviderOutcome('succeeded').state, 'success');
    assert.equal(normalizeProviderOutcome('paid').state, 'success');
    assert.equal(normalizeProviderOutcome('failed').state, 'failed');
    assert.equal(normalizeProviderOutcome('rejected').state, 'failed');
    assert.equal(normalizeProviderOutcome(true).state, 'success');
    assert.equal(normalizeProviderOutcome(false).state, 'failed');
  });

  test('buildProviderResult flags unknown outcomes for reconciliation and never for success', () => {
    const unknown = buildProviderResult({
      operation: 'payouts',
      provider: 'paypal',
      rawStatus: 'unknown',
      providerTransactionId: 'BATCH-1',
      amount: 1000,
      currency: 'ngn'
    });
    assert.equal(unknown.outcome, 'unknown');
    assert.equal(unknown.settlement, 'unknown');
    assert.equal(unknown.reconciliation_required, true);
    assert.equal(unknown.amount, 1000);
    assert.equal(unknown.currency, 'NGN');
    assert.equal(JSON.stringify(unknown).includes('"outcome":"success"'), false);
  });

  test('buildProviderResult with an explicit settled success does not request reconciliation', () => {
    const settled = buildProviderResult({
      operation: 'payments',
      provider: 'stripe',
      rawStatus: 'succeeded',
      settlement: 'settled',
      providerTransactionId: 'ch_123'
    });
    assert.equal(settled.outcome, 'success');
    assert.equal(settled.reconciliation_required, false);
    assert.equal(settled.settlement, 'settled');
  });

test('buildProviderResult screens raw secrets and credential-shaped values out of metadata', () => {
    // Secret-shaped fixtures are built at runtime so no credential-looking
    // literal ever appears in source. The redaction assertion remains exact.
    const secretLiveKey = 'sk_live_' + 'hunter2_secret';
    const visaToken = 'tok_' + 'visa';
    const testPan = '4242' + '4242' + '4242' + '4242';
    const result = buildProviderResult({
      operation: 'payments',
      provider: 'stripe',
      rawStatus: 'succeeded',
      settlement: 'settled',
      safeMetadata: {
        invoice_number: 'INV-1',
        client_secret: secretLiveKey,
        token: visaToken,
        signature: 'abc123',
        customer: { name: 'Ada', card_number: testPan }
      }
    });
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(secretLiveKey), false);
    assert.equal(serialized.includes(visaToken), false);
    assert.equal(serialized.includes(testPan), false);
    assert.equal(result.safe_metadata.client_secret, '[REDACTED]');
    assert.equal(result.safe_metadata.token, '[REDACTED]');
    assert.equal(result.safe_metadata.customer.card_number, '[REDACTED]');
    assert.equal(result.safe_metadata.invoice_number, 'INV-1');
  });

  test('screenSafeMetadata truncates deep nesting instead of echoing large payloads', () => {
    const nested = { level1: { level2: { level3: { level4: { secret: 'deep' } } } } };
    const screened = screenSafeMetadata(nested, { depth: 2 });
    assert.equal(screened.level1.level2.level3, '[TRUNCATED]');
  });

  test('categorizeProviderError returns canonical category, retryability, and never the raw message', () => {
    const rateLimited = categorizeProviderError({ code: 'RATE_LIMIT', message: '429 too many requests', status: 429 });
    assert.equal(rateLimited.category, 'rate_limit');
    assert.equal(rateLimited.rate_limited, true);
    assert.equal(rateLimited.retryable, true);

    const timeout = categorizeProviderError({ code: 'TIMEOUT', message: 'request timed out' });
    assert.equal(timeout.category, 'timeout');
    assert.equal(timeout.retryable, true);

    const insufficient = categorizeProviderError({ code: 'INSUFFICIENT_FUNDS', message: 'insufficient funds' });
    assert.equal(insufficient.category, 'insufficient_funds');
    assert.equal(insufficient.retryable, false);

    const unknown = categorizeProviderError({ code: 'WEIRD_CODE', message: 'some opaque thing' });
    assert.equal(unknown.category, 'unknown');
    assert.equal(unknown.retryable, false);
    assert.equal(JSON.stringify(unknown).includes('some opaque thing'), false);
    assert.equal(unknown.raw_provider_error_exposed, false);
  });
});

describe('Phase 2 canonical webhook normalization', () => {
  test('classifies financial/dispute events and flags unknown financial outcomes for reconciliation', () => {
    const financialUnknown = normalizeWebhookEvent({
      provider: 'paypal',
      eventId: 'WH-1',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      rawStatus: 'processing'
    });
    assert.equal(financialUnknown.category, 'financial');
    assert.equal(financialUnknown.requires_reconciliation, true);

    const dispute = normalizeWebhookEvent({ provider: 'paypal', eventId: 'WH-2', eventType: 'CUSTOMER.DISPUTE.CREATED' });
    assert.equal(dispute.category, 'dispute');

    const administrative = normalizeWebhookEvent({ provider: 'paypal', eventId: 'WH-3', eventType: 'MERCHANT.ACCOUNT.UPDATED' });
    assert.equal(administrative.category, 'administrative');
    assert.equal(administrative.requires_reconciliation, false);

    const financialSettled = normalizeWebhookEvent({
      provider: 'stripe',
      eventId: 'WH-4',
      eventType: 'charge.succeeded',
      rawStatus: 'succeeded'
    });
    assert.equal(financialSettled.category, 'financial');
    assert.equal(financialSettled.requires_reconciliation, false);
  });

  test('normalizeWebhookEvent screens secrets and does not echo raw signatures', () => {
    const webhookSecret = 'whsec_' + '1234';
    const event = normalizeWebhookEvent({
      provider: 'paypal',
      eventId: 'WH-9',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      safeMetadata: { webhook_secret: webhookSecret, summary: 'ok' }
    });
    assert.equal(event.safe_metadata.webhook_secret, '[REDACTED]');
    assert.equal(JSON.stringify(event).includes(webhookSecret), false);
    assert.equal(event.safe_metadata.summary, 'ok');
  });
});

describe('Phase 1 supplemental readiness matrix', () => {
  test('coming-soon and disabled operation statuses are never production-executable in the descriptor', () => {
    for (const status of ['coming_soon', 'disabled']) {
      const readiness = buildProviderReadinessDescriptor({
        provider: 'example',
        summary: { mode: 'live', capabilities: { countries: ['US'], currencies: ['USD'] } },
        adapterContract: { provider: 'example', configured: true, mode: 'live', required_env: [], missing_env: [] },
        enabled: true,
        operationStatuses: { payouts: status }
      });
      assert.equal(readiness.operations.payouts.operationStatus, status, status);
      assert.equal(readiness.operations.payouts.executionEligible.production, false, status);
      assert.equal(readiness.operations.payouts.executionEligible.sandbox, false, status);
    }
  });

  test('providerRegistry never selects a provider that does not declare the requested payment method', () => {
    const cardOnly = {
      key: 'cardco', order: 10,
      getCapabilities: () => ({ payouts: true, cardPayments: true, supportedCountries: ['US'], supportedCurrencies: ['USD'] }),
      getKey: () => 'cardco', getOrder: () => 10
    };
    const walletOnly = {
      key: 'walletco', order: 5,
      getCapabilities: () => ({ payouts: true, walletPayments: true, supportedCountries: ['US'], supportedCurrencies: ['USD'] }),
      getKey: () => 'walletco', getOrder: () => 5
    };

    const withCard = selectBestProvider({ country: 'US', currency: 'USD', paymentMethod: 'card', transactionType: 'payout', providers: [walletOnly, cardOnly] });
    assert.equal(withCard.provider.getKey(), 'cardco');

    const withWallet = selectBestProvider({ country: 'US', currency: 'USD', paymentMethod: 'wallet', transactionType: 'payout', providers: [walletOnly, cardOnly] });
    assert.equal(withWallet.provider.getKey(), 'walletco');

    assert.throws(
      () => selectBestProvider({ country: 'US', currency: 'USD', paymentMethod: 'mobile_money', transactionType: 'payout', providers: [walletOnly, cardOnly] }),
      /No provider supports|No such|UNSUPPORTED|mobile_money/i
    );
  });

  test('malformed or unknown capability declarations normalize to unsupported and never to executable', () => {
    const normalized = normalizeCapabilities({ operations: { payouts: 'completely-bogus-status', payments: 'unsupported' } });
    assert.equal(normalized.operations.payouts.status, 'unsupported');
    assert.equal(normalized.operations.payouts.productionEligible, false);
    assert.equal(normalized.operations.payments.executionEligible.production, false);
  });
});
