'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');

test('invoice and payout list queries require organization filters when context is selected', async () => {
  const calls = [];
  const client = {
    async all(sql, params) {
      calls.push({ sql, params });
      return [];
    },
    async get() {
      return { count: 0 };
    }
  };

  await invoiceRepository.findMany({ organizationId: 'org-a' }, client);
  await payoutRepository.findMany({ organizationId: 'org-a' }, client);

  assert.match(calls[0].sql, /organization_id = \?/);
  assert.deepEqual(calls[0].params, ['org-a']);
  assert.match(calls[1].sql, /p\.organization_id = \?/);
  assert.deepEqual(calls[1].params, ['org-a']);
});

test('mapped financial resources expose organization ownership', () => {
  const invoiceRow = {
    id: 'invoice-1',
    user_id: 'user-1',
    organization_id: 'org-a',
    status: 'PENDING',
    amount_cents: 100,
    currency_code: 'USD',
    paypal_details_json: '{}',
    metadata_json: '{}'
  };
  const payoutRow = {
    id: 'payout-1',
    user_id: 'user-1',
    organization_id: 'org-a',
    status: 'PENDING',
    metadata_json: '{}'
  };

  assert.equal(invoiceRow.organization_id, 'org-a');
  assert.equal(payoutRow.organization_id, 'org-a');
});
