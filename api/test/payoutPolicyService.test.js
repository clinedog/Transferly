'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { APPROVAL_DECISION, decidePayoutApprovalPath } = require('../services/payoutPolicyService');
const { RISK_DECISION } = require('../utils/constants');

test('automatic payout approval is opt-in and bounded by the configured minor-unit limit', () => {
  const approved = decidePayoutApprovalPath({
    riskDecision: RISK_DECISION.APPROVED,
    riskFlags: [],
    amountCents: 5000,
    currencyCode: 'USD',
    provider: 'paypal',
    policy: { autoApprovalMaxCents: 10000 }
  });
  assert.equal(approved.decision, APPROVAL_DECISION.AUTO_APPROVED);
  assert.equal(approved.autoApproved, true);

  const aboveLimit = decidePayoutApprovalPath({
    riskDecision: RISK_DECISION.APPROVED,
    riskFlags: [],
    amountCents: 10001,
    currencyCode: 'USD',
    provider: 'paypal',
    policy: { autoApprovalMaxCents: 10000 }
  });
  assert.equal(aboveLimit.decision, APPROVAL_DECISION.MANUAL_REVIEW);
  assert.equal(aboveLimit.autoApproved, false);
});

test('review and blocked risk decisions never enter the automatic path', () => {
  const review = decidePayoutApprovalPath({
    riskDecision: RISK_DECISION.REVIEW,
    amountCents: 100,
    policy: { autoApprovalMaxCents: 10000 }
  });
  const blocked = decidePayoutApprovalPath({
    riskDecision: RISK_DECISION.BLOCKED,
    amountCents: 100,
    policy: { autoApprovalMaxCents: 10000 }
  });
  assert.equal(review.decision, APPROVAL_DECISION.MANUAL_REVIEW);
  assert.equal(blocked.decision, APPROVAL_DECISION.BLOCKED);
});
