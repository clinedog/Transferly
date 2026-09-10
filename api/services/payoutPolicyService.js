'use strict';

/**
 * Payout approval policy.
 *
 * Decides whether a payout follows the automatic path (AUTO_APPROVED) or the
 * manual-review path (MANUAL_REVIEW) after the risk engine has returned a
 * decision. Automatic execution is the DEFAULT-OFF posture: it only activates
 * when PAYOUT_AUTO_APPROVAL_MAX_CENTS is configured and the payout is low risk
 * and within the limit. Everything else stays in human control.
 *
 * This service only DECIDES the path. Persisting the state transition and the
 * automatic processing request remains the caller's responsibility.
 */

const { RISK_DECISION, RISK_LEVEL } = require('../utils/constants');
const config = require('../config');

const APPROVAL_DECISION = Object.freeze({
  AUTO_APPROVED: 'AUTO_APPROVED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  BLOCKED: 'BLOCKED'
});

/**
 * Resolves the configured automatic-approval threshold in minor units.
 * Returns null when automatic approval is disabled (default).
 */
function resolveAutoApprovalThreshold() {
  const raw = config.PAYOUT_AUTO_APPROVAL_MAX_CENTS;
  if (raw === undefined || raw === null || raw === '' || raw === '0') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function flagSeverity(flag) {
  return String(flag?.severity || '').toUpperCase();
}

/**
 * @param {object} input
 * @param {string} input.riskDecision - RISK_DECISION value from the risk engine
 * @param {Array<{severity: string, ruleCode: string}>} [input.riskFlags]
 * @param {number} input.amountCents - payout amount in minor units
 * @param {string} [input.currencyCode]
 * @param {string} [input.provider] - selected provider key
 * @param {object} [input.policy] - override policy (tests/sandbox)
 * @returns {{decision: string, path: string, autoApproved: boolean, reason: string, details: object}}
 */
function decidePayoutApprovalPath({ riskDecision, riskFlags = [], amountCents, currencyCode, provider, policy = {} }) {
  const amount = Number(amountCents);
  const threshold = policy.autoApprovalMaxCents ?? resolveAutoApprovalThreshold();
  const currency = String(currencyCode || '').toUpperCase() || null;
  const providerKey = provider ? String(provider).trim().toLowerCase() : null;

  if (riskDecision === RISK_DECISION.BLOCKED) {
    return {
      decision: APPROVAL_DECISION.BLOCKED,
      path: 'BLOCKED',
      autoApproved: false,
      reason: 'Risk engine blocked this payout.',
      details: { riskDecision, amountCents: amount, currency, provider: providerKey, requiresManualReview: false }
    };
  }

  if (riskDecision === RISK_DECISION.REVIEW) {
    return {
      decision: APPROVAL_DECISION.MANUAL_REVIEW,
      path: 'MANUAL_REVIEW',
      autoApproved: false,
      reason: 'Risk engine requires manual review before execution.',
      details: { riskDecision, amountCents: amount, currency, provider: providerKey, requiresManualReview: true }
    };
  }

  if (riskDecision !== RISK_DECISION.APPROVED) {
    return {
      decision: APPROVAL_DECISION.MANUAL_REVIEW,
      path: 'MANUAL_REVIEW',
      autoApproved: false,
      reason: `Unknown risk decision "${riskDecision}" defaults to manual review.`,
      details: { riskDecision, amountCents: amount, currency, provider: providerKey, requiresManualReview: true }
    };
  }

  // Risk engine approved. Automatic execution still requires an explicit
  // configured limit, an amount within it, and no critical risk flags.
  const autoApprovalEnabled = Number.isFinite(threshold) && threshold !== null;
  const withinLimit = autoApprovalEnabled && Number.isFinite(amount) && amount <= threshold;
  const criticalFlags = (riskFlags || []).filter((flag) => {
    const severity = flagSeverity(flag);
    return severity === 'CRITICAL' || severity === RISK_LEVEL.HIGH;
  });

  const autoApproved = autoApprovalEnabled && withinLimit && criticalFlags.length === 0;

  return {
    decision: autoApproved ? APPROVAL_DECISION.AUTO_APPROVED : APPROVAL_DECISION.MANUAL_REVIEW,
    path: autoApproved ? 'AUTO_APPROVED' : 'MANUAL_REVIEW',
    autoApproved,
    reason: autoApproved
      ? 'Low-risk payout within the automatic approval limit.'
      : 'Policy requires manual approval (automatic approval disabled, above limit, or risk-flagged).',
    details: {
      riskDecision,
      amountCents: amount,
      currency,
      provider: providerKey,
      autoApprovalEnabled,
      autoApprovalMaxCents: autoApprovalEnabled ? threshold : null,
      withinLimit: Boolean(withinLimit),
      criticalRiskFlagCount: criticalFlags.length,
      requiresManualReview: !autoApproved
    }
  };
}

module.exports = {
  APPROVAL_DECISION,
  decidePayoutApprovalPath,
  resolveAutoApprovalThreshold
};