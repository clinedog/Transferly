'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createOperationContext } = require('../core/financial/operationContext');
const { executeFinancialOperation } = require('../core/financial/financialExecutionService');

function context(hash = 'hash-1') {
  return createOperationContext({
    transactionType: 'payout',
    actorId: 'user-1',
    idempotencyKey: 'payout-1',
    requestHash: hash
  });
}

function repository(existing = null) {
  let record = existing;
  return {
    calls: 0,
    async findByUserOperationAndKey() {
      return record;
    },
    async create(data) {
      this.calls += 1;
      record = { id: 'idem-1', ...data };
      return record;
    },
    async updateResponse(_userId, _operation, _key, response) {
      record = { ...record, responseStatus: response.responseStatus, responsePayload: response.responsePayload };
      return record;
    }
  };
}

test('executes once and stores an authoritative result', async () => {
  const store = repository();
  let executions = 0;
  const result = await executeFinancialOperation({
    context: context(),
    idempotencyRepository: store,
    execute: async () => {
      executions += 1;
      return { status: 'succeeded', authoritative: true, resourceId: 'payout-1' };
    }
  });

  assert.equal(executions, 1);
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(store.calls, 1);
});

test('replays a completed result without executing again', async () => {
  const stored = {
    id: 'idem-1',
    requestHash: 'hash-1',
    responsePayload: { operationId: 'payout-1', status: 'SUCCEEDED' }
  };
  const store = repository(stored);
  let executions = 0;
  const result = await executeFinancialOperation({
    context: context(),
    idempotencyRepository: store,
    execute: async () => {
      executions += 1;
      return { status: 'succeeded' };
    }
  });

  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(executions, 0);
});

test('rejects reuse with a different request hash', async () => {
  const store = repository({
    id: 'idem-1',
    requestHash: 'different-hash',
    responsePayload: { status: 'SUCCEEDED' }
  });

  await assert.rejects(
    executeFinancialOperation({
      context: context(),
      idempotencyRepository: store,
      execute: async () => ({ status: 'succeeded' })
    }),
    (error) => error.code === 'FINANCIAL_IDEMPOTENCY_CONFLICT'
  );
});
