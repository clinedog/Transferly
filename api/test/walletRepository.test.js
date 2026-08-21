const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-wallet-repository-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'wallet-repository-client';
process.env.PAYPAL_CLIENT_SECRET = 'wallet-secret';
process.env.PAYPAL_WEBHOOK_ID = 'wallet-repository-webhook';

const { close, db, transaction } = require('../db');
const { migrate } = require('../db/migrate');
const {
  normalizeBalanceCents,
  walletRepository
} = require('../repositories/walletRepository');
const { userRepository } = require('../repositories/userRepository');

async function createUser(userId) {
  await userRepository.upsert({
    id: userId,
    email: `${userId}@wallet-repository.example.com`,
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

test('normalizeBalanceCents accepts only non-negative integer cents', () => {
  assert.equal(normalizeBalanceCents('availableBalanceCents', 0), 0);
  assert.equal(normalizeBalanceCents('availableBalanceCents', '42'), 42);

  for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Infinity]) {
    assert.throws(
      () => normalizeBalanceCents('availableBalanceCents', invalid),
      (error) => error.statusCode === 400 && error.code === 'INVALID_WALLET_BALANCE'
    );
  }
});

test('walletRepository refuses to persist negative or non-integer bucket values', async () => {
  await createUser('wallet-integrity-user');
  const wallet = await transaction((client) => walletRepository.getOrCreate(client, 'wallet-integrity-user', 'USD'));

  await assert.rejects(
    transaction((client) => walletRepository.updateBalances(client, wallet.id, { availableBalanceCents: -1 })),
    (error) => error.statusCode === 400 && error.code === 'INVALID_WALLET_BALANCE'
  );
  await assert.rejects(
    transaction((client) => walletRepository.updateBalances(client, wallet.id, { pendingBalanceCents: 10.25 })),
    (error) => error.statusCode === 400 && error.code === 'INVALID_WALLET_BALANCE'
  );

  const persisted = await walletRepository.findByUserId('wallet-integrity-user', db);
  assert.equal(persisted.availableBalanceCents, 0);
  assert.equal(persisted.pendingBalanceCents, 0);
});

test('walletRepository persists valid bucket updates unchanged', async () => {
  const wallet = await walletRepository.findByUserId('wallet-integrity-user', db);
  const updated = await transaction((client) => walletRepository.updateBalances(client, wallet.id, {
    pendingBalanceCents: 100,
    availableBalanceCents: 200,
    frozenBalanceCents: 50,
    paidOutBalanceCents: 25
  }));

  assert.equal(updated.pendingBalanceCents, 100);
  assert.equal(updated.availableBalanceCents, 200);
  assert.equal(updated.frozenBalanceCents, 50);
  assert.equal(updated.paidOutBalanceCents, 25);
});