const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  FINANCIAL_STATE_MACHINES,
  FINANCIAL_WORKFLOW,
  assertTransition,
  canTransition,
  describeStatus,
  isTerminalStatus,
  listAllowedTransitions,
  listWorkflowStatuses,
  requiresHumanApproval,
  requiresUserAction
} = require('../core/financial/financialStateMachine');
const {
  INVOICE_STATUS,
  ORDER_STATUS,
  PAYOUT_STATUS,
  POINTS_FUNDING_STATUS,
  TOP_UP_ORDER_STATUS
} = require('../utils/constants');

test('financial state machines expose every workflow status through a known descriptor', () => {
  for (const workflow of Object.values(FINANCIAL_WORKFLOW)) {
    const statuses = listWorkflowStatuses(workflow);
    assert.ok(statuses.length > 0, `${workflow} should define statuses`);

    for (const status of statuses) {
      const description = describeStatus(workflow, status);
      assert.equal(description.workflow, workflow);
      assert.equal(description.status, status);
      assert.equal(typeof description.label, 'string');
      assert.ok(Array.isArray(description.allowed_transitions));
    }
  }
});

test('service order transitions use the shared financial state machine contract', () => {
  assert.equal(canTransition(FINANCIAL_WORKFLOW.SERVICE_ORDER, ORDER_STATUS.DRAFT, ORDER_STATUS.VALIDATING), true);
  assert.equal(canTransition(FINANCIAL_WORKFLOW.SERVICE_ORDER, ORDER_STATUS.PROCESSING, ORDER_STATUS.COMPLETED), true);
  assert.equal(canTransition(FINANCIAL_WORKFLOW.SERVICE_ORDER, ORDER_STATUS.COMPLETED, ORDER_STATUS.QUEUED), false);
  assert.equal(isTerminalStatus(FINANCIAL_WORKFLOW.SERVICE_ORDER, ORDER_STATUS.CANCELLED), true);

  assert.throws(
    () => assertTransition({
      workflow: FINANCIAL_WORKFLOW.SERVICE_ORDER,
      previousStatus: ORDER_STATUS.COMPLETED,
      nextStatus: ORDER_STATUS.QUEUED,
      errorCode: 'ORDER_STATE_TRANSITION_INVALID'
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'ORDER_STATE_TRANSITION_INVALID');
      assert.deepEqual(error.details.allowedTransitions, [ORDER_STATUS.REFUNDED]);
      return true;
    }
  );
});

test('funding and top-up states distinguish user action from finance approval', () => {
  assert.equal(
    requiresUserAction(FINANCIAL_WORKFLOW.POINTS_FUNDING, POINTS_FUNDING_STATUS.PAYMENT_INSTRUCTIONS),
    true
  );
  assert.equal(
    requiresHumanApproval(FINANCIAL_WORKFLOW.POINTS_FUNDING, POINTS_FUNDING_STATUS.UNDER_REVIEW),
    true
  );
  assert.equal(
    canTransition(
      FINANCIAL_WORKFLOW.POINTS_FUNDING,
      POINTS_FUNDING_STATUS.PAYMENT_REPORTED,
      POINTS_FUNDING_STATUS.POINTS_CREDITED
    ),
    false
  );
  assert.equal(
    canTransition(
      FINANCIAL_WORKFLOW.TOP_UP_ORDER,
      TOP_UP_ORDER_STATUS.AWAITING_CONFIRMATION,
      TOP_UP_ORDER_STATUS.COMPLETED
    ),
    true
  );
});

test('invoice and payout terminal states are explicit and conservative', () => {
  assert.equal(isTerminalStatus(FINANCIAL_WORKFLOW.PAYOUT, PAYOUT_STATUS.SUCCESS), true);
  assert.deepEqual(listAllowedTransitions(FINANCIAL_WORKFLOW.PAYOUT, PAYOUT_STATUS.SUCCESS), []);
  assert.equal(
    canTransition(FINANCIAL_WORKFLOW.PAYOUT, PAYOUT_STATUS.PENDING_APPROVAL, PAYOUT_STATUS.SUCCESS),
    false
  );

  assert.equal(isTerminalStatus(FINANCIAL_WORKFLOW.INVOICE, INVOICE_STATUS.REFUNDED), true);
  assert.deepEqual(listAllowedTransitions(FINANCIAL_WORKFLOW.INVOICE, INVOICE_STATUS.REFUNDED), []);
  assert.equal(canTransition(FINANCIAL_WORKFLOW.INVOICE, INVOICE_STATUS.PAID, INVOICE_STATUS.REFUNDED), true);
});

test('all declared terminal statuses are known statuses with no hidden descriptor gaps', () => {
  for (const [workflow, machine] of Object.entries(FINANCIAL_STATE_MACHINES)) {
    for (const terminalStatus of machine.terminal) {
      assert.ok(
        listWorkflowStatuses(workflow).includes(terminalStatus),
        `${workflow} terminal status ${terminalStatus} should be known`
      );
      assert.equal(describeStatus(workflow, terminalStatus).terminal, true);
    }
  }
});
