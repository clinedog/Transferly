const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-point-ledger-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'point-ledger-client';
process.env.PAYPAL_CLIENT_SECRET = 'point-ledger-secret';
process.env.PAYPAL_WEBHOOK_ID = 'point-ledger-webhook';

const { close, db, transaction } = require('../db');
const { migrate } = require('../db/migrate');
const { pointTransactionRepository } = require('../repositories/pointTransactionRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { userRepository } = require('../repositories/userRepository');
const { pointLedgerService } = require('../services/pointLedgerService');
const { POINT_TRANSACTION_TYPE } = require('../utils/constants');

async function createUser(userId) {
  await userRepository.upsert({
    id: userId,
    email: `${userId}@point-ledger.example.com`,
    displayName: userId,
    countryCode: 'US'
  });
  await profileRepository.upsert({
    userId,
    name: userId,
    points: 0,
    role: 'USER'
  });
}

function entry(overrides = {}) {
  return {
    entryKey: 'point-ledger:credit',
    userId: 'point-ledger-entry-user',
    type: POINT_TRANSACTION_TYPE.ADMIN_ADJUSTMENT,
    amount: 50,
    description: 'Ledger test credit',
    referenceType: 'TEST',
    referenceId: 'credit',
    metadata: { reason: 'test' },
    ...overrides
  };
}

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('applies ledger entries atomically and makes exact retries idempotent', async () => {
  await createUser('point-ledger-entry-user');

  const credited = await pointLedgerService.applyEntryInTransaction(entry());
  assert.equal(credited.applied, true);
  assert.equal(credited.balance, 50);
  assert.equal(credited.entry.balanceAfter, 50);
  assert.equal((await profileRepository.findByUserId('point-ledger-entry-user')).points, 50);

  const retried = await pointLedgerService.applyEntryInTransaction(entry());
  assert.equal(retried.applied, false);
  assert.equal(retried.entry.id, credited.entry.id);
  assert.equal(retried.balance, 50);

  const debited = await pointLedgerService.applyEntryInTransaction(
    entry({
      entryKey: 'point-ledger:debit',
      amount: -20,
      description: 'Ledger test debit',
      referenceId: 'debit'
    })
  );
  assert.equal(debited.balance, 30);
  assert.equal(debited.entry.balanceAfter, 30);

  const rows = await pointTransactionRepository.findByUserId('point-ledger-entry-user');
  assert.equal(rows.length, 2);
  assert.equal((await profileRepository.findByUserId('point-ledger-entry-user')).points, 30);
});

test('rejects reuse of an entry key with changed semantic details', async () => {
  await assert.rejects(
    pointLedgerService.applyEntryInTransaction(entry({ description: 'Changed description' })),
    (error) => error?.statusCode === 409 && error?.code === 'POINT_TRANSACTION_ENTRY_CONFLICT'
  );
  await assert.rejects(
    pointLedgerService.applyEntryInTransaction(entry({ metadata: { reason: 'changed' } })),
    (error) => error?.statusCode === 409 && error?.code === 'POINT_TRANSACTION_ENTRY_CONFLICT'
  );
  assert.equal(await pointLedgerService.getBalance('point-ledger-entry-user'), 30);
});

test('loads authoritative balances for multiple users and defaults missing entries to zero', async () => {
  await createUser('point-ledger-empty-user');

  const balances = await pointTransactionRepository.getBalancesByUserIds([
    'point-ledger-entry-user',
    'point-ledger-empty-user',
    'point-ledger-entry-user'
  ]);

  assert.equal(balances.size, 2);
  assert.equal(balances.get('point-ledger-entry-user'), 30);
  assert.equal(balances.get('point-ledger-empty-user'), 0);
});

test('records zero-value ledger events without changing the balance', async () => {
  const eventInput = {
    entryKey: 'point-ledger:event',
    userId: 'point-ledger-entry-user',
    type: POINT_TRANSACTION_TYPE.POINT_PROJECTION_RECONCILIATION,
    amount: 0,
    description: 'Projection checked',
    referenceType: 'POINT_PROJECTION',
    referenceId: 'point-ledger-entry-user',
    metadata: { adminActorId: 'admin-user' }
  };

  const recorded = await transaction((client) => pointLedgerService.recordEvent(eventInput, client));
  assert.equal(recorded.applied, true);
  assert.equal(recorded.balance, 30);
  assert.equal(recorded.entry.balanceAfter, 30);

  const retried = await transaction((client) => pointLedgerService.recordEvent(eventInput, client));
  assert.equal(retried.applied, false);
  assert.equal(retried.entry.id, recorded.entry.id);
  assert.equal(await pointLedgerService.getBalance('point-ledger-entry-user'), 30);
});

test('fails closed on projection drift and repairs only the projection', async () => {
  await createUser('point-ledger-drift-user');
  await pointLedgerService.applyEntryInTransaction(
    entry({
      entryKey: 'point-ledger:drift-credit',
      userId: 'point-ledger-drift-user',
      amount: 10,
      referenceId: 'drift-credit'
    })
  );
  await db.run('UPDATE profiles SET points = ? WHERE user_id = ?', [9, 'point-ledger-drift-user']);

  await assert.rejects(
    pointLedgerService.getBalance('point-ledger-drift-user'),
    (error) => error?.statusCode === 409 && error?.code === 'POINT_LEDGER_OUT_OF_BALANCE'
  );
  await assert.rejects(
    pointLedgerService.applyEntryInTransaction(
      entry({
        entryKey: 'point-ledger:blocked-debit',
        userId: 'point-ledger-drift-user',
        amount: -1,
        referenceId: 'blocked-debit'
      })
    ),
    (error) => error?.statusCode === 409 && error?.code === 'POINT_LEDGER_OUT_OF_BALANCE'
  );

  const countBefore = await db.get(
    'SELECT COUNT(*) AS count FROM points_transactions WHERE user_id = ?',
    ['point-ledger-drift-user']
  );
  const repaired = await pointLedgerService.reconcileProjectionInTransaction('point-ledger-drift-user');
  const countAfter = await db.get(
    'SELECT COUNT(*) AS count FROM points_transactions WHERE user_id = ?',
    ['point-ledger-drift-user']
  );

  assert.equal(repaired.changed, true);
  assert.equal(repaired.before.projectionBalance, 9);
  assert.equal(repaired.after.projectionBalance, 10);
  assert.equal(repaired.balance, 10);
  assert.equal(countAfter.count, countBefore.count);
  assert.equal(await pointLedgerService.getBalance('point-ledger-drift-user'), 10);
});
