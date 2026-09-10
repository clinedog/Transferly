'use strict';

const { paymentOpsIssueRepository } = require('../repositories/paymentOpsIssueRepository');
const { db } = require('../db');
const { reconciliationTimelineService } = require('./reconciliationTimelineService');

const ISSUE_TYPE = 'PAYOUT_RESERVATION_DISPOSITION_MISMATCH';

async function upsertPayoutDispositionIssue(payoutId, client = db) {
  return reconciliationTimelineService.ensurePayoutDispositionIssue(payoutId, client);
}

async function resolvePayoutDispositionIssue(payoutId, adminActorId, note, client = db) {
  const issue = await paymentOpsIssueRepository.findByUniqueKey(
    'payout',
    payoutId,
    ISSUE_TYPE,
    client
  );

  if (!issue) {
    return null;
  }

  const now = new Date().toISOString();
  const resolved = await paymentOpsIssueRepository.updateById(issue.id, {
    status: 'RESOLVED',
    resolvedAt: now,
    metadata: {
      ...(issue.metadata || {}),
      resolved_at: now,
      resolved_by_actor_id: adminActorId,
      resolution_note: note || null
    }
  }, client);

  return resolved;
}

async function getPayoutDispositionIssue(payoutId, client = db) {
  return paymentOpsIssueRepository.findByUniqueKey(
    'payout',
    payoutId,
    ISSUE_TYPE,
    client
  );
}

module.exports = {
  upsertPayoutDispositionIssue,
  resolvePayoutDispositionIssue,
  getPayoutDispositionIssue
};