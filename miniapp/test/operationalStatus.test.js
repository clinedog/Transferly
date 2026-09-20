import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOperationalStatus, countPendingOrders } from '../src/lib/operationalStatus.js';

test('countPendingOrders ignores completed and successful statuses', () => {
  assert.equal(
    countPendingOrders([
      { status: 'completed' },
      { status: 'released' },
      { status: 'processing' },
      { status: 'PAYMENT_INSTRUCTIONS' },
      { status: 'failed' }
    ]),
    3
  );
});

test('summarizeOperationalStatus highlights follow-up work when alerts or orders remain open', () => {
  const summary = summarizeOperationalStatus({
    paymentIssues: [{ id: 'issue-1' }],
    topUpOrders: [{ status: 'processing' }, { status: 'completed' }]
  });

  assert.equal(summary.label, 'Needs attention');
  assert.equal(summary.tone, 'amber');
  assert.match(summary.detail, /1 issue.*1 order/);
});

test('summarizeOperationalStatus stays healthy when no follow-up work remains', () => {
  const summary = summarizeOperationalStatus({
    paymentIssues: [],
    topUpOrders: [{ status: 'completed' }, { status: 'released' }]
  });

  assert.equal(summary.label, 'Operationally stable');
  assert.equal(summary.tone, 'emerald');
  assert.equal(summary.detail, 'No blocking alerts or order follow-ups');
});
