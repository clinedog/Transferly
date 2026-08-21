'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('PaystackService', () => {
  const PaystackService = require('../service');

  it('constructs without throwing', () => {
    assert.doesNotThrow(() => new PaystackService({ config: {} }));
  });

  it('getBalance returns null when unconfigured', async () => {
    const svc = new PaystackService({ config: {} });
    const res = await svc.getBalance();
    assert.equal(res, null);
  });

  it('listTransactions returns without throwing when unconfigured', async () => {
    const svc = new PaystackService({ config: {} });
    const res = await svc.listTransactions();
    assert.ok(res !== undefined);
  });

  it('createPayment throws when secretKey missing', async () => {
    const svc = new PaystackService({ config: {} });
    await assert.rejects(
      () => svc.createPayment({ email: 'a@b.com', amount: 5000 }),
      { code: 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED' }
    );
  });

  it('createPayment throws PAYSTACK_MISSING_EMAIL when email absent', async () => {
    const svc = new PaystackService({ config: { secretKey: 'sk_test_x' } });
    await assert.rejects(
      () => svc.createPayment({ amount: 5000 }),
      { code: 'PAYSTACK_MISSING_EMAIL' }
    );
  });

  it('createPayment throws PAYSTACK_INVALID_AMOUNT for zero amount', async () => {
    const svc = new PaystackService({ config: { secretKey: 'sk_test_x' } });
    await assert.rejects(
      () => svc.createPayment({ email: 'a@b.com', amount: 0 }),
      { code: 'PAYSTACK_INVALID_AMOUNT' }
    );
  });

  it('createPayout throws PAYSTACK_MISSING_RECIPIENT when recipient absent', async () => {
    const svc = new PaystackService({ config: { secretKey: 'sk_test_x' } });
    await assert.rejects(
      () => svc.createPayout({ amount: 5000 }),
      { code: 'PAYSTACK_MISSING_RECIPIENT' }
    );
  });
});

describe('PaystackProvider', () => {
  const PaystackProvider = require('../provider');

  it('constructs with id paystack', () => {
    const p = new PaystackProvider();
    assert.equal(p.id, 'paystack');
    assert.equal(p.name, 'Paystack');
  });

  it('getHealth returns provider and configured fields', async () => {
    const p = new PaystackProvider();
    const health = await p.getHealth();
    assert.equal(health.provider, 'paystack');
    assert.ok('configured' in health);
    assert.ok(typeof health.configured === 'boolean');
  });

  it('createClient returns an object', () => {
    const p = new PaystackProvider({ config: { secretKey: 'sk_test_x' } });
    const client = p.createClient();
    assert.equal(typeof client, 'object');
  });
});

describe('PaystackClient', () => {
  const PaystackClient = require('../client');

  it('constructs with defaults', () => {
    const c = new PaystackClient();
    assert.equal(c.baseUrl, 'https://api.paystack.co');
  });

  it('getBalance returns null when no secretKey', async () => {
    const c = new PaystackClient({ secretKey: '' });
    const res = await c.getBalance();
    assert.equal(res, null);
  });

  it('listTransactions returns empty object when unconfigured', async () => {
    const c = new PaystackClient({ secretKey: '' });
    const res = await c.listTransactions();
    assert.ok(typeof res === 'object');
  });
});

describe('paystack webhook job', () => {
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

  it('handles charge.success event', async () => {
    const result = await processWebhookEvent({
      data: { event: { event: 'charge.success', data: { id: 42 } } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.handled, true);
  });

  it('handles transfer.success event', async () => {
    const result = await processWebhookEvent({
      data: { event: { event: 'transfer.success', data: { id: 99 } } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.eventType, 'transfer.success');
  });
});
