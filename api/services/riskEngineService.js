const config = require('../config');
const { db, transaction } = require('../db');
const { riskRepository } = require('../repositories/riskRepository');
const { auditLogService } = require('./auditLogService');
const { AppError } = require('../utils/errors');
const {
  ACCOUNT_RESTRICTION_CAPABILITY,
  ACCOUNT_RISK_STATE,
  AUDIT_ACTOR_TYPE,
  RISK_CASE_STATUS,
  RISK_DOMAIN,
  RISK_ENGINE_DECISION,
  RISK_LEVEL
} = require('../utils/constants');

const levelRank = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const decisionRank = {
  ALLOW: 0,
  ALLOW_WITH_MONITORING: 1,
  REQUIRE_REVIEW: 2,
  REQUIRE_VERIFICATION: 3,
  TEMPORARILY_RESTRICT: 4,
  BLOCK: 5
};

function maxLevel(current, next) {
  return levelRank[next] > levelRank[current] ? next : current;
}

function maxDecision(current, next) {
  return decisionRank[next] > decisionRank[current] ? next : current;
}

function riskConfig() {
  return config.RISK_ENGINE || {};
}

function isEnabled() {
  return riskConfig().enabled !== false;
}

function cutoffIso(ms) {
  return new Date(Date.now() - ms).toISOString();
}

async function countFundingSince(userId, since, client) {
  const row = await client.get('SELECT COUNT(*) AS count FROM points_funding_requests WHERE user_id = ? AND created_at >= ?', [userId, since]);
  return Number(row?.count || 0);
}

async function sumFundingSince(userId, since, client) {
  const row = await client.get('SELECT COALESCE(SUM(expected_amount_minor), 0) AS total FROM points_funding_requests WHERE user_id = ? AND created_at >= ?', [userId, since]);
  return Number(row?.total || 0);
}

async function countRejectedPaymentsSince(userId, since, client) {
  const row = await client.get("SELECT COUNT(*) AS count FROM points_funding_requests WHERE user_id = ? AND status = 'REJECTED' AND updated_at >= ?", [userId, since]);
  return Number(row?.count || 0);
}

async function countOrdersSince(userId, since, client) {
  const row = await client.get('SELECT COUNT(*) AS count FROM orders WHERE user_id = ? AND created_at >= ?', [userId, since]);
  return Number(row?.count || 0);
}

async function sumPointConsumptionSince(userId, since, client) {
  const row = await client.get(
    `
      SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS total
      FROM points_transactions
      WHERE user_id = ? AND created_at >= ?
        AND type IN ('POINT_RESERVATION_HOLD', 'POINT_RESERVATION_COMMIT', 'RECEIPT_SPEND', 'EMAIL_SPEND')
    `,
    [userId, since]
  );
  return Number(row?.total || 0);
}

async function getActiveRestrictions(userId) {
  return riskRepository.listActiveRestrictions(userId);
}

async function assertCapabilityAllowed(userId, capability, client = db) {
  if (!isEnabled() || !userId) return;
  const restrictions = await riskRepository.listActiveRestrictions(userId, client);
  const restriction = restrictions.find((entry) => entry.capability === capability || entry.capability === ACCOUNT_RESTRICTION_CAPABILITY.API_ACCESS_RESTRICTED);
  if (restriction) {
    throw new AppError(403, 'ACTION_REQUIRES_ADDITIONAL_VERIFICATION', 'This action requires additional verification before continuing.', {
      capability,
      restrictionId: restriction.id,
      expiresAt: restriction.expiresAt || null
    });
  }
}

function signal(type, severity, reason, metadata = {}) {
  return { signalType: type, severity, reason, metadata };
}

async function buildSignalsForEvent(event, client) {
  const cfg = riskConfig();
  const metadata = event.metadata || {};
  const signals = [];
  const hourAgo = cutoffIso(60 * 60 * 1000);
  const dayAgo = cutoffIso(24 * 60 * 60 * 1000);
  const minuteAgo = cutoffIso(60 * 1000);

  if (event.domain === RISK_DOMAIN.PAYMENT) {
    for (const flag of metadata.paymentRiskFlags || metadata.flags || []) {
      const severity = ['DUPLICATE', 'CURRENCY_MISMATCH', 'DESTINATION_MISMATCH'].includes(flag) ? RISK_LEVEL.HIGH : RISK_LEVEL.MEDIUM;
      signals.push(signal(flag === 'DUPLICATE' ? 'DUPLICATE_PAYMENT' : flag, severity, `Payment risk flag ${flag} requires review.`, { flag }));
    }
    if (Number(metadata.amountMinor || 0) >= cfg.largeFundingThreshold) {
      signals.push(signal('LARGE_FUNDING', RISK_LEVEL.HIGH, 'Payment amount meets large-funding review threshold.', { thresholdMinor: cfg.largeFundingThreshold }));
    }
  }

  if ([RISK_DOMAIN.PAYMENT, RISK_DOMAIN.VELOCITY].includes(event.domain) && event.eventType.startsWith('FUNDING_') && event.userId) {
    const attempts = await countFundingSince(event.userId, hourAgo, client);
    if (attempts >= cfg.maxFundingAttemptsPerHour) {
      signals.push(signal('RAPID_FUNDING', RISK_LEVEL.MEDIUM, 'Funding attempt velocity exceeded configured threshold.', { attempts, threshold: cfg.maxFundingAttemptsPerHour }));
    }
    const dailyAmount = await sumFundingSince(event.userId, dayAgo, client);
    if (dailyAmount >= cfg.maxDailyFundingAmount) {
      signals.push(signal('EXCESSIVE_FUNDING', RISK_LEVEL.HIGH, 'Daily funding amount exceeded configured threshold.', { dailyAmount, thresholdMinor: cfg.maxDailyFundingAmount }));
    }
    const rejected = await countRejectedPaymentsSince(event.userId, dayAgo, client);
    if (rejected >= cfg.maxFailedPaymentAttempts) {
      signals.push(signal('REPEATED_REJECTED_PAYMENTS', RISK_LEVEL.HIGH, 'Rejected payment count exceeded configured threshold.', { rejected, threshold: cfg.maxFailedPaymentAttempts }));
    }
  }

  if (event.domain === RISK_DOMAIN.SERVICE && event.userId) {
    const perMinute = await countOrdersSince(event.userId, minuteAgo, client);
    const perHour = await countOrdersSince(event.userId, hourAgo, client);
    if (perMinute >= cfg.maxServiceActionsPerMinute) {
      signals.push(signal('EXCESSIVE_SERVICE_USAGE', RISK_LEVEL.MEDIUM, 'Service action velocity exceeded per-minute threshold.', { perMinute, threshold: cfg.maxServiceActionsPerMinute }));
    }
    if (perHour >= cfg.maxServiceActionsPerHour) {
      signals.push(signal('EXCESSIVE_SERVICE_USAGE', RISK_LEVEL.HIGH, 'Service action velocity exceeded hourly threshold.', { perHour, threshold: cfg.maxServiceActionsPerHour }));
    }
    const consumed = await sumPointConsumptionSince(event.userId, cutoffIso(2 * 60 * 1000), client);
    if (consumed >= cfg.rapidPointConsumptionThreshold) {
      signals.push(signal('RAPID_POINT_CONSUMPTION', RISK_LEVEL.HIGH, 'Point consumption exceeded configured rapid-use threshold.', { consumed, threshold: cfg.rapidPointConsumptionThreshold }));
    }
  }

  if (event.domain === RISK_DOMAIN.ADMIN && Number(metadata.adjustmentPoints || 0) >= cfg.largeAdminAdjustmentThreshold) {
    signals.push(signal('ADMIN_HIGH_VALUE_ADJUSTMENT', RISK_LEVEL.HIGH, 'Admin point adjustment meets high-value review threshold.', { threshold: cfg.largeAdminAdjustmentThreshold }));
  }

  if (metadata.criticalFinancialAnomaly) {
    signals.push(signal('CRITICAL_FINANCIAL_MISMATCH', RISK_LEVEL.CRITICAL, 'Critical financial mismatch requires immediate investigation.', { anomalyType: metadata.anomalyType || event.eventType }));
  }

  return signals;
}

function decide(storedSignals, event) {
  let riskLevel = RISK_LEVEL.LOW;
  let decision = RISK_ENGINE_DECISION.ALLOW;
  const reasons = [];

  for (const sig of storedSignals) {
    riskLevel = maxLevel(riskLevel, sig.severity);
    reasons.push(sig.signalType);
    if (sig.severity === RISK_LEVEL.CRITICAL) decision = maxDecision(decision, RISK_ENGINE_DECISION.TEMPORARILY_RESTRICT);
    else if (sig.severity === RISK_LEVEL.HIGH) decision = maxDecision(decision, RISK_ENGINE_DECISION.REQUIRE_REVIEW);
    else if (sig.severity === RISK_LEVEL.MEDIUM) decision = maxDecision(decision, RISK_ENGINE_DECISION.ALLOW_WITH_MONITORING);
  }

  if (event.metadata?.mandatoryReview) decision = maxDecision(decision, RISK_ENGINE_DECISION.REQUIRE_REVIEW);
  if (event.metadata?.mandatoryVerification) decision = maxDecision(decision, RISK_ENGINE_DECISION.REQUIRE_VERIFICATION);
  if (event.metadata?.mandatoryBlock) decision = maxDecision(decision, RISK_ENGINE_DECISION.BLOCK);

  return { riskLevel, decision, reasons };
}

function stateForDecision(decision, riskLevel) {
  if (decision === RISK_ENGINE_DECISION.TEMPORARILY_RESTRICT || decision === RISK_ENGINE_DECISION.BLOCK) return ACCOUNT_RISK_STATE.RESTRICTED;
  if (decision === RISK_ENGINE_DECISION.REQUIRE_REVIEW || riskLevel === RISK_LEVEL.HIGH || riskLevel === RISK_LEVEL.CRITICAL) return ACCOUNT_RISK_STATE.REVIEW;
  if (decision === RISK_ENGINE_DECISION.ALLOW_WITH_MONITORING || riskLevel === RISK_LEVEL.MEDIUM) return ACCOUNT_RISK_STATE.WATCH;
  return ACCOUNT_RISK_STATE.NORMAL;
}

async function evaluateEvent(input, options = {}) {
  if (!isEnabled()) {
    return { decision: RISK_ENGINE_DECISION.ALLOW, riskLevel: RISK_LEVEL.LOW, reasons: [], disabled: true };
  }

  const runEvaluation = async (client) => {
    const event = await riskRepository.createOrGetEvent(
      {
        ...input,
        correlationId: input.correlationId || input.eventKey || `${input.eventType}:${input.resourceType || 'resource'}:${input.resourceId || 'none'}`,
        source: input.source || 'risk-engine'
      },
      client
    );

    const signalInputs = [...(input.signals || []), ...(await buildSignalsForEvent({ ...input, id: event.id }, client))];
    const storedSignals = [];
    for (const sig of signalInputs) {
      storedSignals.push(await riskRepository.createOrGetSignal(
        {
          ...sig,
          riskEventId: event.id,
          domain: input.domain,
          source: sig.source || input.source || 'risk-engine',
          userId: input.userId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          correlationId: input.correlationId || event.correlationId
        },
        client
      ));
    }

    const result = decide(storedSignals, { ...input, id: event.id });
    const accountState = input.userId ? stateForDecision(result.decision, result.riskLevel) : null;
    const decision = await riskRepository.createOrGetDecision(
      {
        riskEventId: event.id,
        eventKey: event.eventKey,
        domain: input.domain,
        userId: input.userId,
        decision: result.decision,
        riskLevel: result.riskLevel,
        accountState,
        reasons: result.reasons,
        signalIds: storedSignals.map((sig) => sig.id),
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        correlationId: input.correlationId || event.correlationId,
        metadata: { signals: storedSignals.map((sig) => ({ type: sig.signalType, severity: sig.severity })) }
      },
      client
    );

    let account = null;
    if (input.userId && result.reasons.length > 0) {
      account = await riskRepository.upsertAccountState(
        {
          userId: input.userId,
          state: accountState,
          riskLevel: result.riskLevel,
          lastDecisionId: decision.id,
          lastSignalAt: new Date().toISOString(),
          changedByActorId: options.actorId || 'risk-engine',
          changedReason: result.reasons.join(', ')
        },
        client
      );
    }

    let riskCase = null;
    if (storedSignals.length > 0 && [RISK_ENGINE_DECISION.REQUIRE_REVIEW, RISK_ENGINE_DECISION.REQUIRE_VERIFICATION, RISK_ENGINE_DECISION.TEMPORARILY_RESTRICT, RISK_ENGINE_DECISION.BLOCK].includes(result.decision)) {
      riskCase = await riskRepository.createOrGetCase(
        {
          userId: input.userId,
          domain: input.domain,
          riskLevel: result.riskLevel,
          status: result.riskLevel === RISK_LEVEL.CRITICAL ? RISK_CASE_STATUS.ESCALATED : RISK_CASE_STATUS.OPEN,
          title: `${input.domain} requires review`,
          summary: result.reasons.join(', '),
          openedByDecisionId: decision.id,
          signalIds: storedSignals.map((sig) => sig.id),
          relatedResources: [{ type: input.resourceType || 'unknown', id: input.resourceId || null }],
          correlationId: input.correlationId || event.correlationId
        },
        client
      );
    }

    let restriction = null;
    if (input.userId && riskConfig().autoRestrictionEnabled && result.decision === RISK_ENGINE_DECISION.TEMPORARILY_RESTRICT) {
      restriction = await riskRepository.createOrGetRestriction(
        {
          userId: input.userId,
          capability: input.restrictionCapability || ACCOUNT_RESTRICTION_CAPABILITY.FUNDING_RESTRICTED,
          reason: result.reasons.join(', '),
          reasonCode: input.eventType,
          riskDecisionId: decision.id,
          caseId: riskCase?.id || null,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        },
        client
      );
    }

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: 'risk-engine',
        action: 'risk.decision_recorded',
        entityType: input.resourceType || 'risk_event',
        entityId: input.resourceId || event.id,
        metadata: {
          decision: decision.decision,
          risk_level: decision.riskLevel,
          reasons: decision.reasons,
          case_id: riskCase?.id || null,
          restriction_id: restriction?.id || null
        }
      },
      client
    );

    return { event, signals: storedSignals, decision, risk_case: riskCase, account_state: account, restriction };
  };

  if (options.client) {
    return runEvaluation(options.client);
  }

  return transaction(runEvaluation);
}

async function listCases(filters) {
  return riskRepository.listCases(filters);
}

async function getCase(caseId) {
  const riskCase = await riskRepository.findCaseById(caseId);
  if (!riskCase) throw new AppError(404, 'RISK_CASE_NOT_FOUND', 'Risk case not found.');
  return riskCase;
}

async function getUserRiskProfile(userId) {
  const [accountState, restrictions, signals, cases] = await Promise.all([
    riskRepository.getAccountState(userId),
    riskRepository.listActiveRestrictions(userId),
    riskRepository.listSignals({ userId, limit: 25 }),
    riskRepository.listCases({ userId, limit: 25 })
  ]);
  return {
    user_id: userId,
    account_state: accountState || { userId, state: ACCOUNT_RISK_STATE.NORMAL, riskLevel: RISK_LEVEL.LOW },
    active_restrictions: restrictions,
    recent_signals: signals,
    cases
  };
}

async function listSignals(filters) {
  return riskRepository.listSignals(filters);
}

async function getOverview() {
  return riskRepository.getOverview();
}

async function cleanupExpiredRiskData(options = {}) {
  const cfg = riskConfig();
  return riskRepository.cleanupExpiredRiskData({
    signalRetentionDays: options.signalRetentionDays || cfg.signalRetentionDays,
    caseRetentionDays: options.caseRetentionDays || cfg.caseRetentionDays
  });
}

async function updateCaseStatus({ caseId, status, reason, adminActorId, assignedTo }) {
  return transaction(async (client) => {
    const now = new Date().toISOString();
    const resolved = ['RESOLVED', 'FALSE_POSITIVE'].includes(status);
    const riskCase = await riskRepository.updateCase(
      caseId,
      {
        status,
        assignedTo,
        resolution: resolved ? status : undefined,
        resolutionReason: resolved ? reason : undefined,
        resolvedByActorId: resolved ? adminActorId : undefined,
        resolvedAt: resolved ? now : undefined
      },
      client
    );
    if (!riskCase) throw new AppError(404, 'RISK_CASE_NOT_FOUND', 'Risk case not found.');
    if (reason) await riskRepository.addCaseNote({ caseId: riskCase.id, actorId: adminActorId, note: reason }, client);
    await auditLogService.log({
      actorType: AUDIT_ACTOR_TYPE.ADMIN,
      actorId: adminActorId,
      action: status === 'FALSE_POSITIVE' ? 'risk_case.false_positive' : 'risk_case.updated',
      entityType: 'risk_case',
      entityId: riskCase.id,
      metadata: { status, reason: reason || null, assigned_to: assignedTo || null }
    }, client);
    return riskCase;
  });
}

module.exports = {
  riskEngineService: {
    assertCapabilityAllowed,
    cleanupExpiredRiskData,
    evaluateEvent,
    getActiveRestrictions,
    getCase,
    getOverview,
    getUserRiskProfile,
    listCases,
    listSignals,
    updateCaseStatus
  }
};