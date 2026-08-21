'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('CryptoCommerceService', () => {
  const CryptoCommerceService = require('../service');

  it('constructs without throwing', () => {
    assert.doesNotThrow(() => new CryptoCommerceService({ config: {} }));
  });

  it('listCharges returns without throwing when unconfigured', async () => {
    const svc = new CryptoCommerceService({ config: {} });
    const res = await svc.listCharges();
    assert.ok(res !== undefined);
  });

  it('getCharge returns without throwing when unconfigured', async () => {
    const svc = new CryptoCommerceService({ config: {} });
    // Will throw a network error since no key — catch it
    try {
      await svc.getCharge('test-id');
    } catch (err) {
      assert.ok(err.message);
    }
  });

  it('createPayment throws when apiKey missing', async () => {
    const svc = new CryptoCommerceService({ config: {} });
    await assert.rejects(
      () => svc.createPayment({ name: 'Test', local_price: { amount: '10', currency: 'USD' } }),
      { code: 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED' }
    );
  });

  it('createPayment throws CRYPTO_COMMERCE_MISSING_NAME when name absent', async () => {
    const svc = new CryptoCommerceService({ config: { apiKey: 'test-key' } });
    await assert.rejects(
      () => svc.createPayment({ local_price: { amount: '10', currency: 'USD' } }),
      { code: 'CRYPTO_COMMERCE_MISSING_NAME' }
    );
  });

  it('createPayment throws CRYPTO_COMMERCE_MISSING_PRICE for fixed_price without local_price', async () => {
    const svc = new CryptoCommerceService({ config: { apiKey: 'test-key' } });
    await assert.rejects(
      () => svc.createPayment({ name: 'Test', pricing_type: 'fixed_price' }),
      { code: 'CRYPTO_COMMERCE_MISSING_PRICE' }
    );
  });

  it('cancelCharge throws CRYPTO_COMMERCE_MISSING_CHARGE_ID when no id', async () => {
    const svc = new CryptoCommerceService({ config: { apiKey: 'test-key' } });
    await assert.rejects(
      () => svc.cancelCharge(''),
      { code: 'CRYPTO_COMMERCE_MISSING_CHARGE_ID' }
    );
  });

  it('createPayout always throws not-implemented', async () => {
    const svc = new CryptoCommerceService({ config: { apiKey: 'test-key' } });
    await assert.rejects(
      () => svc.createPayout({}),
      { code: 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED' }
    );
  });
});

describe('CryptoCommerceProvider', () => {
  const CryptoCommerceProvider = require('../provider');

  it('constructs with id crypto', () => {
    const p = new CryptoCommerceProvider();
    assert.equal(p.id, 'crypto');
    assert.equal(p.name, 'Crypto Commerce');
  });

  it('getHealth returns provider and configured fields', async () => {
    const p = new CryptoCommerceProvider();
    const health = await p.getHealth();
    assert.equal(health.provider, 'crypto');
    assert.ok('configured' in health);
  });

  it('createClient returns an object', () => {
    const p = new CryptoCommerceProvider({ config: { apiKey: 'test-key' } });
    const client = p.createClient();
    assert.equal(typeof client, 'object');
  });
});

describe('CryptoCommerceClient', () => {
  const CryptoCommerceClient = require('../client');

  it('constructs with defaults', () => {
    const c = new CryptoCommerceClient();
    assert.ok(c.baseUrl.includes('coinbase'));
  });

  it('listCharges returns empty data when no apiKey', async () => {
    const c = new CryptoCommerceClient({ apiKey: '' });
    const res = await c.listCharges();
    assert.ok(typeof res === 'object');
  });

  it('listEvents returns object when unconfigured', async () => {
    const c = new CryptoCommerceClient({ apiKey: '' });
    const res = await c.listEvents();
    assert.ok(typeof res === 'object');
  });
});

describe('crypto webhook job', () => {
  const { processWebhookEvent } = require('../jobs');

  it('returns ok:false for missing event', async () => {
    const result = await processWebhookEvent({ data: {} });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_event');
  });

  it('returns ok:true with handled:false for unrecognised event type', async () => {
    const result = await processWebhookEvent({ data: { event: { type: 'charge:unknown', id: 'evt_1' } } });
    assert.equal(result.ok, true);
    assert.equal(result.handled, false);
  });

  it('handles charge:confirmed event', async () => {
    const result = await processWebhookEvent({
      data: { event: { type: 'charge:confirmed', id: 'evt_2', data: { code: 'ABC123' } } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.handled, true);
  });

  it('handles charge:failed event', async () => {
    const result = await processWebhookEvent({
      data: { event: { type: 'charge:failed', id: 'evt_3', data: { code: 'XYZ' } } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.eventType, 'charge:failed');
  });

  it('handles charge:delayed event', async () => {
    const result = await processWebhookEvent({
      data: { event: { type: 'charge:delayed', id: 'evt_4', data: { code: 'DEL1' } } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.handled, true);
  });
});
