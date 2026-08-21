const { transaction } = require('../db');
const { auditLogRepository } = require('../repositories/auditLogRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { providerOperationInboxRepository } = require('../repositories/providerOperationInboxRepository');
const { auditLogService } = require('./auditLogService');
const { ledgerService } = require('./ledgerService');
const { paymentOpsIssueService } = require('./paymentOpsIssueService');
const {
  AUDIT_ACTOR_TYPE,
  BALANCE_BUCKET,
  LEDGER_ENTRY_TYPE,
  PAYOUT_STATUS
} = require('../utils/constants');

const RECOVERY_OUTCOME = Object.freeze({
  ALREADY_APPLIED: 'already_applied',
  SAFE_TO_COMPLETE: 'safe_to_complete',
  REFRESH_REQUIRED: 'refresh_required',
  FINANCE_REVIEW: 'finance_review',
  CONFLICT: 'conflict'
});

const SUCCESS_STATUSES = new Set(['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'TRANSFERRED']);
const FAILED_STATUSES = new Set(['FAILED', 'CANCELED', 'CANCELLED', 'RETURNED', 'REVERSED']);
const DENIED_STATUSES = new Set(['DENIED', 'BLOCKED']);
const NONTERMINAL_STATUSES = new Set(['PENDING', 'HELD', 'UNCLAIMED', 'ONHOLD', 'PROCESSING']);
const TERMINAL_PAYOUT_STATUSES = new Set([
  PAYOUT_STATUS.SUCCESS,
  PAYOUT_STATUS.FAILED,
  PAYOUT_STATUS.DENIED,
  PAYOUT_STATUS.REJECTED
]);

function desiredPayoutStatus(providerStatus) {
  const normalized = String(providerStatus || '').toUpperCase();
  if (SUCCESS_STATUSES.has(normalized)) return PAYOUT_STATUS.SUCCESS;
  if (FAILED_STATUSES.has(normalized)) return PAYOUT_STATUS.FAILED;
  if (DENIED_STATUSES.has(normalized)) return PAYOUT_STATUS.DENIED;
  if (NONTERMINAL_STATUSES.has(normalized)) return null;
  return undefined;
}

function reservedAmountCentsForPayout(payout) {
  return Number(payout.metadata?.pricing?.total_debit_cents || payout.amountCents);
}

function localProviderForPayout(payout) {
  return String(payout.metadata?.provider || 'paypal').toLowerCase();
}

function localProviderResourceId(payout, observation) {
  if (observation.provider === 'stripe') {
    return payout.metadata?.provider_transfer_id || payout.metadata?.stripe_transfer?.id || null;
  }
  return observation.providerResourceType === 'payout_batch'
    ? payout.payoutBatch?.paypalPayoutBatchId || null
    : payout.paypalPayoutItemId || null;
}

async function payoutEvidence(payout, client) {
  const wallet = await client.get('SELECT id FROM wallets WHERE user_id = ?', [payout.userId]);
  const [settlement, refund, reserve, audits, walletReconciliation] = await Promise.all([
    client.get('SELECT * FROM ledger_entries WHERE entry_key = ?', [`payout-settle:${payout.id}`]),
    client.get('SELECT * FROM ledger_entries WHERE entry_key = ?', [`payout-refund:${payout.id}`]),
    client.get('SELECT * FROM ledger_entries WHERE entry_key = ?', [`payout-reserve:${payout.id}`]),
    auditLogRepository.findManyForEntity('payout', payout.id, {}, client),
    wallet ? ledgerService.verifyWalletLedgerInvariant(wallet.id, client) : null
  ]);
  return { settlement, refund, reserve, audits, walletReconciliation };
}

function ledgerEntryMatches(entry, expected) {
  if (!entry) return true;
  return entry.wallet_id === expected.walletId &&
    entry.user_id === expected.userId &&
    entry.type === expected.type &&
    entry.debit_bucket === expected.debitBucket &&
    entry.credit_bucket === expected.creditBucket &&
    entry.amount_cents === expected.amountCents &&
    entry.currency_code === expected.currencyCode &&
    entry.reference_type === 'PAYOUT' &&
    entry.reference_id === expected.payoutId;
}

function payoutLedgerEvidenceIsValid(payout, evidence) {
  const common = {
    walletId: evidence.walletReconciliation?.walletId,
    userId: payout.userId,
    payoutId: payout.id,
    amountCents: reservedAmountCentsForPayout(payout),
    currencyCode: payout.currencyCode
  };
  return ledgerEntryMatches(evidence.reserve, {
    ...common,
    type: LEDGER_ENTRY_TYPE.PAYOUT_RESERVE,
    debitBucket: BALANCE_BUCKET.AVAILABLE,
    creditBucket: BALANCE_BUCKET.FROZEN
  }) && ledgerEntryMatches(evidence.settlement, {
    ...common,
    type: LEDGER_ENTRY_TYPE.PAYOUT_SETTLED,
    debitBucket: BALANCE_BUCKET.FROZEN,
    creditBucket: BALANCE_BUCKET.PAID_OUT
  }) && ledgerEntryMatches(evidence.refund, {
    ...common,
    type: LEDGER_ENTRY_TYPE.PAYOUT_RELEASE_REFUND,
    debitBucket: BALANCE_BUCKET.FROZEN,
    creditBucket: BALANCE_BUCKET.AVAILABLE
  });
}

function classifyObservation(observation, payout, evidence) {
  if (!payout) {
    return { outcome: RECOVERY_OUTCOME.FINANCE_REVIEW, reason: 'payout_not_found' };
  }
  if (observation.operationType !== 'payout.status_observed' || observation.aggregateType !== 'payout') {
    return { outcome: RECOVERY_OUTCOME.FINANCE_REVIEW, reason: 'unsupported_operation' };
  }

  const provider = String(observation.provider || '').toLowerCase();
  if (provider !== localProviderForPayout(payout)) {
    return { outcome: RECOVERY_OUTCOME.CONFLICT, reason: 'provider_mismatch' };
  }
  if (observation.payload.amountCents !== payout.amountCents || observation.payload.currencyCode !== payout.currencyCode) {
    return { outcome: RECOVERY_OUTCOME.CONFLICT, reason: 'amount_or_currency_mismatch' };
  }

  const localResourceId = localProviderResourceId(payout, observation);
  if (localResourceId && observation.providerResourceId && localResourceId !== observation.providerResourceId) {
    return { outcome: RECOVERY_OUTCOME.CONFLICT, reason: 'provider_resource_mismatch' };
  }

  const desiredStatus = desiredPayoutStatus(observation.providerStatus);
  if (desiredStatus === null) {
    return { outcome: RECOVERY_OUTCOME.REFRESH_REQUIRED, reason: 'provider_status_nonterminal' };
  }
  if (desiredStatus === undefined) {
    return { outcome: RECOVERY_OUTCOME.FINANCE_REVIEW, reason: 'provider_status_unknown' };
  }
  if (TERMINAL_PAYOUT_STATUSES.has(payout.status) && payout.status !== desiredStatus) {
    return { outcome: RECOVERY_OUTCOME.CONFLICT, reason: 'terminal_status_mismatch' };
  }
  if (evidence.settlement && evidence.refund) {
    return { outcome: RECOVERY_OUTCOME.CONFLICT, reason: 'multiple_ledger_dispositions' };
  }
  if (!payoutLedgerEvidenceIsValid(payout, evidence)) {
    return { outcome: RECOVERY_OUTCOME.CONFLICT, reason: 'ledger_evidence_mismatch' };
  }

  const expectedLedger = desiredStatus === PAYOUT_STATUS.SUCCESS ? evidence.settlement : evidence.refund;
  const conflictingLedger = desiredStatus === PAYOUT_STATUS.SUCCESS ? evidence.refund : evidence.settlement;
  if (conflictingLedger) {
    return { outcome: RECOVERY_OUTCOME.CONFLICT, reason: 'ledger_disposition_mismatch' };
  }
  if (!evidence.reserve && !expectedLedger) {
    return { outcome: RECOVERY_OUTCOME.FINANCE_REVIEW, reason: 'reservation_evidence_missing' };
  }
  if (!evidence.walletReconciliation?.reconciled) {
    return { outcome: RECOVERY_OUTCOME.FINANCE_REVIEW, reason: 'wallet_ledger_drift' };
  }

  const recoveryAudited = evidence.audits.some((audit) =>
    (audit.action === 'payout.provider_observation_recovered' &&
      audit.metadata?.observation_id === observation.id) ||
    ['payout.processed', 'payout.refreshed'].includes(audit.action)
  );
  if (payout.status === desiredStatus && expectedLedger && recoveryAudited) {
    return { outcome: RECOVERY_OUTCOME.ALREADY_APPLIED, reason: 'all_local_effects_present', desiredStatus };
  }
  return { outcome: RECOVERY_OUTCOME.SAFE_TO_COMPLETE, reason: 'deterministic_local_effects_missing', desiredStatus };
}

function recoveredMetadata(payout, observation) {
  const provider = String(observation.provider).toLowerCase();
  const providerItemId = observation.payload.providerItemId || observation.providerResourceId || null;
  return {
    ...(payout.metadata || {}),
    provider,
    provider_item_status: payout.metadata?.provider_item_status || observation.providerStatus,
    provider_issue_code: observation.payload.issueCode || null,
    provider_transfer_id: provider === 'stripe' ? providerItemId : payout.metadata?.provider_transfer_id,
    last_synced_at: observation.receivedAt
  };
}

function createProviderOperationRecoveryService({
  inboxRepository = providerOperationInboxRepository,
  payouts = payoutRepository,
  transact = transaction,
  now = () => new Date().toISOString()
} = {}) {
  async function recoverObservation(observationId) {
    return transact(async (client) => {
      const observation = await inboxRepository.findById(observationId, client);
      if (!observation) {
        return { observationId, outcome: RECOVERY_OUTCOME.FINANCE_REVIEW, reason: 'observation_not_found' };
      }
      if (observation.consumedAt) {
        return {
          observationId,
          payoutId: observation.aggregateId,
          outcome: RECOVERY_OUTCOME.ALREADY_APPLIED,
          reason: 'observation_already_consumed'
        };
      }

      const payout = await payouts.findById(observation.aggregateId, client);
      const evidence = payout ? await payoutEvidence(payout, client) : {};
      const classification = classifyObservation(observation, payout, evidence);
      if (classification.outcome === RECOVERY_OUTCOME.ALREADY_APPLIED) {
        await inboxRepository.markConsumed({
          id: observation.id,
          consumedAt: now(),
          consumedBy: 'provider-operation-recovery-service'
        }, client);
        return { observationId, payoutId: observation.aggregateId, ...classification };
      }
      if (classification.outcome !== RECOVERY_OUTCOME.SAFE_TO_COMPLETE) {
        return { observationId, payoutId: observation.aggregateId, ...classification };
      }

      const amountCents = reservedAmountCentsForPayout(payout);
      if (classification.desiredStatus === PAYOUT_STATUS.SUCCESS) {
        await ledgerService.settlePayoutInTransaction({
          userId: payout.userId,
          payoutId: payout.id,
          amountCents,
          currencyCode: payout.currencyCode
        }, client);
      } else {
        await ledgerService.refundReservedPayoutInTransaction({
          userId: payout.userId,
          payoutId: payout.id,
          amountCents,
          currencyCode: payout.currencyCode,
          reason: `Provider observation recovered payout as ${classification.desiredStatus.toLowerCase()}.`
        }, client);
      }

      const updated = await payouts.update(payout.id, {
        status: classification.desiredStatus,
        failureReason: classification.desiredStatus === PAYOUT_STATUS.SUCCESS
          ? null
          : observation.payload.issueCode || `Provider reported ${observation.providerStatus}.`,
        processedAt: now(),
        paypalPayoutItemId: observation.provider === 'paypal'
          ? observation.payload.providerItemId || payout.paypalPayoutItemId
          : payout.paypalPayoutItemId,
        metadata: recoveredMetadata(payout, observation)
      }, client);
      await ledgerService.assertWalletLedgerInvariant(evidence.walletReconciliation.walletId, client);
      await paymentOpsIssueService.syncPayoutIssues(updated, client);
      await auditLogService.log({
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: null,
        action: 'payout.provider_observation_recovered',
        entityType: 'payout',
        entityId: payout.id,
        metadata: {
          observation_id: observation.id,
          provider: observation.provider,
          provider_status: observation.providerStatus,
          recovered_status: classification.desiredStatus,
          correlation_id: observation.correlationId
        }
      }, client);
      await inboxRepository.markConsumed({
        id: observation.id,
        consumedAt: now(),
        consumedBy: 'provider-operation-recovery-service'
      }, client);

      return {
        observationId,
        payoutId: observation.aggregateId,
        outcome: RECOVERY_OUTCOME.SAFE_TO_COMPLETE,
        reason: classification.reason
      };
    });
  }

  async function recoverPending(options = {}) {
    const observations = await inboxRepository.findUnconsumed({
      aggregateType: 'payout',
      limit: options.limit
    });
    const results = [];
    for (const observation of observations) {
      results.push(await recoverObservation(observation.id));
    }
    return results;
  }

  return { recoverObservation, recoverPending };
}

module.exports = {
  RECOVERY_OUTCOME,
  classifyObservation,
  createProviderOperationRecoveryService,
  providerOperationRecoveryService: createProviderOperationRecoveryService()
};