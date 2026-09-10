'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { compareTransaction, normalizeProviderStatus, DISCREPANCY_TYPES } = require('../core/financial/reconciliation');
describe('Reconciliation Module', () => {
  test('compareTransaction returns MATCH', () => {
    const r = compareTransaction({ id: 'tx-1', amountMinor: 1000, currency: 'USD', status: 'success' }, { id: 'le-1', amountCents: 1000, currencyCode: 'USD', status: 'SUCCEEDED' });
    assert.strictEqual(r.status, DISCREPANCY_TYPES.MATCH);
  });
  test('compareTransaction detects amount mismatch', () => {
    const r = compareTransaction({ id: 'tx-1', amountMinor: 1000, currency: 'USD', status: 'success' }, { id: 'le-1', amountCents: 900, currencyCode: 'USD', status: 'SUCCEEDED' });
    assert.notStrictEqual(r.status, DISCREPANCY_TYPES.MATCH);
  });
  test('normalizeProviderStatus handles various formats', () => {
    assert.strictEqual(normalizeProviderStatus('SUCCESS'), 'SUCCEEDED');
    assert.strictEqual(normalizeProviderStatus('FAILED'), 'FAILED');
    assert.strictEqual(normalizeProviderStatus('PENDING'), 'PROCESSING');
  });
});
