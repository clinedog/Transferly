const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-payout-reconciliation-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'payout-reconciliation-client';
process.env.PAYPAL_CLIENT_SECRET = 'payout-reconciliation-secret';
process.env.PAYPAL_WEBHOOK_ID = 'payout-reconciliation-webhook';

const { close, db, transaction } = require('../db');
const { migrate } = require('../db/migrate');
const { payoutRepository } = require('../repositories/payoutRepository');
const { paymentOpsIssueRepository } = require('../repositories/paymentOpsIssueRepository');
const { userRepository } = require('../repositories/userRepository');
const { ledgerService } = require('../services/ledgerService');
const { reconciliationTimelineService } = require('../services/reconciliationTimelineService');
const { upsertPayoutDispositionIssue, resolvePayoutDispositionIssue, getPayoutDispositionIssue } = require('../services/payoutDispositionReconciliation');
const { BALANCE_BUCKET, LEDGER_ENTRY_TYPE, PAYOUT_STATUS, RISK_DECISION } = require('../utils/constants');

before(migrate);

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

async function createReservedPayout({ id, amountCents = 1000, currencyCode = 'USD' }) {
  const userId = `user-${id}`;
  await userRepository.upsert({
    id: userId,
    email: `${userId}@payout-reconciliation.example.com`,
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
      currencyCode
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

async function updateStatus(payoutId, status) {
  await payoutRepository.update(payoutId, { status });
}

async function insertDisposition(payout, { type, amountCents = payout.amountCents, currencyCode = payout.currencyCode }) {
  const wallet = await db.get('SELECT id FROM wallets WHERE user_id = ?', [payout.userId]);
  const buckets = type === LEDGER_ENTRY_TYPE.PAYOUT_SETTLED
    ? [BALANCE_BUCKET.FROZEN, BALANCE_BUCKET.PAID_OUT]
    : [BALANCE_BUCKET.FROZEN, BALANCE_BUCKET.AVAILABLE];
  await db.run(
    `INSERT INTO ledger_entries (
       id, entry_key, wallet_id, user_id, type, debit_bucket, credit_bucket, amount_cents,
       currency_code, reference_type, reference_id, description, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAYOUT', ?, ?, ?)`,
    [
      randomUUID(),
      `test-disposition:${payout.id}:${randomUUID()}`,
      wallet.id,
      payout.userId,
      type,
      buckets[0],
      buckets[1],
      amountCents,
      currencyCode,
      payout.id,
      'Deliberately inconsistent reconciliation test evidence.',
      new Date().toISOString()
    ]
  );
}

async function findDispositionMismatch(payoutId) {
  const result = await reconciliationTimelineService.detectMismatches({ payoutLimit: 100 });
  return result.mismatches.find((mismatch) =>
    mismatch.type === 'payout_reservation_disposition_mismatch' && mismatch.entityId === payoutId
  );
}

test('accepts one matching settlement for a successful payout', async () => {
  const payout = await createReservedPayout({ id: 'valid-settlement' });
  await ledgerService.settlePayout({
    userId: payout.userId,
    payoutId: payout.id,
    amountCents: payout.amountCents,
    currencyCode: payout.currencyCode
  });
  await updateStatus(payout.id, PAYOUT_STATUS.SUCCESS);

  assert.equal(await findDispositionMismatch(payout.id), undefined);
});

test('accepts one matching release for a failed payout', async () => {
  const payout = await createReservedPayout({ id: 'valid-release' });
  await ledgerService.refundReservedPayout({
    userId: payout.userId,
    payoutId: payout.id,
    amountCents: payout.amountCents,
    currencyCode: payout.currencyCode,
    reason: 'Provider rejected payout.'
  });
  await updateStatus(payout.id, PAYOUT_STATUS.FAILED);

  assert.equal(await findDispositionMismatch(payout.id), undefined);
});

test('flags missing, duplicate, contradictory, mismatched, and status-incompatible dispositions', async () => {
  const cases = [
    {
      id: 'missing-disposition',
      status: PAYOUT_STATUS.SUCCESS,
      arrange: async () => {}
    },
    {
      id: 'duplicate-disposition',
      status: PAYOUT_STATUS.SUCCESS,
      arrange: async (payout) => {
        await insertDisposition(payout, { type: LEDGER_ENTRY_TYPE.PAYOUT_SETTLED });
        await insertDisposition(payout, { type: LEDGER_ENTRY_TYPE.PAYOUT_SETTLED });
      }
    },
    {
      id: 'contradictory-disposition',
      status: PAYOUT_STATUS.SUCCESS,
      arrange: async (payout) => {
        await insertDisposition(payout, { type: LEDGER_ENTRY_TYPE.PAYOUT_SETTLED });
        await insertDisposition(payout, { type: LEDGER_ENTRY_TYPE.PAYOUT_RELEASE_REFUND });
      }
    },
    {
      id: 'amount-mismatch',
      status: PAYOUT_STATUS.SUCCESS,
      arrange: (payout) => insertDisposition(payout, {
        type: LEDGER_ENTRY_TYPE.PAYOUT_SETTLED,
        amountCents: payout.amountCents - 1
      })
    },
    {
      id: 'currency-mismatch',
      status: PAYOUT_STATUS.SUCCESS,
      arrange: (payout) => insertDisposition(payout, {
        type: LEDGER_ENTRY_TYPE.PAYOUT_SETTLED,
        currencyCode: 'EUR'
      })
    },
    {
      id: 'status-incompatible',
      status: PAYOUT_STATUS.PROCESSING,
      arrange: (payout) => insertDisposition(payout, { type: LEDGER_ENTRY_TYPE.PAYOUT_SETTLED })
    }
  ];

  for (const testCase of cases) {
    const payout = await createReservedPayout({ id: testCase.id });
    await testCase.arrange(payout);
    await updateStatus(payout.id, testCase.status);
    const mismatch = await findDispositionMismatch(payout.id);
    assert.ok(mismatch, `${testCase.id} should produce a reconciliation mismatch`);
    assert.equal(mismatch.severity, testCase.status === PAYOUT_STATUS.PROCESSING ? 'high' : 'critical');
  }
});

test('persists one deterministic operations issue and resolves it after repair', async () => {
  const payout = await createReservedPayout({ id: 'persisted-disposition-issue' });
  await updateStatus(payout.id, PAYOUT_STATUS.SUCCESS);

  await findDispositionMismatch(payout.id);
  await findDispositionMismatch(payout.id);

  const openIssues = await paymentOpsIssueRepository.findMany({
    entityType: 'payout',
    status: 'OPEN'
  });
  const matchingIssues = openIssues.filter((issue) =>
    issue.entityId === payout.id && issue.issueType === 'PAYOUT_RESERVATION_DISPOSITION_MISMATCH'
  );
  assert.equal(matchingIssues.length, 1);
  assert.equal(matchingIssues[0].severity, 'CRITICAL');
  assert.equal(matchingIssues[0].metadata.settlement_count, 0);

  await ledgerService.settlePayout({
    userId: payout.userId,
    payoutId: payout.id,
    amountCents: payout.amountCents,
    currencyCode: payout.currencyCode
  });
  assert.equal(await findDispositionMismatch(payout.id), undefined);

  const resolved = await paymentOpsIssueRepository.findByUniqueKey(
    'payout',
    payout.id,
    'PAYOUT_RESERVATION_DISPOSITION_MISMATCH'
  );
  assert.equal(resolved.id, matchingIssues[0].id);
  assert.equal(resolved.status, 'RESOLVED');
  assert.ok(resolved.resolvedAt);
});