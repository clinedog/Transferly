const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { AppError } = require('../utils/errors');

const BALANCE_FIELDS = Object.freeze({
  pendingBalanceCents: 'pending_balance_cents',
  availableBalanceCents: 'available_balance_cents',
  frozenBalanceCents: 'frozen_balance_cents',
  paidOutBalanceCents: 'paid_out_balance_cents'
});

function normalizeBalanceCents(fieldName, value) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new AppError(
      400,
      'INVALID_WALLET_BALANCE',
      'Wallet balance buckets must be non-negative integer cents.',
      { field: fieldName }
    );
  }

  return amount;
}

function mapWallet(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    currencyCode: row.currency_code,
    pendingBalanceCents: row.pending_balance_cents,
    availableBalanceCents: row.available_balance_cents,
    frozenBalanceCents: row.frozen_balance_cents,
    paidOutBalanceCents: row.paid_out_balance_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findByUserId(userId, client = db) {
  const row = await client.get('SELECT * FROM wallets WHERE user_id = ?', [userId]);
  return mapWallet(row);
}

async function getOrCreate(client, userId, currencyCode) {
  const existing = await findByUserId(userId, client);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  await client.run(
    `
      INSERT INTO wallets (
        id, user_id, currency_code, pending_balance_cents, available_balance_cents,
        frozen_balance_cents, paid_out_balance_cents, created_at, updated_at
      ) VALUES (?, ?, ?, 0, 0, 0, 0, ?, ?)
    `,
    [randomUUID(), userId, currencyCode, now, now]
  );

  return findByUserId(userId, client);
}

async function updateBalances(client, walletId, balances) {
  const fields = [];
  const params = [];

  for (const [fieldName, columnName] of Object.entries(BALANCE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(balances, fieldName)) {
      fields.push(`${columnName} = ?`);
      params.push(normalizeBalanceCents(fieldName, balances[fieldName]));
    }
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString(), walletId);

  await client.run(`UPDATE wallets SET ${fields.join(', ')} WHERE id = ?`, params);
  const row = await client.get('SELECT * FROM wallets WHERE id = ?', [walletId]);
  return mapWallet(row);
}

async function seedBalances(client, userId, currencyCode, balances) {
  const wallet = await getOrCreate(client, userId, currencyCode);
  return updateBalances(client, wallet.id, {
    pendingBalanceCents: balances.pendingBalanceCents,
    availableBalanceCents: balances.availableBalanceCents,
    frozenBalanceCents: balances.frozenBalanceCents,
    paidOutBalanceCents: balances.paidOutBalanceCents
  });
}

module.exports = {
  BALANCE_FIELDS,
  normalizeBalanceCents,
  walletRepository: {
    findByUserId,
    getOrCreate,
    updateBalances,
    seedBalances
  }
};
