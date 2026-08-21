'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('FlutterwaveService', () => {
  const FlutterwaveService = require('../service');

  it('constructs without throwing', () => {
    assert.doesNotThrow(() => new FlutterwaveService({ config: {} }));
  });

  it('getBalance returns null when unconfigured', async () => {
    const svc = new FlutterwaveService({ config: {} });
    const res = await svc.getBalance();
    assert.equal(res, null);
  });

  it('listTransactions returns without throwing when unconfigured', async () => {
    const svc = new FlutterwaveService({ config: {} });
    const res = await svc.listTransactions();
    assert.ok(res !== undefined);
  });

  it('createPayment throws when secretKey missing', async () => {
    const svc = new FlutterwaveService({ config: {} });
    await assert.rejects(
      () => svc.createPayment({ tx_ref: 'ref1', amount: 1000, customer: { email: 'a@b.com' }, redirect_url: 'https://example.com' }),
      { code: 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED' }
    );
  });

  it('createPayment throws FLUTTERWAVE_MISSING_TX_REF when tx_ref absent', async () => {
    const svc = new FlutterwaveService({ config: { secretKey: 'FLWSECK_TEST-x' } });
    await assert.rejects(
      () => svc.createPayment({ amount: 1000, customer: { email: 'a@b.com' }, redirect_url: 'https://example.com' }),
      { code: 'FLUTTERWAVE_MISSING_TX_REF' }
    );
  });

  it('createPayment throws FLUTTERWAVE_INVALID_AMOUNT for zero amount', async () => {
    const svc = new FlutterwaveService({ config: { secretKey: 'FLWSECK_TEST-x' } });
    await assert.rejects(
      () => svc.createPayment({ tx_ref: 'ref1', amount: 0, customer: { email: 'a@b.com' }, redirect_url: 'https://example.com' }),
      { code: 'FLUTTERWAVE_INVALID_AMOUNT' }
    );
  });

  it('createPayment throws FLUTTERWAVE_MISSING_CUSTOMER when customer.email absent', async () => {
    const svc = new FlutterwaveService({ config: { secretKey: 'FLWSECK_TEST-x' } });
    await assert.rejects(
      () => svc.createPayment({ tx_ref: 'ref1', amount: 1000, redirect_url: 'https://example.com' }),
      { code: 'FLUTTERWAVE_MISSING_CUSTOMER' }
    );
  });

  it('createPayout throws FLUTTERWAVE_MISSING_ACCOUNT when account fields absent', async () => {
    const svc = new FlutterwaveService({ config: { secretKey: 'FLWSECK_TEST-x' } });
    await assert.rejects(
      () => svc.createPayout({ amount: 1000 }),
      { code: 'FLUTTERWAVE_MISSING_ACCOUNT' }
    );
  });
});

describe('FlutterwaveProvider', () => {
  const FlutterwaveProvider = require('../provider');

  it('constructs with id flutterwave', () => {
    const p = new FlutterwaveProvider();
    assert.equal(p.id, 'flutterwave');
    assert.equal(p.name, 'Flutterwave');
  });

  it('getHealth returns provider and configured fields', async () => {
    const p = new FlutterwaveProvider();
    const health = await p.getHealth();
    assert.equal(health.provider, 'flutterwave');
    assert.ok('configured' in health);
  });

  it('createClient returns an object', () => {
    const p = new FlutterwaveProvider({ config: { secretKey: 'FLWSECK_TEST-x' } });
    const client = p.createClient();
    assert.equal(typeof client, 'object');
  });
});

describe('FlutterwaveClient', () => {
  const FlutterwaveClient = require('../client');

  it('constructs with defaults', () => {
    const c = new FlutterwaveClient();
    assert.ok(c.baseUrl.includes('flutterwave'));
  });

  it('getBalance returns null when no secretKey', async () => {
    const c = new FlutterwaveClient({ secretKey: '' });
    const res = await c.getBalance();
    assert.equal(res, null);
  });

  it('listTransactions returns empty object when unconfigured', async () => {
    const c = new FlutterwaveClient({ secretKey: '' });
    const res = await c.listTransactions();
    assert.ok(typeof res === 'object');
  });
});

describe('flutterwave webhook job', () => {
  const { processWebhookEvent } = require('../jobs');

  it('returns ok:false for missing event', async () => {
    const result = await processWebhookEvent({ data: {} });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_event');
  });

  it('returns ok:true with handled:false for unrecognised event type', async () => {
    const result = await processWebhookEvent({ data: { event: { event: 'unknown.event', data: { id: 1 } } } });
    assert.equal(result.ok, true);
    assert.equal(result.handled, false);
  });

  it('handles charge.completed successful event', async () => {
    const result = await processWebhookEvent({
      data: { event: { event: 'charge.completed', data: { id: 7, status: 'successful' } } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.handled, true);
  });

  it('handles transfer.completed event', async () => {
    const result = await processWebhookEvent({
      data: { event: { event: 'transfer.completed', data: { id: 8 } } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.eventType, 'transfer.completed');
  });
});
