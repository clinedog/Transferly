'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { transactionActivityService } = require('../services/transactionActivityService');

test('transaction activity stays scoped and preserves unknown/reconciliation states', async () => {
  let received;
  const result = await transactionActivityService.listUserActivity({
    userId: 'user-1', query: 'trx', kind: '', status: '', limit: 20,
    repository: { async listForUser(userId, options) { received = { userId, options }; return [{ id: 'funding-1', status: 'UNDER_REVIEW', reconciliationState: 'RECONCILIATION_REQUIRED' }]; } }
  });
  assert.equal(received.userId, 'user-1');
  assert.equal(received.options.query, 'trx');
  assert.equal(result.data[0].reconciliationState, 'RECONCILIATION_REQUIRED');
});

test('transaction activity detail rejects missing user-scoped records', async () => {
  await assert.rejects(
    () => transactionActivityService.getUserActivityDetail({
      userId: 'user-1',
      activityId: 'missing',
      repository: { async findForUser() { return null; } }
    }),
    (error) => error.code === 'TRANSACTION_ACTIVITY_NOT_FOUND' && error.statusCode === 404
  );
});
