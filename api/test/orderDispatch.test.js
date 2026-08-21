const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  buildOrderDispatchIdentity,
  getOrderDispatchGeneration,
  isCurrentOrderDispatch
} = require('../utils/orderDispatch');

describe('order dispatch identity', () => {
  test('builds a BullMQ-safe identity for the current retry generation', () => {
    const identity = buildOrderDispatchIdentity({
      id: 'order-123',
      metadata: {
        dispatchGeneration: 4
      }
    });

    assert.deepEqual(identity, {
      dispatchGeneration: 4,
      correlationId: 'q-17-order-correlation-9-order-123-8-dispatch-1-4',
      jobId: 'q-5-order-9-order-123-8-dispatch-1-4',
      payload: {
        orderId: 'order-123',
        dispatchGeneration: 4,
        attempt: 1,
        correlationId: 'q-17-order-correlation-9-order-123-8-dispatch-1-4'
      }
    });
    assert.equal(identity.jobId.includes(':'), false);
    assert.equal(identity.correlationId.includes(':'), false);
  });

  test('treats legacy orders and jobs as generation one', () => {
    const legacyOrder = {
      id: 'legacy-order',
      metadata: {}
    };

    assert.equal(getOrderDispatchGeneration(legacyOrder), 1);
    assert.equal(isCurrentOrderDispatch(legacyOrder, undefined), true);
    assert.equal(isCurrentOrderDispatch({ metadata: { dispatchGeneration: 2 } }, undefined), false);
  });
});
