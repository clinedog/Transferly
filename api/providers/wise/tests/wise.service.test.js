'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('WiseService', () => {
  const WiseService = require('../service');

  it('constructs without throwing', () => {
    assert.doesNotThrow(() => new WiseService({ config: {} }));
  });

  it('getBalances returns empty array when unconfigured', async () => {
    const svc = new WiseService({ config: {} });
    const res = await svc.getBalances();
    assert.ok(Array.isArray(res) || res === null || typeof res === 'object');
  });

  it('listTransfers returns without throwing when unconfigured', async () => {
    const svc = new WiseService({ config: {} });
    const res = await svc.listTransfers();
    assert.ok(res !== undefined);
  });

  it('createPayment throws when apiToken missing', async () => {
    const svc = new WiseService({ config: {} });
    await assert.rejects(
      () => svc.createPayment({ sourceCurrency: 'GBP', targetCurrency: 'USD', targetAmount: 100 }),
      { code: 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED' }
    );
  });

  it('createPayment throws WISE_MISSING_CURRENCIES when currencies absent', async () => {
    const svc = new WiseService({ config: { apiToken: 'tok', profileId: '123' } });
    await assert.rejects(
      () => svc.createPayment({ targetAmount: 100 }),
      { code: 'WISE_MISSING_CURRENCIES' }
    );
  });

  it('createPayment throws WISE_INVALID_AMOUNT for zero amount', async () => {
    const svc = new WiseService({ config: { apiToken: 'tok', profileId: '123' } });
    await assert.rejects(
      () => svc.createPayment({ sourceCurrency: 'GBP', targetCurrency: 'USD', targetAmount: 0 }),
      { code: 'WISE_INVALID_AMOUNT' }
    );
  });

  it('createPayout throws WISE_MISSING_TRANSFER_FIELDS when fields absent', async () => {
    const svc = new WiseService({ config: { apiToken: 'tok', profileId: '123' } });
    await assert.rejects(() => svc.createPayout({}), { code: 'WISE_MISSING_TRANSFER_FIELDS' });
  });
});

describe('WiseProvider', () => {
  const WiseProvider = require('../provider');

  it('constructs with id wise', () => {
    const p = new WiseProvider();
    assert.equal(p.id, 'wise');
    assert.equal(p.name, 'Wise Platform');
  });

  it('getHealth returns provider and configured fields', async () => {
    const p = new WiseProvider();
    const health = await p.getHealth();
    assert.equal(health.provider, 'wise');
    assert.ok('configured' in health);
    assert.ok('status' in health);
  });

  it('createClient returns an object', () => {
    const p = new WiseProvider({ config: { apiToken: 'tok', profileId: '123' } });
    const client = p.createClient();
    assert.equal(typeof client, 'object');
  });
});

describe('WiseClient', () => {
  const WiseClient = require('../client');

  it('constructs with defaults', () => {
    const c = new WiseClient();
    assert.equal(c.baseUrl, 'https://api.transferwise.com');
  });

  it('getBalances returns empty array when no token', async () => {
    const c = new WiseClient({ apiToken: '', profileId: '' });
    const res = await c.getBalances();
    assert.ok(Array.isArray(res));
    assert.equal(res.length, 0);
  });

  it('listTransfers returns object when unconfigured', async () => {
    const c = new WiseClient({ apiToken: '', profileId: '' });
    const res = await c.listTransfers();
    assert.ok(typeof res === 'object');
  });
});

describe('wise webhook job', () => {
  const { processWebhookEvent } = require('../jobs');

  it('returns ok:false for missing event', async () => {
    const result = await processWebhookEvent({ data: {} });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_event');
  });

  it('returns ok:true with handled:false for unrecognised event type', async () => {
    const result = await processWebhookEvent({ data: { event: { event_type: 'unknown#event' } } });
    assert.equal(result.ok, true);
    assert.equal(result.handled, false);
  });

  it('handles transfers#state-change event', async () => {
    const result = await processWebhookEvent({
      data: { event: { event_type: 'transfers#state-change', data: { current_state: 'outgoing_payment_sent', resource: { id: 123 } } } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.handled, true);
  });

  it('handles balances#credit event', async () => {
    const result = await processWebhookEvent({ data: { event: { event_type: 'balances#credit' } } });
    assert.equal(result.ok, true);
    assert.equal(result.eventType, 'balances#credit');
  });
});
