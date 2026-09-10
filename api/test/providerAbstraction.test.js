'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { selectBestProvider, filterByCapability, validateCapabilities } = require('../core/financial/providerRegistry');

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
