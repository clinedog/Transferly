'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OPERATION_CONTEXT_VERSION,
  createExecutionResult,
  createOperationContext
} = require('../core/financial/operationContext');

test('creates a normalized operation context for a financial request', () => {
  const context = createOperationContext({
    transactionType: 'invoice',
    actorId: 'user-1',
    idempotencyKey: 'invoice:user-1:1',
    provider: 'PayPal',
    metadata: { source: 'miniapp' }
  });

  assert.equal(context.version, OPERATION_CONTEXT_VERSION);
  assert.equal(context.transactionType, 'invoice_payment');
  assert.equal(context.operation, 'invoices');
  assert.equal(context.provider, 'paypal');
  assert.equal(context.metadata.source, 'miniapp');
});

test('rejects operation contexts without an idempotency key', () => {
  assert.throws(
    () => createOperationContext({ transactionType: 'payout', actorId: 'user-1' }),
    (error) => error.code === 'FINANCIAL_OPERATION_CONTEXT_INVALID'
  );
});

test('preserves non-authoritative provider outcomes for reconciliation', () => {
  const context = createOperationContext({
    transactionType: 'payout',
    actorId: 'user-1',
    idempotencyKey: 'payout:user-1:1'
  });

  const result = createExecutionResult(context, {
    status: 'unknown',
    authoritative: false,
    reconciliationRequired: true,
    providerRequestId: 'provider-request-1'
  });

  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.authoritative, false);
  assert.equal(result.reconciliationRequired, true);
  assert.equal(result.providerRequestId, 'provider-request-1');
});
