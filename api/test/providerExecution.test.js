'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertProviderOperationReady,
  executeProviderOperation
} = require('../core/financial/providerExecution');

function provider({ configured = true, status = 'live', createPayout = async (input) => input } = {}) {
  return {
    createPayout,
    getAdapterContract() {
      return {
        provider: 'test-provider',
        configured,
        missing_env: configured ? [] : ['TEST_PROVIDER_KEY'],
        operations: {
          createPayout: { status }
        }
      };
    }
  };
}

test('allows live mutating operations in production and delegates input', async () => {
  const input = { amount: 1250, currency: 'USD' };
  assert.deepEqual(
    await executeProviderOperation(provider(), 'createPayout', input),
    input
  );
});

test('allows sandbox mutating operations outside production only', () => {
  assert.equal(
    assertProviderOperationReady(provider({ status: 'sandbox' }), 'createPayout', {
      environment: 'test'
    }).status,
    'sandbox'
  );
  assert.throws(
    () => assertProviderOperationReady(provider({ status: 'sandbox' }), 'createPayout'),
    { code: 'PAYMENT_PROVIDER_ENVIRONMENT_MISMATCH' }
  );
});

test('fails closed when credentials or operation readiness is missing', () => {
  assert.throws(
    () => assertProviderOperationReady(provider({ configured: false }), 'createPayout'),
    { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' }
  );
  assert.throws(
    () => assertProviderOperationReady(provider({ status: 'preview' }), 'createPayout'),
    { code: 'PAYMENT_PROVIDER_OPERATION_NOT_READY' }
  );
});

test('rejects undeclared operations instead of invoking provider methods', () => {
  assert.throws(
    () => assertProviderOperationReady(provider(), 'createRefund'),
    { code: 'PAYMENT_PROVIDER_OPERATION_UNDECLARED' }
  );
});
