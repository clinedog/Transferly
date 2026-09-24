'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OPERATION_STATE,
  assertTransition,
  canTransition,
  transitionState
} = require('../core/financial/operationStateMachine');

test('models timeout uncertainty as UNKNOWN then RECONCILING', () => {
  assert.equal(canTransition(OPERATION_STATE.PROCESSING, OPERATION_STATE.UNKNOWN), true);
  assert.equal(canTransition(OPERATION_STATE.UNKNOWN, OPERATION_STATE.RECONCILING), true);
  assert.equal(canTransition(OPERATION_STATE.RECONCILING, OPERATION_STATE.SUCCEEDED), true);

  const transition = transitionState({
    state: OPERATION_STATE.UNKNOWN,
    nextState: OPERATION_STATE.RECONCILING,
    actorId: 'recovery-worker',
    reason: 'provider timeout'
  });

  assert.equal(transition.requiresReconciliation, true);
  assert.equal(transition.actorId, 'recovery-worker');
});

test('rejects direct success from an unknown provider outcome', () => {
  assert.equal(canTransition(OPERATION_STATE.UNKNOWN, OPERATION_STATE.SUCCEEDED), false);
  assert.throws(
    () => assertTransition(OPERATION_STATE.UNKNOWN, OPERATION_STATE.SUCCEEDED),
    (error) => error.code === 'FINANCIAL_OPERATION_STATE_TRANSITION_INVALID'
  );
});

test('records terminal and refund transitions explicitly', () => {
  const success = transitionState({
    state: OPERATION_STATE.PROCESSING,
    nextState: OPERATION_STATE.SUCCEEDED
  });
  const refund = transitionState({
    state: OPERATION_STATE.SUCCEEDED,
    nextState: OPERATION_STATE.PARTIALLY_REFUNDED
  });

  assert.equal(success.terminal, true);
  assert.equal(refund.terminal, false);
});
