const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-provider-recovery-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');

const { close, db, transaction } = require('../db');
const { migrate } = require('../db/migrate');
const { auditLogRepository } = require('../repositories/auditLogRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { providerOperationInboxRepository } = require('../repositories/providerOperationInboxRepository');
const { userRepository } = require('../repositories/userRepository');
const { walletRepository } = require('../repositories/walletRepository');
const { ledgerService } = require('../services/ledgerService');
const { providerOperationInboxService } = require('../services/providerOperationInboxService');
const {
  RECOVERY_OUTCOME,
  createProviderOperationRecoveryService
} = require('../services/providerOperationRecoveryService');
const { PAYOUT_STATUS, RISK_DECISION } = require('../utils/constants');

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

async function createReservedPayout({ id, provider = 'stripe', amountCents = 1250, currencyCode = 'USD' }) {
  const userId = `user-${id}`;
  await userRepository.upsert({
    id: userId,
    email: `${userId}@provider-recovery.example.com`,
    displayName: userId,
    countryCode: 'US'
  });
  await ledgerService.creditPendingFromInvoice({
    userId,
    invoiceId: `opening-${id}`,
    amountCents: 5000,
    currencyCode,
    eventId: `opening-event-${id}`
  });
  await ledgerService.releasePendingFunds({
    userId,
    invoiceId: `opening-${id}`,
    amountCents: 5000,
    currencyCode,
    idempotencyKey: `opening-release-${id}`
  });

  return transaction(async (client) => {
    const payout = await payoutRepository.create({
      id,
      userId,
      idempotencyKey: `idempotency-${id}`,
      senderBatchId: `batch-${id}`,
      status: PAYOUT_STATUS.PROCESSING,
      riskDecision: RISK_DECISION.APPROVED,
      recipientType: 'EMAIL',
      receiver: `${userId}@example.com`,
      amountCents,
      currencyCode,
      metadata: {
        provider,
        pricing: { total_debit_cents: amountCents }
      }
    }, client);
    await ledgerService.reservePayoutFundsInTransaction({
      userId,
      payoutId: id,
      amountCents,
      currencyCode
    }, client);
    return payout;
  });
}

async function recordObservation(payout, overrides = {}) {
  const provider = payout.metadata.provider;
  const resourceId = overrides.providerResourceId || `${provider}-resource-${payout.id}`;
  return providerOperationInboxService.recordPayoutObservation({
    provider,
    payoutId: payout.id,
    source: 'poll',
    providerResourceType: provider === 'stripe' ? 'transfer' : 'payout_item',
    providerResourceId: resourceId,
    providerStatus: 'SUCCESS',
    providerItemId: resourceId,
    amountCents: payout.amountCents,
    currencyCode: payout.currencyCode,
    correlationId: payout.id,
    ...overrides
  });
}

test('recovery atomically completes a successful provider observation without resubmission', async () => {
  const payout = await createReservedPayout({ id: 'recovery-success-1' });
  const observation = await recordObservation(payout);
  const service = createProviderOperationRecoveryService({
    now: () => '2026-08-20T14:00:00.000Z'
  });

  const result = await service.recoverObservation(observation.id);
  assert.deepEqual(result, {
    observationId: observation.id,
    payoutId: payout.id,
    outcome: RECOVERY_OUTCOME.SAFE_TO_COMPLETE,
    reason: 'deterministic_local_effects_missing'
  });

  const [storedPayout, storedObservation, wallet, ledgerRows, audits] = await Promise.all([
    payoutRepository.findById(payout.id),
    providerOperationInboxRepository.findById(observation.id),
    walletRepository.findByUserId(payout.userId),
    db.all('SELECT entry_key FROM ledger_entries WHERE reference_id = ? ORDER BY entry_key', [payout.id]),
    auditLogRepository.findManyForEntity('payout', payout.id)
  ]);
  assert.equal(storedPayout.status, PAYOUT_STATUS.SUCCESS);
  assert.equal(storedPayout.metadata.provider_transfer_id, observation.providerResourceId);
  assert.equal(storedObservation.consumedBy, 'provider-operation-recovery-service');
  assert.equal(wallet.frozenBalanceCents, 0);
  assert.equal(wallet.paidOutBalanceCents, payout.amountCents);
  assert.deepEqual(ledgerRows.map((row) => row.entry_key), [
    `payout-reserve:${payout.id}`,
    `payout-settle:${payout.id}`
  ]);
  assert.equal(audits.filter((audit) => audit.action === 'payout.provider_observation_recovered').length, 1);
});

test('concurrent recovery converges without duplicate ledger or audit effects', async () => {
  const payout = await createReservedPayout({ id: 'recovery-concurrent-1' });
  const observation = await recordObservation(payout);
  const service = createProviderOperationRecoveryService();

  const results = await Promise.all([
    service.recoverObservation(observation.id),
    service.recoverObservation(observation.id)
  ]);
  assert.deepEqual(results.map((result) => result.outcome), [
    RECOVERY_OUTCOME.SAFE_TO_COMPLETE,
    RECOVERY_OUTCOME.ALREADY_APPLIED
  ]);

  const ledgerCount = await db.get(
    "SELECT COUNT(*) AS count FROM ledger_entries WHERE entry_key = ?",
    [`payout-settle:${payout.id}`]
  );
  const audits = await auditLogRepository.findManyForEntity('payout', payout.id);
  assert.equal(ledgerCount.count, 1);
  assert.equal(audits.filter((audit) => audit.action === 'payout.provider_observation_recovered').length, 1);
});

test('nonterminal observations require refresh without changing financial state', async () => {
  const payout = await createReservedPayout({ id: 'recovery-refresh-1', provider: 'paypal' });
  const observation = await recordObservation(payout, { providerStatus: 'PENDING' });
  const service = createProviderOperationRecoveryService();

  const result = await service.recoverObservation(observation.id);
  assert.equal(result.outcome, RECOVERY_OUTCOME.REFRESH_REQUIRED);
  assert.equal(result.reason, 'provider_status_nonterminal');
  assert.equal((await payoutRepository.findById(payout.id)).status, PAYOUT_STATUS.PROCESSING);
  assert.equal((await providerOperationInboxRepository.findById(observation.id)).consumedAt, null);
  const wallet = await walletRepository.findByUserId(payout.userId);
  assert.equal(wallet.frozenBalanceCents, payout.amountCents);
  assert.equal(wallet.paidOutBalanceCents, 0);
});

test('recovery consumes a terminal observation when all local effects already exist', async () => {
  const payout = await createReservedPayout({ id: 'recovery-applied-1' });
  const observation = await recordObservation(payout);
  await transaction(async (client) => {
    await ledgerService.settlePayoutInTransaction({
      userId: payout.userId,
      payoutId: payout.id,
      amountCents: payout.amountCents,
      currencyCode: payout.currencyCode
    }, client);
    await payoutRepository.update(payout.id, { status: PAYOUT_STATUS.SUCCESS }, client);
    await client.run(
      `INSERT INTO audit_logs (
        id, actor_type, action, entity_type, entity_id, metadata_json, created_at
      ) VALUES (?, 'SYSTEM', 'payout.processed', 'payout', ?, '{}', ?)`,
      [`audit-${payout.id}`, payout.id, new Date().toISOString()]
    );
  });

  const result = await createProviderOperationRecoveryService().recoverObservation(observation.id);
  assert.equal(result.outcome, RECOVERY_OUTCOME.ALREADY_APPLIED);
  assert.equal(result.reason, 'all_local_effects_present');
  assert.equal((await providerOperationInboxRepository.findById(observation.id)).consumedBy,
    'provider-operation-recovery-service');
});

test('recovery refunds a failed payout exactly once', async () => {
  const payout = await createReservedPayout({ id: 'recovery-failed-1', provider: 'paypal' });
  const observation = await recordObservation(payout, {
    providerStatus: 'FAILED',
    issueCode: 'RECEIVER_UNREGISTERED'
  });
  const service = createProviderOperationRecoveryService();

  const result = await service.recoverObservation(observation.id);
  assert.equal(result.outcome, RECOVERY_OUTCOME.SAFE_TO_COMPLETE);
  const wallet = await walletRepository.findByUserId(payout.userId);
  assert.equal(wallet.availableBalanceCents, 5000);
  assert.equal(wallet.frozenBalanceCents, 0);
  assert.equal((await payoutRepository.findById(payout.id)).status, PAYOUT_STATUS.FAILED);
  const refundCount = await db.get(
    'SELECT COUNT(*) AS count FROM ledger_entries WHERE entry_key = ?',
    [`payout-refund:${payout.id}`]
  );
  assert.equal(refundCount.count, 1);
});

test('item-level PayPal recovery does not confuse a stored batch id with the item id', async () => {
  const payout = await createReservedPayout({ id: 'recovery-paypal-item-1', provider: 'paypal' });
  await db.run(
    `INSERT INTO payout_batches (
      id, sender_batch_id, paypal_payout_batch_id, status, batch_currency_code,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'PENDING', 'USD', ?, ?)`,
    ['batch-row-paypal-item-1', payout.senderBatchId, 'paypal-batch-1',
      new Date().toISOString(), new Date().toISOString()]
  );
  await payoutRepository.update(payout.id, { payoutBatchId: 'batch-row-paypal-item-1' });
  const observation = await recordObservation(payout, { providerResourceId: 'paypal-item-1' });

  const result = await createProviderOperationRecoveryService().recoverObservation(observation.id);
  assert.equal(result.outcome, RECOVERY_OUTCOME.SAFE_TO_COMPLETE);
  assert.equal((await payoutRepository.findById(payout.id)).paypalPayoutItemId, 'paypal-item-1');
});

test('missing reservation evidence and contradictory observation data fail closed', async () => {
  const missingReserve = await createReservedPayout({ id: 'recovery-review-1' });
  await db.run('DELETE FROM ledger_entries WHERE entry_key = ?', [`payout-reserve:${missingReserve.id}`]);
  const reviewObservation = await recordObservation(missingReserve);

  const conflictPayout = await createReservedPayout({ id: 'recovery-conflict-1' });
  const conflictObservation = await recordObservation(conflictPayout, { amountCents: 1300 });
  const service = createProviderOperationRecoveryService();

  const review = await service.recoverObservation(reviewObservation.id);
  const conflict = await service.recoverObservation(conflictObservation.id);
  assert.deepEqual(
    { outcome: review.outcome, reason: review.reason },
    { outcome: RECOVERY_OUTCOME.FINANCE_REVIEW, reason: 'reservation_evidence_missing' }
  );
  assert.deepEqual(
    { outcome: conflict.outcome, reason: conflict.reason },
    { outcome: RECOVERY_OUTCOME.CONFLICT, reason: 'amount_or_currency_mismatch' }
  );
  assert.equal((await providerOperationInboxRepository.findById(reviewObservation.id)).consumedAt, null);
  assert.equal((await providerOperationInboxRepository.findById(conflictObservation.id)).consumedAt, null);
});

test('wallet projection drift requires finance review and leaves the observation unconsumed', async () => {
  const payout = await createReservedPayout({ id: 'recovery-wallet-drift-1' });
  const observation = await recordObservation(payout);
  await db.run(
    'UPDATE wallets SET available_balance_cents = available_balance_cents + 1 WHERE user_id = ?',
    [payout.userId]
  );

  const result = await createProviderOperationRecoveryService().recoverObservation(observation.id);
  assert.equal(result.outcome, RECOVERY_OUTCOME.FINANCE_REVIEW);
  assert.equal(result.reason, 'wallet_ledger_drift');
  assert.equal((await providerOperationInboxRepository.findById(observation.id)).consumedAt, null);
  assert.equal((await payoutRepository.findById(payout.id)).status, PAYOUT_STATUS.PROCESSING);
});

test('malformed reservation evidence conflicts even when wallet arithmetic still reconciles', async () => {
  const payout = await createReservedPayout({ id: 'recovery-reserve-evidence-1' });
  const observation = await recordObservation(payout);
  await db.run(
    'UPDATE ledger_entries SET reference_id = ? WHERE entry_key = ?',
    ['different-payout', `payout-reserve:${payout.id}`]
  );

  const wallet = await walletRepository.findByUserId(payout.userId);
  assert.equal((await ledgerService.verifyWalletLedgerInvariant(wallet.id)).reconciled, true);

  const result = await createProviderOperationRecoveryService().recoverObservation(observation.id);
  assert.equal(result.outcome, RECOVERY_OUTCOME.CONFLICT);
  assert.equal(result.reason, 'ledger_evidence_mismatch');
  assert.equal((await providerOperationInboxRepository.findById(observation.id)).consumedAt, null);
  assert.equal((await payoutRepository.findById(payout.id)).status, PAYOUT_STATUS.PROCESSING);
});