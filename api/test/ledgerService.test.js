const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-ledger-service-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'ledger-service-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'ledger-service-webhook';

const { close, db, transaction } = require('../db');
const { migrate } = require('../db/migrate');
const { ledgerService } = require('../services/ledgerService');
const { paypalPayoutService } = require('../services/paypalPayoutService');
const { riskService } = require('../services/riskService');
const { reconciliationTimelineService } = require('../services/reconciliationTimelineService');
const { walletRepository } = require('../repositories/walletRepository');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { userRepository } = require('../repositories/userRepository');

async function createUser(userId) {
  await userRepository.upsert({
    id: userId,
    email: `${userId}@ledger-service.example.com`,
    displayName: userId,
    countryCode: 'US'
  });
}

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('ledger reconciliation utility detects matching and mismatched wallet buckets', async () => {
  await createUser('ledger-reconcile-user');
  await ledgerService.creditPendingFromInvoice({
    userId: 'ledger-reconcile-user',
    invoiceId: 'inv-ledger-reconcile-1',
    amountCents: 1250,
    currencyCode: 'USD',
    eventId: 'event-ledger-reconcile-1'
  });

  const wallet = await walletRepository.findByUserId('ledger-reconcile-user');
  const reconciled = await ledgerService.verifyWalletLedgerInvariant(wallet.id);
  assert.equal(reconciled.reconciled, true);
  assert.deepEqual(reconciled.mismatches, []);

  await db.run('UPDATE wallets SET available_balance_cents = available_balance_cents + 1 WHERE id = ?', [wallet.id]);
  const mismatched = await ledgerService.verifyWalletLedgerInvariant(wallet.id);
  assert.equal(mismatched.reconciled, false);
  assert.equal(mismatched.mismatches.length, 1);
  assert.equal(mismatched.mismatches[0].bucket, 'AVAILABLE');

  await assert.rejects(
    () => ledgerService.assertWalletLedgerInvariant(wallet.id),
    (error) => error.statusCode === 500 && error.code === 'WALLET_LEDGER_RECONCILIATION_FAILED'
  );
});

test('wallet opening balances are ledger-backed, idempotent, and reject changed seed values', async () => {
  const userId = 'ledger-opening-balance-user';
  await createUser(userId);
  const input = {
    userId,
    currencyCode: 'USD',
    pendingBalanceCents: 100,
    availableBalanceCents: 2500,
    frozenBalanceCents: 200,
    paidOutBalanceCents: 300
  };

  const first = await transaction((client) =>
    ledgerService.seedWalletOpeningBalancesInTransaction(input, client)
  );
  const repeated = await transaction((client) =>
    ledgerService.seedWalletOpeningBalancesInTransaction(input, client)
  );
  const reconciliation = await ledgerService.verifyWalletLedgerInvariant(first.id);
  const openingEntries = await db.all(
    "SELECT entry_key, credit_bucket, amount_cents FROM ledger_entries WHERE reference_type = 'BOOTSTRAP' AND reference_id = ? ORDER BY entry_key",
    [userId]
  );

  assert.equal(repeated.id, first.id);
  assert.equal(reconciliation.reconciled, true);
  assert.equal(openingEntries.length, 4);
  assert.deepEqual(openingEntries.map((entry) => entry.amount_cents), [2500, 200, 300, 100]);

  await assert.rejects(
    transaction((client) => ledgerService.seedWalletOpeningBalancesInTransaction({
      ...input,
      availableBalanceCents: 2501
    }, client)),
    (error) => error.statusCode === 409 && error.code === 'WALLET_OPENING_BALANCE_CONFLICT'
  );
  assert.equal((await walletRepository.findByUserId(userId)).availableBalanceCents, 2500);
});

test('invoice payment credit is idempotent across distinct provider paid events', async () => {
  await createUser('ledger-paid-idempotency-user');
  await ledgerService.creditPendingFromInvoice({
    userId: 'ledger-paid-idempotency-user',
    invoiceId: 'inv-ledger-paid-idempotency-1',
    amountCents: 2500,
    currencyCode: 'USD',
    eventId: 'event-paid-first'
  });
  await ledgerService.creditPendingFromInvoice({
    userId: 'ledger-paid-idempotency-user',
    invoiceId: 'inv-ledger-paid-idempotency-1',
    amountCents: 2500,
    currencyCode: 'USD',
    eventId: 'event-paid-second'
  });

  const wallet = await walletRepository.findByUserId('ledger-paid-idempotency-user');
  assert.equal(wallet.pendingBalanceCents, 2500);
  const rows = await db.all(
    `SELECT entry_key, amount_cents, external_reference FROM ledger_entries WHERE reference_id = ? AND type = 'INVOICE_PENDING_CREDIT'`,
    ['inv-ledger-paid-idempotency-1']
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entry_key, 'invoice-paid:inv-ledger-paid-idempotency-1');
  assert.equal(rows[0].external_reference, 'event-paid-first');
});

test('reconciliation recognizes uppercase invoice ledger references and reports wallet drift', async () => {
  await createUser('ledger-reconciliation-service-user');
  const invoice = await invoiceRepository.create({
    userId: 'ledger-reconciliation-service-user',
    paypalInvoiceId: 'paypal-ledger-reconciliation-service-1',
    invoiceNumber: 'INV-LEDGER-RECONCILIATION-1',
    status: 'PAID',
    amountCents: 1500,
    currencyCode: 'USD',
    recipientEmail: 'buyer@example.com',
    invoiceUrl: 'https://paypal.example/invoice/1',
    paypalDetails: {}
  });
  await ledgerService.creditPendingFromInvoice({
    userId: 'ledger-reconciliation-service-user',
    invoiceId: invoice.id,
    amountCents: invoice.amountCents,
    currencyCode: invoice.currencyCode,
    eventId: 'event-ledger-reconciliation-service-paid'
  });

  let result = await reconciliationTimelineService.detectMismatches({ invoiceLimit: 100, payoutLimit: 1, webhookLimit: 1 });
  assert.equal(result.mismatches.some((mismatch) => mismatch.type === 'missing_ledger_credit' && mismatch.entityId === invoice.id), false);

  const wallet = await walletRepository.findByUserId('ledger-reconciliation-service-user');
  await db.run('UPDATE wallets SET pending_balance_cents = pending_balance_cents + 1 WHERE id = ?', [wallet.id]);
  result = await reconciliationTimelineService.detectMismatches({ invoiceLimit: 100, payoutLimit: 1, webhookLimit: 1 });
  assert.equal(result.mismatches.some((mismatch) => mismatch.type === 'wallet_ledger_mismatch' && mismatch.entityId === wallet.id), true);
});

test('split invoice refunds create bucket-accurate idempotent ledger entries', async () => {
  await createUser('ledger-refund-user');
  await ledgerService.creditPendingFromInvoice({
    userId: 'ledger-refund-user',
    invoiceId: 'inv-ledger-refund-1',
    amountCents: 1000,
    currencyCode: 'USD',
    eventId: 'event-ledger-refund-paid'
  });
  await ledgerService.releasePendingFunds({
    userId: 'ledger-refund-user',
    invoiceId: 'inv-ledger-refund-1',
    amountCents: 400,
    currencyCode: 'USD',
    idempotencyKey: 'release-400'
  });

  await ledgerService.adjustForInvoiceRefund({
    userId: 'ledger-refund-user',
    invoiceId: 'inv-ledger-refund-1',
    amountCents: 800,
    currencyCode: 'USD',
    eventId: 'event-ledger-refund-refunded'
  });
  await ledgerService.adjustForInvoiceRefund({
    userId: 'ledger-refund-user',
    invoiceId: 'inv-ledger-refund-1',
    amountCents: 800,
    currencyCode: 'USD',
    eventId: 'event-ledger-refund-refunded'
  });

  const rows = await db.all(
    `SELECT entry_key, debit_bucket, amount_cents FROM ledger_entries WHERE reference_id = ? AND type = 'INVOICE_REFUND_ADJUSTMENT' ORDER BY entry_key`,
    ['inv-ledger-refund-1']
  );
  assert.deepEqual(rows.map((row) => ({ debit_bucket: row.debit_bucket, amount_cents: row.amount_cents })), [
    { debit_bucket: 'AVAILABLE', amount_cents: 200 },
    { debit_bucket: 'PENDING', amount_cents: 600 }
  ]);

  const wallet = await walletRepository.findByUserId('ledger-refund-user');
  assert.equal(wallet.pendingBalanceCents, 0);
  assert.equal(wallet.availableBalanceCents, 200);
  const reconciliation = await ledgerService.verifyWalletLedgerInvariant(wallet.id);
  assert.equal(reconciliation.reconciled, true);
});

test('database triggers reject invalid wallet and ledger bucket persistence', async () => {
  await createUser('ledger-trigger-user');
  const wallet = await transaction((client) => walletRepository.getOrCreate(client, 'ledger-trigger-user', 'USD'));

  await assert.rejects(
    () => db.run('UPDATE wallets SET frozen_balance_cents = -1 WHERE id = ?', [wallet.id]),
    /wallet balance buckets must be non-negative/
  );
  await assert.rejects(
    () => db.run(
      `INSERT INTO ledger_entries (
        id, entry_key, wallet_id, user_id, type, debit_bucket, credit_bucket, amount_cents,
        currency_code, reference_type, reference_id, description, created_at
      ) VALUES ('bad-ledger-entry', 'bad-ledger-entry', ?, ?, 'MANUAL_ADJUSTMENT', NULL, NULL, 0, 'USD', 'TEST', 'TEST', 'bad', ?)` ,
      [wallet.id, 'ledger-trigger-user', new Date().toISOString()]
    ),
    /ledger entry violates bucket invariants/
  );
});

test('payout request rolls back payout row when reservation fails inside the transaction', async () => {
  await createUser('ledger-payout-rollback-user');
  await transaction((client) => walletRepository.seedBalances(client, 'ledger-payout-rollback-user', 'USD', {
    pendingBalanceCents: 0,
    availableBalanceCents: 500,
    frozenBalanceCents: 0,
    paidOutBalanceCents: 0
  }));

  const originalFindById = userRepository.findById;
  userRepository.findById = async (userId, client) => {
    const user = await originalFindById(userId, client);
    return user && {
      ...user,
      wallet: {
        ...user.wallet,
        availableBalanceCents: 100000
      }
    };
  };

  try {
    await assert.rejects(
      () => paypalPayoutService.requestPayout({
        userId: 'ledger-payout-rollback-user',
        idempotencyKey: 'payout-rollback-key',
        recipientType: 'EMAIL',
        receiver: 'rollback@example.com',
        amount: 10,
        currency: 'USD'
      }),
      (error) => error.statusCode === 409 && error.code === 'INSUFFICIENT_AVAILABLE_BALANCE'
    );
  } finally {
    userRepository.findById = originalFindById;
  }

  assert.equal(await payoutRepository.findByIdempotencyKey('payout-rollback-key'), null);
  const wallet = await walletRepository.findByUserId('ledger-payout-rollback-user');
  assert.equal(wallet.availableBalanceCents, 500);
  assert.equal(wallet.frozenBalanceCents, 0);
});

test('approved payout reservation commits with its durable processing event', async () => {
  await createUser('ledger-payout-outbox-user');
  await transaction((client) => walletRepository.seedBalances(client, 'ledger-payout-outbox-user', 'USD', {
    pendingBalanceCents: 0,
    availableBalanceCents: 5000,
    frozenBalanceCents: 0,
    paidOutBalanceCents: 0
  }));

  const originalEvaluatePayout = riskService.evaluatePayout;
  riskService.evaluatePayout = async () => ({ decision: 'APPROVED', flags: [] });
  let payout;
  try {
    payout = await paypalPayoutService.requestPayout({
      userId: 'ledger-payout-outbox-user',
      idempotencyKey: 'payout-outbox-key',
      recipientType: 'EMAIL',
      receiver: 'outbox@example.test',
      amount: 10,
      currency: 'USD'
    });
  } finally {
    riskService.evaluatePayout = originalEvaluatePayout;
  }
  const persisted = await payoutRepository.findById(payout.payout_id);
  const outbox = await db.get(
    'SELECT * FROM outbox_events WHERE semantic_key = ?',
    [`payout:process:${payout.payout_id}`]
  );

  assert.equal(persisted.status, 'QUEUED');
  assert.equal(outbox.status, 'pending');
  assert.equal(JSON.parse(outbox.payload_json).payoutId, payout.payout_id);
  assert.equal(outbox.correlation_id, payout.payout_id);
});