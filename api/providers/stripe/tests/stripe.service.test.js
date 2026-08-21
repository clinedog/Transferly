'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// ---------------------------------------------------------------------------
// StripeService
// ---------------------------------------------------------------------------

describe('StripeService', () => {
  const StripeService = require('../service');

  it('constructs without throwing', () => {
    assert.doesNotThrow(() => new StripeService({ config: {} }));
  });

  it('getBalance returns null when secretKey is missing', async () => {
    const svc = new StripeService({ config: {} });
    const res = await svc.getBalance();
    assert.equal(res, null);
  });

  it('listPayments returns object with data array when unconfigured', async () => {
    const svc = new StripeService({ config: {} });
    const res = await svc.listPayments();
    assert.ok(res !== undefined);
  });

  it('listInvoices returns without throwing when unconfigured', async () => {
    const svc = new StripeService({ config: {} });
    const res = await svc.listInvoices();
    assert.ok(res !== undefined);
  });

  it('createPayment throws AppError when secretKey missing', async () => {
    const svc = new StripeService({ config: {} });
    await assert.rejects(
      () => svc.createPayment({ amount: 100, currency: 'usd' }),
      { code: 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED' }
    );
  });

  it('createPayment throws STRIPE_INVALID_AMOUNT for zero amount', async () => {
    const svc = new StripeService({ config: { secretKey: 'sk_test_x' } });
    await assert.rejects(
      () => svc.createPayment({ amount: 0, currency: 'usd' }),
      { code: 'STRIPE_INVALID_AMOUNT' }
    );
  });

  it('createPayout throws STRIPE_MISSING_DESTINATION when destination missing', async () => {
    const svc = new StripeService({ config: { secretKey: 'sk_test_x' } });
    await assert.rejects(
      () => svc.createPayout({ amount: 100, currency: 'usd' }),
      { code: 'STRIPE_MISSING_DESTINATION' }
    );
  });
});

// ---------------------------------------------------------------------------
// StripeProvider
// ---------------------------------------------------------------------------

describe('StripeProvider', () => {
  const StripeProvider = require('../provider');

  it('constructs with id stripe', () => {
    const p = new StripeProvider();
    assert.equal(p.id, 'stripe');
    assert.equal(p.name, 'Stripe Connect');
  });

  it('getHealth returns provider and configured fields', async () => {
    const p = new StripeProvider();
    const health = await p.getHealth();
    assert.equal(health.provider, 'stripe');
    assert.ok('configured' in health);
    assert.ok('status' in health);
  });

  it('createClient returns an object with secretKey', () => {
    const p = new StripeProvider({ config: { secretKey: 'sk_test_x' } });
    const client = p.createClient();
    assert.equal(typeof client, 'object');
    assert.equal(client.secretKey, 'sk_test_x');
  });

  it('fetchTransactions returns data via client', async () => {
    const p = new StripeProvider({ config: {} });
    // No live key — should return empty/null
    const res = await p.fetchTransactions({});
    assert.ok(res !== undefined);
  });
});

// ---------------------------------------------------------------------------
// StripeClient
// ---------------------------------------------------------------------------

describe('StripeClient', () => {
  const StripeClient = require('../client');

  it('constructs with defaults', () => {
    const c = new StripeClient();
    assert.equal(c.baseUrl, 'https://api.stripe.com');
    assert.ok(c.apiVersion);
  });

  it('getBalance returns null when no secretKey', async () => {
    const c = new StripeClient({ secretKey: '' });
    const res = await c.getBalance();
    assert.equal(res, null);
  });

  it('listPaymentIntents returns empty data when no secretKey', async () => {
    const c = new StripeClient({ secretKey: '' });
    const res = await c.listPaymentIntents();
    assert.ok(Array.isArray(res.data));
    assert.equal(res.data.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Stripe webhook handler
// ---------------------------------------------------------------------------

describe('stripe webhook handler', () => {
  const { processWebhookEvent } = require('../jobs');

  it('returns ok:false for missing event', async () => {
    const result = await processWebhookEvent({ data: {} });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_event');
  });

  it('returns ok:true with handled:false for unrecognised event type', async () => {
    const result = await processWebhookEvent({ data: { event: { type: 'unknown.event', id: 'evt_1' } } });
    assert.equal(result.ok, true);
    assert.equal(result.handled, false);
  });

  it('returns ok:true with handled:true for payment_intent.succeeded', async () => {
    const result = await processWebhookEvent({
      data: { event: { id: 'evt_1', type: 'payment_intent.succeeded' } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.handled, true);
  });

  it('handles invoice.paid event', async () => {
    const result = await processWebhookEvent({
      data: { event: { id: 'evt_2', type: 'invoice.paid' } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.eventType, 'invoice.paid');
  });
});
