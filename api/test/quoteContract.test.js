'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFinancialQuote, assertQuoteActive } = require('../core/financial/quoteContract');

test('builds an authoritative quote with server-derived totals', () => {
  const quote = buildFinancialQuote({
    quoteId: 'quote-1',
    transactionType: 'payout',
    provider: 'paypal',
    idempotencyKey: 'payout-1',
    amountCents: 10000,
    providerFeeCents: 150,
    serviceFeeCents: 250,
    pointsRequired: 10,
    currency: 'usd',
    ttlMs: 60000
  }, {
    now: new Date('2026-01-01T00:00:00.000Z')
  });

  assert.equal(quote.totalCents, 10400);
  assert.equal(quote.currency, 'USD');
  assertQuoteActive(quote, { now: new Date('2026-01-01T00:00:30.000Z') });
});

test('rejects invalid money and expired quotes', () => {
  assert.throws(
    () => buildFinancialQuote({ amountCents: -1, currency: 'USD' }),
    (error) => error.code === 'FINANCIAL_QUOTE_AMOUNT_INVALID'
  );
  assert.throws(
    () => buildFinancialQuote({
      amountCents: 1,
      currency: 'USD',
      expiresAt: '2025-01-01T00:00:00.000Z'
    }, { now: new Date('2026-01-01T00:00:00.000Z') }),
    (error) => error.code === 'FINANCIAL_QUOTE_EXPIRY_INVALID'
  );
  assert.throws(
    () => assertQuoteActive({
      expiresAt: '2025-01-01T00:00:00.000Z'
    }, { now: new Date('2026-01-01T00:00:00.000Z') }),
    (error) => error.code === 'FINANCIAL_QUOTE_EXPIRED'
  );
});
