const config = require('../config');
const { db, transaction } = require('../db');
const { paymentProviderTransactionRepository } = require('../repositories/paymentProviderTransactionRepository');
const { pointsFundingRepository } = require('../repositories/pointsFundingRepository');
const { AUDIT_ACTOR_TYPE, POINTS_FUNDING_STATUS, RISK_DOMAIN } = require('../utils/constants');
const { auditLogService } = require('./auditLogService');
const { pointsFundingService } = require('./pointsFundingService');
const { riskEngineService } = require('./riskEngineService');

const SUCCESS_STATUSES = new Set(['SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED']);

function normalizeAccount(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function getDestinationAccount(destination = {}) {
  return normalizeAccount(destination.accountNumber || destination.account_number || destination.account || destination.accountNo);
}

async function findCandidates(normalized, client = db) {
  const candidates = [];
  if (normalized.providerReference) {
    const byReference = await pointsFundingRepository.findRequestByReference(normalized.providerReference, client);
    if (byReference) candidates.push(byReference);
  }
  const rows = await client.all(
    `
      SELECT * FROM points_funding_requests
      WHERE expected_amount_minor = ?
        AND currency = ?
        AND status IN ('PAYMENT_INSTRUCTIONS', 'PAYMENT_REPORTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION')
      ORDER BY created_at ASC
      LIMIT 10
    `,
    [normalized.amountMinor, normalized.currency]
  );
  for (const row of rows) {
    const mapped = await pointsFundingRepository.findRequestById(row.id, client);
    if (mapped && !candidates.some((candidate) => candidate.id === mapped.id)) {
      candidates.push(mapped);
    }
  }
  return candidates;
}

async function isTransactionAlreadyLinked(normalized, client = db) {
  const existing = await paymentProviderTransactionRepository.findByProviderTransactionId(
    normalized.provider,
    normalized.providerTransactionId,
    client
  );
  return existing?.fundingRequestId || null;
}

function evaluateCandidate(normalized, request) {
  const reasons = [];
  const mismatches = [];
  const destinationSnapshot = request.destinationSnapshot || {};

  if (normalized.providerReference && [request.publicReference, request.paymentReference].includes(normalized.providerReference)) {
    reasons.push('REFERENCE_MATCH');
  } else {
    mismatches.push('REFERENCE_MISMATCH');
  }
  if (Number(normalized.amountMinor) === Number(request.expectedAmountMinor)) {
    reasons.push('AMOUNT_MATCH');
  } else {
    mismatches.push('AMOUNT_MISMATCH');
  }
  if (normalized.currency === request.currency) {
    reasons.push('CURRENCY_MATCH');
  } else {
    mismatches.push('CURRENCY_MISMATCH');
  }

  const paidDestination = getDestinationAccount(normalized.destination);
  const expectedDestination = getDestinationAccount(destinationSnapshot);
  if (paidDestination && expectedDestination) {
    if (paidDestination === expectedDestination) {
      reasons.push('DESTINATION_MATCH');
    } else {
      mismatches.push('DESTINATION_MISMATCH');
    }
  } else {
    reasons.push('DESTINATION_NOT_SUPPLIED');
  }

  return { reasons, mismatches };
}

async function matchPayment(normalized, client = db) {
  const alreadyLinked = await isTransactionAlreadyLinked(normalized, client);
  if (alreadyLinked) {
    return {
      status: 'DUPLICATE',
      confidence: 0,
      fundingRequestId: alreadyLinked,
      userId: null,
      reasons: ['PROVIDER_TRANSACTION_ALREADY_LINKED'],
      mismatches: []
    };
  }

  const candidates = await findCandidates(normalized, client);
  if (candidates.length === 0) {
    return { status: 'NO_MATCH', confidence: 0, fundingRequestId: null, reasons: [], mismatches: ['NO_CANDIDATES'] };
  }
  const exactReferenceCandidates = candidates.filter((candidate) =>
    normalized.providerReference && [candidate.publicReference, candidate.paymentReference].includes(normalized.providerReference)
  );
  if (exactReferenceCandidates.length > 1) {
    return { status: 'CONFLICT', confidence: 0, fundingRequestId: null, reasons: ['REFERENCE_MATCH'], mismatches: ['MULTIPLE_CANDIDATES'] };
  }
  const selected = exactReferenceCandidates[0] || (candidates.length === 1 ? candidates[0] : null);
  if (!selected) {
    return { status: 'MANUAL_REVIEW', confidence: 0.5, fundingRequestId: null, reasons: ['AMOUNT_MATCH'], mismatches: ['MULTIPLE_CANDIDATES'] };
  }

  const evaluation = evaluateCandidate(normalized, selected);
  const mandatory = ['REFERENCE_MATCH', 'AMOUNT_MATCH', 'CURRENCY_MATCH'];
  const mandatoryPass = mandatory.every((reason) => evaluation.reasons.includes(reason));
  const destinationMismatch = evaluation.mismatches.includes('DESTINATION_MISMATCH');
  const status = mandatoryPass && !destinationMismatch ? 'MATCHED' : 'MANUAL_REVIEW';
  return {
    status,
    confidence: status === 'MATCHED' ? 1 : 0.5,
    fundingRequestId: selected.id,
    userId: selected.userId,
    reasons: evaluation.reasons,
    mismatches: evaluation.mismatches
  };
}

function evaluateRisk(normalized, matchResult) {
  const flags = [];
  if (!SUCCESS_STATUSES.has(normalized.status)) flags.push('PAYMENT_NOT_SUCCESSFUL');
  if (normalized.currency !== 'NGN') flags.push('CURRENCY_MISMATCH');
  if (['DUPLICATE', 'CONFLICT'].includes(matchResult.status)) flags.push(matchResult.status);
  if (matchResult.status !== 'MATCHED') flags.push('MANUAL_REVIEW_REQUIRED');

  let level = 'LOW';
  if (flags.includes('DUPLICATE') || flags.includes('CURRENCY_MISMATCH')) level = 'HIGH';
  else if (flags.length > 0) level = 'MEDIUM';
  return { level, flags };
}

function canAutoApprove(normalized, matchResult, risk) {
  return Boolean(
    config.PAYMENT_VERIFICATION.enabled &&
      config.PAYMENT_VERIFICATION.autoApprovalEnabled &&
      matchResult.status === 'MATCHED' &&
      risk.level === 'LOW' &&
      SUCCESS_STATUSES.has(normalized.status) &&
      normalized.currency === 'NGN' &&
      Number(normalized.amountMinor) <= Number(config.PAYMENT_VERIFICATION.autoApprovalMaxAmountMinor || 0)
  );
}

async function processVerifiedTransaction(normalized, options = {}) {
  const prepared = await transaction(async (client) => {
    const matchResult = await matchPayment(normalized, client);
    const risk = evaluateRisk(normalized, matchResult);
    const riskDecision = await riskEngineService.evaluateEvent(
      {
        eventType: 'PAYMENT_DETECTED',
        domain: RISK_DOMAIN.PAYMENT,
        userId: matchResult.userId || null,
        source: 'payment-matching-service',
        resourceType: 'payment_provider_transaction',
        resourceId: normalized.providerTransactionId,
        correlationId: `payment:${normalized.provider}:${normalized.providerTransactionId}`,
        metadata: {
          paymentRiskFlags: risk.flags,
          amountMinor: normalized.amountMinor,
          provider: normalized.provider,
          matchStatus: matchResult.status,
          mandatoryReview: matchResult.status !== 'MATCHED' || risk.level !== 'LOW'
        }
      },
      { client, actorId: 'payment-matching-service' }
    );
    const blocksAutoApproval = ['REQUIRE_REVIEW', 'REQUIRE_VERIFICATION', 'TEMPORARILY_RESTRICT', 'BLOCK'].includes(riskDecision.decision.decision);
    const autoApprove = canAutoApprove(normalized, matchResult, risk) && !blocksAutoApproval;
    const stored = await paymentProviderTransactionRepository.createOrGet(
      {
        ...normalized,
        verificationStatus: 'VERIFIED',
        matchStatus: matchResult.status,
        riskLevel: risk.level,
        fundingRequestId: matchResult.fundingRequestId,
        matchResult: { ...matchResult, risk, riskDecision: riskDecision.decision, autoApprove, verification: options.verification || {} },
        metadata: normalized.metadata
      },
      client
    );
    if (stored.duplicate) {
      return { transaction: stored.transaction, match_result: stored.transaction.matchResult, duplicate: true, auto_approved: false };
    }

    if (matchResult.fundingRequestId) {
      const nextStatus = autoApprove ? POINTS_FUNDING_STATUS.UNDER_REVIEW : POINTS_FUNDING_STATUS.UNDER_REVIEW;
      await pointsFundingRepository.updateRequest(
        matchResult.fundingRequestId,
        {
          status: nextStatus,
          riskStatus: risk.level === 'LOW' ? 'NORMAL' : 'MANUAL_REVIEW_REQUIRED',
          possibleDuplicate: risk.flags.includes('DUPLICATE'),
          metadata: {
            payment_provider_transaction_id: stored.transaction.id,
            payment_match_result: matchResult,
            payment_risk: risk
          }
        },
        client
      );
    }

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: 'payment-matching-service',
        action: autoApprove ? 'payment.auto_approved' : 'payment.manual_review',
        entityType: 'payment_provider_transaction',
        entityId: stored.transaction.id,
        metadata: {
          provider: normalized.provider,
          provider_transaction_id: normalized.providerTransactionId,
          funding_request_id: matchResult.fundingRequestId,
          match_status: matchResult.status,
          risk_level: risk.level
        }
      },
      client
    );

    return {
      transaction: stored.transaction,
      match_result: matchResult,
      risk,
      duplicate: false,
      auto_approved: autoApprove
    };
  });

  if (!prepared.auto_approved) {
    return prepared;
  }

  const approval = await pointsFundingService.approveFundingRequest({
    requestId: prepared.match_result.fundingRequestId,
    adminActorId: 'payment-verification-engine',
    adminNote: 'Automatically approved after verified provider payment match.',
    idempotencyKey: `payment:${prepared.transaction.id}:funding-credit`
  });
  const transactionRecord = await paymentProviderTransactionRepository.update(
    prepared.transaction.id,
    {
      matchStatus: 'AUTO_APPROVED',
      matchResult: {
        ...prepared.match_result,
        risk: prepared.risk,
        autoApprove: true,
        approvalBalance: approval.balance
      }
    }
  );

  return {
    ...prepared,
    transaction: transactionRecord,
    approval
  };
}

module.exports = {
  paymentMatchingService: {
    evaluateRisk,
    matchPayment,
    processVerifiedTransaction
  }
};