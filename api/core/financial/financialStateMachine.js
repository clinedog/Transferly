const {
  INVOICE_STATUS,
  ORDER_STATUS,
  PAYOUT_STATUS,
  POINTS_FUNDING_STATUS,
  POINT_RESERVATION_STATUS,
  TOP_UP_ORDER_STATUS
} = require('../../utils/constants');
const { AppError } = require('../../utils/errors');

const FINANCIAL_WORKFLOW = Object.freeze({
  SERVICE_ORDER: 'service_order',
  TOP_UP_ORDER: 'top_up_order',
  POINTS_FUNDING: 'points_funding',
  INVOICE: 'invoice',
  PAYOUT: 'payout',
  POINT_RESERVATION: 'point_reservation'
});

const FINANCIAL_STATE_MACHINES = Object.freeze({
  [FINANCIAL_WORKFLOW.SERVICE_ORDER]: Object.freeze({
    initial: ORDER_STATUS.DRAFT,
    terminal: Object.freeze([
      ORDER_STATUS.CANCELLED,
      ORDER_STATUS.EXPIRED,
      ORDER_STATUS.REFUNDED,
      ORDER_STATUS.VALIDATION_FAILED,
      ORDER_STATUS.INSUFFICIENT_POINTS
    ]),
    success: Object.freeze([ORDER_STATUS.COMPLETED]),
    approvalRequired: Object.freeze([ORDER_STATUS.MANUAL_REVIEW]),
    userActionRequired: Object.freeze([]),
    transitions: Object.freeze({
      [ORDER_STATUS.DRAFT]: Object.freeze([ORDER_STATUS.VALIDATING, ORDER_STATUS.CANCELLED]),
      [ORDER_STATUS.VALIDATING]: Object.freeze([
        ORDER_STATUS.PREFLIGHT,
        ORDER_STATUS.VALIDATION_FAILED,
        ORDER_STATUS.INSUFFICIENT_POINTS
      ]),
      [ORDER_STATUS.PREFLIGHT]: Object.freeze([
        ORDER_STATUS.POINTS_RESERVED,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.INSUFFICIENT_POINTS
      ]),
      [ORDER_STATUS.POINTS_RESERVED]: Object.freeze([
        ORDER_STATUS.QUEUED,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.EXPIRED
      ]),
      [ORDER_STATUS.QUEUED]: Object.freeze([
        ORDER_STATUS.PROCESSING,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.FAILED,
        ORDER_STATUS.EXPIRED
      ]),
      [ORDER_STATUS.PROCESSING]: Object.freeze([
        ORDER_STATUS.COMPLETED,
        ORDER_STATUS.FAILED,
        ORDER_STATUS.MANUAL_REVIEW
      ]),
      [ORDER_STATUS.MANUAL_REVIEW]: Object.freeze([
        ORDER_STATUS.QUEUED,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.REFUNDED
      ]),
      [ORDER_STATUS.FAILED]: Object.freeze([ORDER_STATUS.QUEUED, ORDER_STATUS.REFUNDED]),
      [ORDER_STATUS.COMPLETED]: Object.freeze([ORDER_STATUS.REFUNDED]),
      [ORDER_STATUS.CANCELLED]: Object.freeze([]),
      [ORDER_STATUS.EXPIRED]: Object.freeze([]),
      [ORDER_STATUS.REFUNDED]: Object.freeze([]),
      [ORDER_STATUS.VALIDATION_FAILED]: Object.freeze([]),
      [ORDER_STATUS.INSUFFICIENT_POINTS]: Object.freeze([])
    }),
    labels: Object.freeze({
      [ORDER_STATUS.DRAFT]: 'Draft',
      [ORDER_STATUS.VALIDATING]: 'Validating',
      [ORDER_STATUS.PREFLIGHT]: 'Ready to reserve points',
      [ORDER_STATUS.POINTS_RESERVED]: 'Points reserved',
      [ORDER_STATUS.QUEUED]: 'Queued',
      [ORDER_STATUS.PROCESSING]: 'Processing',
      [ORDER_STATUS.COMPLETED]: 'Completed',
      [ORDER_STATUS.VALIDATION_FAILED]: 'Validation failed',
      [ORDER_STATUS.INSUFFICIENT_POINTS]: 'Insufficient points',
      [ORDER_STATUS.MANUAL_REVIEW]: 'Manual review',
      [ORDER_STATUS.FAILED]: 'Failed',
      [ORDER_STATUS.CANCELLED]: 'Cancelled',
      [ORDER_STATUS.EXPIRED]: 'Expired',
      [ORDER_STATUS.REFUNDED]: 'Refunded'
    })
  }),
  [FINANCIAL_WORKFLOW.TOP_UP_ORDER]: Object.freeze({
    initial: TOP_UP_ORDER_STATUS.PENDING,
    terminal: Object.freeze([TOP_UP_ORDER_STATUS.COMPLETED, TOP_UP_ORDER_STATUS.CANCELLED]),
    success: Object.freeze([TOP_UP_ORDER_STATUS.COMPLETED]),
    approvalRequired: Object.freeze([TOP_UP_ORDER_STATUS.AWAITING_CONFIRMATION]),
    userActionRequired: Object.freeze([TOP_UP_ORDER_STATUS.PENDING]),
    transitions: Object.freeze({
      [TOP_UP_ORDER_STATUS.PENDING]: Object.freeze([
        TOP_UP_ORDER_STATUS.AWAITING_CONFIRMATION,
        TOP_UP_ORDER_STATUS.COMPLETED,
        TOP_UP_ORDER_STATUS.CANCELLED
      ]),
      [TOP_UP_ORDER_STATUS.AWAITING_CONFIRMATION]: Object.freeze([
        TOP_UP_ORDER_STATUS.COMPLETED,
        TOP_UP_ORDER_STATUS.CANCELLED
      ]),
      [TOP_UP_ORDER_STATUS.COMPLETED]: Object.freeze([]),
      [TOP_UP_ORDER_STATUS.CANCELLED]: Object.freeze([])
    }),
    labels: Object.freeze({
      [TOP_UP_ORDER_STATUS.PENDING]: 'Payment instructions',
      [TOP_UP_ORDER_STATUS.AWAITING_CONFIRMATION]: 'Awaiting confirmation',
      [TOP_UP_ORDER_STATUS.COMPLETED]: 'Completed',
      [TOP_UP_ORDER_STATUS.CANCELLED]: 'Cancelled'
    })
  }),
  [FINANCIAL_WORKFLOW.POINTS_FUNDING]: Object.freeze({
    initial: POINTS_FUNDING_STATUS.DRAFT,
    terminal: Object.freeze([
      POINTS_FUNDING_STATUS.POINTS_CREDITED,
      POINTS_FUNDING_STATUS.REJECTED,
      POINTS_FUNDING_STATUS.CANCELLED
    ]),
    success: Object.freeze([POINTS_FUNDING_STATUS.POINTS_CREDITED]),
    approvalRequired: Object.freeze([
      POINTS_FUNDING_STATUS.UNDER_REVIEW,
      POINTS_FUNDING_STATUS.MANUAL_REVIEW,
      POINTS_FUNDING_STATUS.APPROVED
    ]),
    userActionRequired: Object.freeze([
      POINTS_FUNDING_STATUS.PAYMENT_INSTRUCTIONS,
      POINTS_FUNDING_STATUS.NEEDS_MORE_INFORMATION
    ]),
    transitions: Object.freeze({
      [POINTS_FUNDING_STATUS.DRAFT]: Object.freeze([
        POINTS_FUNDING_STATUS.PAYMENT_INSTRUCTIONS,
        POINTS_FUNDING_STATUS.CANCELLED
      ]),
      [POINTS_FUNDING_STATUS.PAYMENT_INSTRUCTIONS]: Object.freeze([
        POINTS_FUNDING_STATUS.PAYMENT_REPORTED,
        POINTS_FUNDING_STATUS.CANCELLED
      ]),
      [POINTS_FUNDING_STATUS.PAYMENT_REPORTED]: Object.freeze([
        POINTS_FUNDING_STATUS.UNDER_REVIEW,
        POINTS_FUNDING_STATUS.NEEDS_MORE_INFORMATION,
        POINTS_FUNDING_STATUS.REJECTED,
        POINTS_FUNDING_STATUS.CANCELLED,
        POINTS_FUNDING_STATUS.MANUAL_REVIEW
      ]),
      [POINTS_FUNDING_STATUS.UNDER_REVIEW]: Object.freeze([
        POINTS_FUNDING_STATUS.APPROVED,
        POINTS_FUNDING_STATUS.POINTS_CREDITED,
        POINTS_FUNDING_STATUS.NEEDS_MORE_INFORMATION,
        POINTS_FUNDING_STATUS.REJECTED,
        POINTS_FUNDING_STATUS.CANCELLED,
        POINTS_FUNDING_STATUS.MANUAL_REVIEW
      ]),
      [POINTS_FUNDING_STATUS.APPROVED]: Object.freeze([POINTS_FUNDING_STATUS.POINTS_CREDITED]),
      [POINTS_FUNDING_STATUS.NEEDS_MORE_INFORMATION]: Object.freeze([
        POINTS_FUNDING_STATUS.PAYMENT_REPORTED,
        POINTS_FUNDING_STATUS.CANCELLED
      ]),
      [POINTS_FUNDING_STATUS.MANUAL_REVIEW]: Object.freeze([
        POINTS_FUNDING_STATUS.UNDER_REVIEW,
        POINTS_FUNDING_STATUS.POINTS_CREDITED,
        POINTS_FUNDING_STATUS.NEEDS_MORE_INFORMATION,
        POINTS_FUNDING_STATUS.REJECTED,
        POINTS_FUNDING_STATUS.CANCELLED
      ]),
      [POINTS_FUNDING_STATUS.POINTS_CREDITED]: Object.freeze([]),
      [POINTS_FUNDING_STATUS.REJECTED]: Object.freeze([]),
      [POINTS_FUNDING_STATUS.CANCELLED]: Object.freeze([])
    }),
    labels: Object.freeze({
      [POINTS_FUNDING_STATUS.DRAFT]: 'Draft',
      [POINTS_FUNDING_STATUS.PAYMENT_INSTRUCTIONS]: 'Payment instructions',
      [POINTS_FUNDING_STATUS.PAYMENT_REPORTED]: 'Payment reported',
      [POINTS_FUNDING_STATUS.UNDER_REVIEW]: 'Under review',
      [POINTS_FUNDING_STATUS.APPROVED]: 'Approved',
      [POINTS_FUNDING_STATUS.POINTS_CREDITED]: 'Points credited',
      [POINTS_FUNDING_STATUS.REJECTED]: 'Rejected',
      [POINTS_FUNDING_STATUS.NEEDS_MORE_INFORMATION]: 'Needs more information',
      [POINTS_FUNDING_STATUS.CANCELLED]: 'Cancelled',
      [POINTS_FUNDING_STATUS.MANUAL_REVIEW]: 'Manual review'
    })
  }),
  [FINANCIAL_WORKFLOW.INVOICE]: Object.freeze({
    initial: INVOICE_STATUS.DRAFT,
    terminal: Object.freeze([
      INVOICE_STATUS.CANCELLED,
      INVOICE_STATUS.REFUNDED,
      INVOICE_STATUS.FAILED
    ]),
    success: Object.freeze([INVOICE_STATUS.PAID]),
    approvalRequired: Object.freeze([]),
    userActionRequired: Object.freeze([]),
    transitions: Object.freeze({
      [INVOICE_STATUS.DRAFT]: Object.freeze([
        INVOICE_STATUS.SCHEDULED,
        INVOICE_STATUS.SENT,
        INVOICE_STATUS.CANCELLED,
        INVOICE_STATUS.FAILED
      ]),
      [INVOICE_STATUS.SCHEDULED]: Object.freeze([
        INVOICE_STATUS.SENT,
        INVOICE_STATUS.CANCELLED,
        INVOICE_STATUS.FAILED
      ]),
      [INVOICE_STATUS.SENT]: Object.freeze([
        INVOICE_STATUS.UPDATED,
        INVOICE_STATUS.PAID,
        INVOICE_STATUS.CANCELLED,
        INVOICE_STATUS.FAILED
      ]),
      [INVOICE_STATUS.UPDATED]: Object.freeze([
        INVOICE_STATUS.SENT,
        INVOICE_STATUS.PAID,
        INVOICE_STATUS.CANCELLED,
        INVOICE_STATUS.FAILED,
        INVOICE_STATUS.REFUNDED
      ]),
      [INVOICE_STATUS.PAID]: Object.freeze([INVOICE_STATUS.REFUNDED]),
      [INVOICE_STATUS.CANCELLED]: Object.freeze([INVOICE_STATUS.PAID, INVOICE_STATUS.REFUNDED]),
      [INVOICE_STATUS.REFUNDED]: Object.freeze([]),
      [INVOICE_STATUS.FAILED]: Object.freeze([])
    }),
    labels: Object.freeze({
      [INVOICE_STATUS.DRAFT]: 'Draft',
      [INVOICE_STATUS.SCHEDULED]: 'Scheduled',
      [INVOICE_STATUS.SENT]: 'Sent',
      [INVOICE_STATUS.PAID]: 'Paid',
      [INVOICE_STATUS.CANCELLED]: 'Cancelled',
      [INVOICE_STATUS.REFUNDED]: 'Refunded',
      [INVOICE_STATUS.UPDATED]: 'Updated',
      [INVOICE_STATUS.FAILED]: 'Failed'
    })
  }),
  [FINANCIAL_WORKFLOW.PAYOUT]: Object.freeze({
    initial: PAYOUT_STATUS.PENDING_APPROVAL,
    terminal: Object.freeze([
      PAYOUT_STATUS.SUCCESS,
      PAYOUT_STATUS.FAILED,
      PAYOUT_STATUS.DENIED,
      PAYOUT_STATUS.REJECTED
    ]),
    success: Object.freeze([PAYOUT_STATUS.SUCCESS]),
    approvalRequired: Object.freeze([PAYOUT_STATUS.PENDING_APPROVAL, PAYOUT_STATUS.ON_HOLD]),
    userActionRequired: Object.freeze([]),
    transitions: Object.freeze({
      [PAYOUT_STATUS.PENDING_APPROVAL]: Object.freeze([
        PAYOUT_STATUS.QUEUED,
        PAYOUT_STATUS.REJECTED,
        PAYOUT_STATUS.DENIED,
        PAYOUT_STATUS.ON_HOLD
      ]),
      [PAYOUT_STATUS.ON_HOLD]: Object.freeze([
        PAYOUT_STATUS.PENDING_APPROVAL,
        PAYOUT_STATUS.REJECTED,
        PAYOUT_STATUS.DENIED
      ]),
      [PAYOUT_STATUS.QUEUED]: Object.freeze([
        PAYOUT_STATUS.PROCESSING,
        PAYOUT_STATUS.PENDING,
        PAYOUT_STATUS.SUCCESS,
        PAYOUT_STATUS.FAILED,
        PAYOUT_STATUS.DENIED
      ]),
      [PAYOUT_STATUS.PROCESSING]: Object.freeze([
        PAYOUT_STATUS.PENDING,
        PAYOUT_STATUS.SUCCESS,
        PAYOUT_STATUS.FAILED,
        PAYOUT_STATUS.DENIED
      ]),
      [PAYOUT_STATUS.PENDING]: Object.freeze([
        PAYOUT_STATUS.PROCESSING,
        PAYOUT_STATUS.SUCCESS,
        PAYOUT_STATUS.FAILED,
        PAYOUT_STATUS.DENIED
      ]),
      [PAYOUT_STATUS.SUCCESS]: Object.freeze([]),
      [PAYOUT_STATUS.FAILED]: Object.freeze([]),
      [PAYOUT_STATUS.DENIED]: Object.freeze([]),
      [PAYOUT_STATUS.REJECTED]: Object.freeze([])
    }),
    labels: Object.freeze({
      [PAYOUT_STATUS.PENDING_APPROVAL]: 'Pending approval',
      [PAYOUT_STATUS.QUEUED]: 'Queued',
      [PAYOUT_STATUS.PROCESSING]: 'Processing',
      [PAYOUT_STATUS.SUCCESS]: 'Successful',
      [PAYOUT_STATUS.FAILED]: 'Failed',
      [PAYOUT_STATUS.PENDING]: 'Pending provider confirmation',
      [PAYOUT_STATUS.DENIED]: 'Denied',
      [PAYOUT_STATUS.REJECTED]: 'Rejected',
      [PAYOUT_STATUS.ON_HOLD]: 'On hold'
    })
  }),
  [FINANCIAL_WORKFLOW.POINT_RESERVATION]: Object.freeze({
    initial: POINT_RESERVATION_STATUS.RESERVED,
    terminal: Object.freeze([
      POINT_RESERVATION_STATUS.COMMITTED,
      POINT_RESERVATION_STATUS.RELEASED,
      POINT_RESERVATION_STATUS.EXPIRED
    ]),
    success: Object.freeze([POINT_RESERVATION_STATUS.COMMITTED]),
    approvalRequired: Object.freeze([]),
    userActionRequired: Object.freeze([]),
    transitions: Object.freeze({
      [POINT_RESERVATION_STATUS.RESERVED]: Object.freeze([
        POINT_RESERVATION_STATUS.COMMITTED,
        POINT_RESERVATION_STATUS.RELEASED,
        POINT_RESERVATION_STATUS.EXPIRED
      ]),
      [POINT_RESERVATION_STATUS.COMMITTED]: Object.freeze([]),
      [POINT_RESERVATION_STATUS.RELEASED]: Object.freeze([]),
      [POINT_RESERVATION_STATUS.EXPIRED]: Object.freeze([])
    }),
    labels: Object.freeze({
      [POINT_RESERVATION_STATUS.RESERVED]: 'Reserved',
      [POINT_RESERVATION_STATUS.COMMITTED]: 'Committed',
      [POINT_RESERVATION_STATUS.RELEASED]: 'Released',
      [POINT_RESERVATION_STATUS.EXPIRED]: 'Expired'
    })
  })
});

function getStateMachine(workflow) {
  const machine = FINANCIAL_STATE_MACHINES[workflow];
  if (!machine) {
    throw new AppError(500, 'FINANCIAL_WORKFLOW_UNKNOWN', `Unknown financial workflow: ${workflow}.`);
  }
  return machine;
}

function listWorkflowStatuses(workflow) {
  const machine = getStateMachine(workflow);
  return Object.freeze(Object.keys(machine.transitions));
}

function listAllowedTransitions(workflow, status) {
  const machine = getStateMachine(workflow);
  return machine.transitions[status] || Object.freeze([]);
}

function isKnownStatus(workflow, status) {
  return Object.prototype.hasOwnProperty.call(getStateMachine(workflow).transitions, status);
}

function isTerminalStatus(workflow, status) {
  return getStateMachine(workflow).terminal.includes(status);
}

function isSuccessStatus(workflow, status) {
  return getStateMachine(workflow).success.includes(status);
}

function requiresHumanApproval(workflow, status) {
  return getStateMachine(workflow).approvalRequired.includes(status);
}

function requiresUserAction(workflow, status) {
  return getStateMachine(workflow).userActionRequired.includes(status);
}

function canTransition(workflow, previousStatus, nextStatus) {
  return listAllowedTransitions(workflow, previousStatus).includes(nextStatus);
}

function assertKnownStatus(workflow, status) {
  if (!isKnownStatus(workflow, status)) {
    throw new AppError(
      409,
      'FINANCIAL_STATE_UNKNOWN',
      `Unknown ${workflow} status: ${status}.`
    );
  }
}

function assertTransition({ workflow, previousStatus, nextStatus, errorCode, message }) {
  assertKnownStatus(workflow, previousStatus);
  assertKnownStatus(workflow, nextStatus);

  if (!canTransition(workflow, previousStatus, nextStatus)) {
    throw new AppError(
      409,
      errorCode || 'FINANCIAL_STATE_TRANSITION_INVALID',
      message || `Cannot transition ${workflow} from ${previousStatus} to ${nextStatus}.`,
      {
        workflow,
        previousStatus,
        nextStatus,
        allowedTransitions: listAllowedTransitions(workflow, previousStatus)
      }
    );
  }
}

function describeStatus(workflow, status) {
  const machine = getStateMachine(workflow);
  assertKnownStatus(workflow, status);
  return {
    workflow,
    status,
    label: machine.labels[status] || status,
    terminal: isTerminalStatus(workflow, status),
    success: isSuccessStatus(workflow, status),
    requires_human_approval: requiresHumanApproval(workflow, status),
    requires_user_action: requiresUserAction(workflow, status),
    allowed_transitions: listAllowedTransitions(workflow, status)
  };
}

module.exports = {
  FINANCIAL_STATE_MACHINES,
  FINANCIAL_WORKFLOW,
  assertKnownStatus,
  assertTransition,
  canTransition,
  describeStatus,
  getStateMachine,
  isKnownStatus,
  isSuccessStatus,
  isTerminalStatus,
  listAllowedTransitions,
  listWorkflowStatuses,
  requiresHumanApproval,
  requiresUserAction
};
