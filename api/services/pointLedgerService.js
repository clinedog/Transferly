const { transaction } = require('../db');
const { pointTransactionRepository } = require('../repositories/pointTransactionRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { AppError } = require('../utils/errors');

function normalizeDelta(amount) {
  const delta = Number(amount);
  if (!Number.isSafeInteger(delta) || delta === 0) {
    throw new AppError(400, 'INVALID_POINT_DELTA', 'Point adjustment must be a non-zero integer.');
  }
  return delta;
}

function normalizeEntryKey(entryKey) {
  const normalized = typeof entryKey === 'string' ? entryKey.trim() : '';
  if (!normalized || normalized.length > 200) {
    throw new AppError(
      400,
      'INVALID_POINT_ENTRY_KEY',
      'Point ledger entry key must be between 1 and 200 characters.'
    );
  }
  return normalized;
}

async function getReconciliation(userId, client) {
  const profile = await profileRepository.findByUserId(userId, client);

  if (!profile) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'User profile not found.');
  }

  const ledgerBalance = await pointTransactionRepository.getBalanceByUserId(userId, client);

  const projectionBalance = Number(profile.points || 0);
  return {
    userId,
    profile,
    ledgerBalance,
    projectionBalance,
    difference: projectionBalance - ledgerBalance,
    reconciled: projectionBalance === ledgerBalance
  };
}

async function getBalance(userId, client) {
  const reconciliation = await getReconciliation(userId, client);
  assertReconciled(reconciliation);
  return reconciliation.ledgerBalance;
}

async function recordEvent(input, client) {
  const amount = Number(input.amount ?? 0);
  if (!Number.isSafeInteger(amount) || amount !== 0) {
    throw new AppError(400, 'INVALID_POINT_EVENT_AMOUNT', 'Point ledger events must have a zero amount.');
  }

  const entryKey = normalizeEntryKey(input.entryKey);
  const normalizedInput = { ...input, entryKey, amount: 0 };
  const existing = await pointTransactionRepository.findByEntryKey(entryKey, client);
  if (existing) {
    await pointTransactionRepository.create(normalizedInput, client);
    const reconciliation = await getReconciliation(input.userId, client);
    assertReconciled(reconciliation);
    return {
      applied: false,
      entry: existing,
      profile: reconciliation.profile,
      balance: reconciliation.ledgerBalance
    };
  }

  const reconciliation = await getReconciliation(input.userId, client);
  assertReconciled(reconciliation);
  const entry = await pointTransactionRepository.create(
    {
      ...normalizedInput,
      balanceAfter: reconciliation.ledgerBalance
    },
    client
  );

  return {
    applied: true,
    entry,
    profile: reconciliation.profile,
    balance: reconciliation.ledgerBalance
  };
}

async function reconcileProjection(userId, client) {
  const before = await getReconciliation(userId, client);
  if (before.reconciled) {
    return {
      changed: false,
      before,
      after: before,
      profile: before.profile,
      balance: before.ledgerBalance
    };
  }

  if (!Number.isSafeInteger(before.ledgerBalance) || before.ledgerBalance < 0) {
    throw new AppError(
      409,
      'POINT_LEDGER_BALANCE_INVALID',
      'Point ledger balance cannot be projected because it is invalid.'
    );
  }

  const profile = await profileRepository.setPointProjection(userId, before.ledgerBalance, client);
  if (!profile) {
    throw new AppError(409, 'POINT_BALANCE_UPDATE_FAILED', 'Point balance projection could not be reconciled.');
  }

  const after = await getReconciliation(userId, client);
  assertReconciled(after);
  return {
    changed: true,
    before,
    after,
    profile,
    balance: after.ledgerBalance
  };
}

function assertReconciled(reconciliation) {
  if (!reconciliation.reconciled) {
    throw new AppError(
      409,
      'POINT_LEDGER_OUT_OF_BALANCE',
      'Point balance does not match the append-only ledger. Reconciliation is required.'
    );
  }
}

async function applyEntry(input, client) {
  const delta = normalizeDelta(input.amount);
  const entryKey = normalizeEntryKey(input.entryKey);
  const normalizedInput = { ...input, entryKey, amount: delta };
  const existing = await pointTransactionRepository.findByEntryKey(entryKey, client);

  if (existing) {
    await pointTransactionRepository.create(normalizedInput, client);
    const reconciliation = await getReconciliation(input.userId, client);
    assertReconciled(reconciliation);
    return {
      applied: false,
      entry: existing,
      profile: reconciliation.profile,
      balance: reconciliation.ledgerBalance
    };
  }

  const before = await getReconciliation(input.userId, client);
  assertReconciled(before);
  const balanceAfter = before.ledgerBalance + delta;
  if (balanceAfter < 0) {
    throw new AppError(400, 'INSUFFICIENT_POINTS', 'Point adjustment would make the balance negative.');
  }

  const entry = await pointTransactionRepository.create(
    {
      ...normalizedInput,
      balanceAfter
    },
    client
  );
  const profile = await profileRepository.applyPointDelta(input.userId, delta, client);
  if (!profile) {
    throw new AppError(409, 'POINT_BALANCE_UPDATE_FAILED', 'Point balance projection could not be updated.');
  }

  const after = await getReconciliation(input.userId, client);
  assertReconciled(after);
  return {
    applied: true,
    entry,
    profile,
    balance: after.ledgerBalance
  };
}

async function applyEntryInTransaction(input) {
  return transaction((client) => applyEntry(input, client));
}

async function reconcileProjectionInTransaction(userId) {
  return transaction((client) => reconcileProjection(userId, client));
}

module.exports = {
  pointLedgerService: {
    applyEntry,
    applyEntryInTransaction,
    getBalance,
    getReconciliation,
    reconcileProjection,
    reconcileProjectionInTransaction,
    recordEvent
  }
};
