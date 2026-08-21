'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const PayPalService = require('../service');
const PayPalProvider = require('../provider');

describe('PayPalService', () => {
  it('listTransactions returns an object', async () => {
    const svc = new PayPalService({ config: {} });
    const res = await svc.listTransactions();
    assert.ok(res !== undefined);
  });

  it('getBalance returns without throwing', async () => {
    const svc = new PayPalService({ config: {} });
    const res = await svc.getBalance();
    assert.ok(res === null || typeof res === 'object');
  });
});

describe('PayPalProvider', () => {
  it('constructs with id paypal', () => {
    const p = new PayPalProvider();
    assert.equal(p.id, 'paypal');
    assert.equal(p.name, 'PayPal');
  });

  it('getHealth returns provider and configured fields', async () => {
    const p = new PayPalProvider();
    const health = await p.getHealth();
    assert.equal(health.provider, 'paypal');
    assert.ok('configured' in health);
    assert.ok('environment' in health);
  });

  it('createClient returns an object', () => {
    const p = new PayPalProvider({ config: { clientId: 'x', clientSecret: 'y', environment: 'sandbox' } });
    const client = p.createClient();
    assert.equal(typeof client, 'object');
  });
});
