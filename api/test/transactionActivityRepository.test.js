'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { transactionActivityRepository } = require('../repositories/transactionActivityRepository');

test('transaction activity repository includes invoice and payout sources with provider references', async () => {
  let query;
  let params;
  const records = await transactionActivityRepository.listForUser(
    'user-1',
    {
      kind: 'payout',
      query: 'batch',
      status: 'PENDING',
      provider: 'paypal',
      currency: 'USD',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.999Z',
      limit: 25
    },
    {
      async all(sql, values) {
        query = sql;
        params = values;
        return [{
          id: 'payout-1',
          kind: 'payout',
          reference: 'batch-1',
          provider: 'paypal',
          provider_reference: 'paypal-item-1',
          operation: 'payout',
          status: 'PENDING',
          amount_minor: 12500,
          currency: 'USD',
          created_at: '2026-09-23T00:00:00.000Z',
          reconciliation_state: 'NOT_APPLICABLE'
        }];
      }
    }
  );

  assert.match(query, /'invoice' AS kind/);
  assert.match(query, /'payout' AS kind/);
  assert.equal(params[0], 'user-1');
  assert.equal(params[1], 'payout');
  assert.equal(params[2], 'PENDING');
  assert.equal(params[3], 'paypal');
  assert.equal(params[4], 'USD');
  assert.equal(params[5], '2026-09-01T00:00:00.000Z');
  assert.equal(params[6], '2026-09-30T23:59:59.999Z');
  assert.equal(records[0].reference, 'batch-1');
  assert.equal(records[0].providerReference, 'paypal-item-1');
  assert.equal(records[0].amountMinor, 12500);
});

test('transaction activity detail returns sanitized timeline and related records', async () => {
  const calls = [];
  const detail = await transactionActivityRepository.findForUser('user-1', 'payout-1', {
    async get(sql, values) {
      calls.push({ sql, values });
      return {
        id: 'payout-1', user_id: 'user-1', entity_type: 'payout', kind: 'payout', reference: 'batch-1',
        provider_reference: 'paypal-item-1', provider: 'paypal', operation: 'payout', status: 'PENDING',
        amount_minor: 12500, currency: 'USD', created_at: '2026-09-23T00:00:00.000Z', reconciliation_state: 'NOT_APPLICABLE'
      };
    },
    async all(sql) {
      calls.push({ sql });
      if (sql.includes('FROM audit_logs')) return [{ id: 'audit-1', action: 'payout.created', actor_type: 'user', created_at: '2026-09-23T00:01:00.000Z' }];
      if (sql.includes('provider_operation_inbox')) return [{ id: 'inbox-1', source: 'webhook', provider: 'paypal', status: 'SUCCESS', provider_reference: 'paypal-item-1', created_at: '2026-09-23T00:02:00.000Z' }];
      if (sql.includes('webhook_events')) return [{ id: 'webhook-1', event_id: 'paypal:event-1', event_type: 'PAYOUT.SUCCESS', resource_type: 'payout', status: 'PROCESSED', processed_at: '2026-09-23T00:03:00.000Z', created_at: '2026-09-23T00:02:30.000Z' }];
      if (sql.includes('ledger_entries')) return [{ id: 'ledger-1', type: 'payout_hold', reference_type: 'payout', reference_id: 'payout-1', amount_cents: 12500, currency_code: 'USD', created_at: '2026-09-23T00:01:30.000Z' }];
      return [{ id: 'points-1', type: 'debit', reference_type: 'payout', reference_id: 'payout-1', points: 10, created_at: '2026-09-23T00:01:45.000Z' }];
    }
  });

  assert.equal(calls[0].values[0], 'user-1');
  assert.equal(detail.webhookHistory[0].eventId, 'paypal:event-1');
  assert.equal(detail.timeline.length, 4);
  assert.equal(detail.relatedTransactions.length, 2);
  assert.equal(detail.timeline[1].action, 'payout.created');
  assert.equal(detail.timeline[2].providerReference, 'paypal-item-1');
});
