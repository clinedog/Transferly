import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendedActions } from '../src/lib/operationalActions.js';

test('buildRecommendedActions prioritizes open issues and pending orders', () => {
  const actions = buildRecommendedActions({
    paymentIssues: [{ id: 'issue-1' }, { id: 'issue-2' }],
    topUpOrders: [{ status: 'processing' }, { status: 'completed' }]
  });

  assert.deepEqual(actions.map((action) => action.title), [
    'Review 2 alerts',
    'Clear 1 pending order',
    'Buy points'
  ]);
});

test('buildRecommendedActions keeps the healthy home flow lightweight', () => {
  const actions = buildRecommendedActions({
    paymentIssues: [],
    topUpOrders: [{ status: 'completed' }, { status: 'released' }]
  });

  assert.deepEqual(actions.map((action) => action.title), [
    'Open support desk',
    'Buy points'
  ]);
});
