const { randomUUID } = require('node:crypto');

const { db, transaction } = require('../db');
const { walletRepository } = require('../repositories/walletRepository');
const { AppError } = require('../utils/errors');
const { ensurePositiveMoney, ensureSameCurrency } = require('../utils/money');
const { BALANCE_BUCKET, LEDGER_ENTRY_TYPE } = require('../utils/constants');

const ledgerBucketToWalletField = Object.freeze({
  [BALANCE_BUCKET.PENDING]: 'pendingBalanceCents',
  [BALANCE_BUCKET.AVAILABLE]: 'availableBalanceCents',
  [BALANCE_BUCKET.FROZEN]: 'frozenBalanceCents',
  [BALANCE_BUCKET.PAID_OUT]: 'paidOutBalanceCents'
});

const ledgerBucketToSqlExpression = Object.freeze({
  [BALANCE_BUCKET.PENDING]: `SUM(CASE WHEN credit_bucket = 'PENDING' THEN amount_cents WHEN debit_bucket = 'PENDING' THEN -amount_cents ELSE 0 END)`,
  [BALANCE_BUCKET.AVAILABLE]: `SUM(CASE WHEN credit_bucket = 'AVAILABLE' THEN amount_cents WHEN debit_bucket = 'AVAILABLE' THEN -amount_cents ELSE 0 END)`,
  [BALANCE_BUCKET.FROZEN]: `SUM(CASE WHEN credit_bucket = 'FROZEN' THEN amount_cents WHEN debit_bucket = 'FROZEN' THEN -amount_cents ELSE 0 END)`,
  [BALANCE_BUCKET.PAID_OUT]: `SUM(CASE WHEN credit_bucket = 'PAID_OUT' THEN amount_cents WHEN debit_bucket = 'PAID_OUT' THEN -amount_cents ELSE 0 END)`
});

function mapWalletRow(row) {
  return row && {
    id: row.id,
    userId: row.user_id,
    currencyCode: row.currency_code,
    pendingBalanceCents: row.pending_balance_cents,
    availableBalanceCents: row.available_balance_cents,
    frozenBalanceCents: row.frozen_balance_cents,
    paidOutBalanceCents: row.paid_out_balance_cents
  };
}

async function findLedgerEntryByKey(client, entryKey) {
  return client.get('SELECT id FROM ledger_entries WHERE entry_key = ?', [entryKey]);
}

async function insertLedgerEntry(client, input) {
  await client.run(
    `
      INSERT INTO ledger_entries (
        id, entry_key, wallet_id, user_id, type, debit_bucket, credit_bucket, amount_cents,
        currency_code, reference_type, reference_id, external_reference, description, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      input.entryKey,
      input.walletId,
      input.userId,
      input.type,
      input.debitBucket || null,
      input.creditBucket || null,
      input.amountCents,
      input.currencyCode,
      input.referenceType,
      input.referenceId,
      input.externalReference || null,
      input.description,
      input.metadata ? JSON.stringify(input.metadata) : null,
      new Date().toISOString()
    ]
  );
}

function assertWalletBucketsNonNegative(wallet) {
  for (const [bucket, fieldName] of Object.entries(ledgerBucketToWalletField)) {
    const amount = Number(wallet[fieldName]);
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new AppError(500, 'LEDGER_WALLET_BUCKET_INVALID', 'Wallet balance bucket invariant failed.', {
        bucket,
        walletId: wallet.id
      });
    }
  }
}

async function getWalletLedgerProjection(walletId, client = db) {
  const row = await client.get(
    `
      SELECT
        COALESCE(${ledgerBucketToSqlExpression[BALANCE_BUCKET.PENDING]}, 0) AS pending_balance_cents,
        COALESCE(${ledgerBucketToSqlExpression[BALANCE_BUCKET.AVAILABLE]}, 0) AS available_balance_cents,
        COALESCE(${ledgerBucketToSqlExpression[BALANCE_BUCKET.FROZEN]}, 0) AS frozen_balance_cents,
        COALESCE(${ledgerBucketToSqlExpression[BALANCE_BUCKET.PAID_OUT]}, 0) AS paid_out_balance_cents
      FROM ledger_entries
      WHERE wallet_id = ?
    `,
    [walletId]
  );

  return {
    pendingBalanceCents: Number(row?.pending_balance_cents || 0),
    availableBalanceCents: Number(row?.available_balance_cents || 0),
    frozenBalanceCents: Number(row?.frozen_balance_cents || 0),
    paidOutBalanceCents: Number(row?.paid_out_balance_cents || 0)
  };
}

function compareWalletToProjection(wallet, projection) {
  const mismatches = [];
  for (const [bucket, fieldName] of Object.entries(ledgerBucketToWalletField)) {
    const walletValue = Number(wallet[fieldName] || 0);
    const ledgerValue = Number(projection[fieldName] || 0);
    if (walletValue !== ledgerValue) {
      mismatches.push({
        bucket,
        walletCents: walletValue,
        ledgerCents: ledgerValue,
        deltaCents: walletValue - ledgerValue
      });
    }
  }
  return mismatches;
}

async function verifyWalletLedgerInvariant(walletId, client = db) {
  const row = await client.get('SELECT * FROM wallets WHERE id = ?', [walletId]);
  const wallet = mapWalletRow(row);
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
  }

  assertWalletBucketsNonNegative(wallet);
  const projection = await getWalletLedgerProjection(walletId, client);
  const mismatches = compareWalletToProjection(wallet, projection);
  return {
    walletId,
    userId: wallet.userId,
    currencyCode: wallet.currencyCode,
    reconciled: mismatches.length === 0,
    wallet,
    ledgerProjection: projection,
    mismatches
  };
}

async function assertWalletLedgerInvariant(walletId, client = db) {
  const reconciliation = await verifyWalletLedgerInvariant(walletId, client);
  if (!reconciliation.reconciled) {
    throw new AppError(500, 'WALLET_LEDGER_RECONCILIATION_FAILED', 'Wallet balances do not reconcile with ledger entries.', {
      walletId,
      mismatches: reconciliation.mismatches
    });
  }
  return reconciliation;
}

async function seedWalletOpeningBalancesInTransaction(input, client) {
  const wallet = await walletRepository.getOrCreate(client, input.userId, input.currencyCode);
  ensureSameCurrency(wallet.currencyCode, input.currencyCode);
  const balances = {
    pendingBalanceCents: Number(input.pendingBalanceCents || 0),
    availableBalanceCents: Number(input.availableBalanceCents || 0),
    frozenBalanceCents: Number(input.frozenBalanceCents || 0),
    paidOutBalanceCents: Number(input.paidOutBalanceCents || 0)
  };
  assertWalletBucketsNonNegative({ ...wallet, ...balances });

  const openingEntries = Object.entries(ledgerBucketToWalletField).map(([bucket, fieldName]) => ({
    bucket,
    fieldName,
    amountCents: balances[fieldName],
    entryKey: `wallet-opening:${input.userId}:${bucket.toLowerCase()}`
  }));
  const existingEntries = await Promise.all(openingEntries.map((entry) =>
    client.get('SELECT * FROM ledger_entries WHERE entry_key = ?', [entry.entryKey])
  ));
  const existingCount = existingEntries.filter(Boolean).length;

  if (existingCount > 0) {
    const evidenceMatches = openingEntries.every((entry, index) => {
      const existing = existingEntries[index];
      if (entry.amountCents === 0) return !existing;
      return existing &&
        existing.wallet_id === wallet.id &&
        existing.user_id === input.userId &&
        existing.type === LEDGER_ENTRY_TYPE.MANUAL_ADJUSTMENT &&
        existing.debit_bucket === null &&
        existing.credit_bucket === entry.bucket &&
        existing.amount_cents === entry.amountCents &&
        existing.currency_code === input.currencyCode &&
        existing.reference_type === 'BOOTSTRAP' &&
        existing.reference_id === input.userId;
    });
    if (!evidenceMatches) {
      throw new AppError(409, 'WALLET_OPENING_BALANCE_CONFLICT', 'Stored wallet opening balances do not match the requested seed balances.');
    }
    await assertWalletLedgerInvariant(wallet.id, client);
    return walletRepository.findByUserId(input.userId, client);
  }

  const ledgerCount = await client.get('SELECT COUNT(*) AS count FROM ledger_entries WHERE wallet_id = ?', [wallet.id]);
  if (Number(ledgerCount?.count || 0) > 0) {
    throw new AppError(409, 'WALLET_OPENING_BALANCE_CONFLICT', 'Cannot seed opening balances after wallet ledger activity exists.');
  }

  const updated = await walletRepository.updateBalances(client, wallet.id, balances);
  for (const entry of openingEntries) {
    if (entry.amountCents === 0) continue;
    await insertLedgerEntry(client, {
      entryKey: entry.entryKey,
      walletId: wallet.id,
      userId: input.userId,
      type: LEDGER_ENTRY_TYPE.MANUAL_ADJUSTMENT,
      creditBucket: entry.bucket,
      amountCents: entry.amountCents,
      currencyCode: input.currencyCode,
      referenceType: 'BOOTSTRAP',
      referenceId: input.userId,
      description: 'Seeded wallet opening balance.',
      metadata: { source: 'bootstrap' }
    });
  }
  await assertWalletLedgerInvariant(wallet.id, client);
  return updated;
}

async function creditPendingFromInvoice(input) {
  return transaction(async (client) => {
    const wallet = await walletRepository.getOrCreate(client, input.userId, input.currencyCode);
    ensureSameCurrency(wallet.currencyCode, input.currencyCode);

    const entryKey = `invoice-paid:${input.invoiceId}`;
    if (await findLedgerEntryByKey(client, entryKey)) {
      return wallet;
    }

    const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
      pendingBalanceCents: wallet.pendingBalanceCents + ensurePositiveMoney(input.amountCents)
    });

    await insertLedgerEntry(client, {
      entryKey,
      walletId: wallet.id,
      userId: input.userId,
      type: LEDGER_ENTRY_TYPE.INVOICE_PENDING_CREDIT,
      creditBucket: BALANCE_BUCKET.PENDING,
      amountCents: input.amountCents,
      currencyCode: input.currencyCode,
      referenceType: 'INVOICE',
      referenceId: input.invoiceId,
      externalReference: input.eventId,
      description: 'Invoice payment credited to pending balance.'
    });

    return nextWallet;
  });
}

async function releasePendingFunds(input) {
  return transaction(async (client) => {
    const wallet = await walletRepository.findByUserId(input.userId, client);
    if (!wallet) {
      throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
    }

    ensureSameCurrency(wallet.currencyCode, input.currencyCode);
    const amountCents = ensurePositiveMoney(input.amountCents);

    const entryKey = `funds-release:${input.invoiceId}:${input.idempotencyKey || amountCents}`;
    if (await findLedgerEntryByKey(client, entryKey)) {
      return wallet;
    }

    if (wallet.pendingBalanceCents < amountCents) {
      throw new AppError(409, 'INSUFFICIENT_PENDING_BALANCE', 'Insufficient pending balance to release funds.');
    }

    const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
      pendingBalanceCents: wallet.pendingBalanceCents - amountCents,
      availableBalanceCents: wallet.availableBalanceCents + amountCents
    });

    await insertLedgerEntry(client, {
      entryKey,
      walletId: wallet.id,
      userId: input.userId,
      type: LEDGER_ENTRY_TYPE.FUNDS_RELEASE,
      debitBucket: BALANCE_BUCKET.PENDING,
      creditBucket: BALANCE_BUCKET.AVAILABLE,
      amountCents,
      currencyCode: input.currencyCode,
      referenceType: 'INVOICE',
      referenceId: input.invoiceId,
      description: 'Released invoice funds from pending to available balance.'
    });

    return nextWallet;
  });
}

async function getReleasedFundsForInvoice(invoiceId, client = db) {
  const row = await client.get(
    `
      SELECT COALESCE(SUM(amount_cents), 0) AS total
      FROM ledger_entries
      WHERE type = ? AND reference_type = 'INVOICE' AND reference_id = ?
    `,
    [LEDGER_ENTRY_TYPE.FUNDS_RELEASE, invoiceId]
  );

  return row ? row.total : 0;
}

async function reservePayoutFunds(input) {
  return transaction(async (client) => {
    return reservePayoutFundsInTransaction(input, client);
  });
}

async function reservePayoutFundsInTransaction(input, client) {
  const wallet = await walletRepository.findByUserId(input.userId, client);
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
  }

  ensureSameCurrency(wallet.currencyCode, input.currencyCode);
  const amountCents = ensurePositiveMoney(input.amountCents);
  const entryKey = `payout-reserve:${input.payoutId}`;
  if (await findLedgerEntryByKey(client, entryKey)) {
    return wallet;
  }

  if (wallet.availableBalanceCents < amountCents) {
    throw new AppError(409, 'INSUFFICIENT_AVAILABLE_BALANCE', 'Insufficient available balance for payout.');
  }

  const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
    availableBalanceCents: wallet.availableBalanceCents - amountCents,
    frozenBalanceCents: wallet.frozenBalanceCents + amountCents
  });

  await insertLedgerEntry(client, {
    entryKey,
    walletId: wallet.id,
    userId: input.userId,
    type: LEDGER_ENTRY_TYPE.PAYOUT_RESERVE,
    debitBucket: BALANCE_BUCKET.AVAILABLE,
    creditBucket: BALANCE_BUCKET.FROZEN,
    amountCents,
    currencyCode: input.currencyCode,
    referenceType: 'PAYOUT',
    referenceId: input.payoutId,
    description: 'Reserved payout funds from available to frozen balance.'
  });

  return nextWallet;
}

async function settlePayout(input) {
  return transaction(async (client) => {
    return settlePayoutInTransaction(input, client);
  });
}

async function settlePayoutInTransaction(input, client) {
  const wallet = await walletRepository.findByUserId(input.userId, client);
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
  }

  ensureSameCurrency(wallet.currencyCode, input.currencyCode);
  const amountCents = ensurePositiveMoney(input.amountCents);
  const entryKey = `payout-settle:${input.payoutId}`;
  if (await findLedgerEntryByKey(client, entryKey)) {
    return wallet;
  }

  if (wallet.frozenBalanceCents < amountCents) {
    throw new AppError(409, 'INSUFFICIENT_FROZEN_BALANCE', 'Insufficient frozen balance to settle payout.');
  }

  const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
    frozenBalanceCents: wallet.frozenBalanceCents - amountCents,
    paidOutBalanceCents: wallet.paidOutBalanceCents + amountCents
  });

  await insertLedgerEntry(client, {
    entryKey,
    walletId: wallet.id,
    userId: input.userId,
    type: LEDGER_ENTRY_TYPE.PAYOUT_SETTLED,
    debitBucket: BALANCE_BUCKET.FROZEN,
    creditBucket: BALANCE_BUCKET.PAID_OUT,
    amountCents,
    currencyCode: input.currencyCode,
    referenceType: 'PAYOUT',
    referenceId: input.payoutId,
    description: 'Settled payout from frozen to paid out balance.'
  });

  return nextWallet;
}

async function refundReservedPayout(input) {
  return transaction(async (client) => {
    return refundReservedPayoutInTransaction(input, client);
  });
}

async function refundReservedPayoutInTransaction(input, client) {
  const wallet = await walletRepository.findByUserId(input.userId, client);
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
  }

  ensureSameCurrency(wallet.currencyCode, input.currencyCode);
  const amountCents = ensurePositiveMoney(input.amountCents);
  const entryKey = `payout-refund:${input.payoutId}`;
  if (await findLedgerEntryByKey(client, entryKey)) {
    return wallet;
  }

  if (wallet.frozenBalanceCents < amountCents) {
    throw new AppError(409, 'INSUFFICIENT_FROZEN_BALANCE', 'Insufficient frozen balance to release payout.');
  }

  const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
    frozenBalanceCents: wallet.frozenBalanceCents - amountCents,
    availableBalanceCents: wallet.availableBalanceCents + amountCents
  });

  await insertLedgerEntry(client, {
    entryKey,
    walletId: wallet.id,
    userId: input.userId,
    type: LEDGER_ENTRY_TYPE.PAYOUT_RELEASE_REFUND,
    debitBucket: BALANCE_BUCKET.FROZEN,
    creditBucket: BALANCE_BUCKET.AVAILABLE,
    amountCents,
    currencyCode: input.currencyCode,
    referenceType: 'PAYOUT',
    referenceId: input.payoutId,
    description: input.reason
  });

  return nextWallet;
}

async function adjustForInvoiceRefund(input) {
  return transaction(async (client) => {
    const wallet = await walletRepository.findByUserId(input.userId, client);
    if (!wallet) {
      throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
    }

    ensureSameCurrency(wallet.currencyCode, input.currencyCode);
    const amountCents = ensurePositiveMoney(input.amountCents);
    const entryKey = `invoice-refund:${input.invoiceId}:${input.eventId}`;
    if (
      await findLedgerEntryByKey(client, `${entryKey}:pending`) ||
      await findLedgerEntryByKey(client, `${entryKey}:available`) ||
      await findLedgerEntryByKey(client, entryKey)
    ) {
      return wallet;
    }

    const pendingReduction = Math.min(wallet.pendingBalanceCents, amountCents);
    const remainingReduction = amountCents - pendingReduction;
    if (wallet.availableBalanceCents < remainingReduction) {
      throw new AppError(409, 'INSUFFICIENT_BALANCE_FOR_REFUND', 'Insufficient balance to apply invoice refund.');
    }

    const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
      pendingBalanceCents: wallet.pendingBalanceCents - pendingReduction,
      availableBalanceCents: wallet.availableBalanceCents - remainingReduction
    });

    if (pendingReduction > 0) {
      await insertLedgerEntry(client, {
        entryKey: `${entryKey}:pending`,
        walletId: wallet.id,
        userId: input.userId,
        type: LEDGER_ENTRY_TYPE.INVOICE_REFUND_ADJUSTMENT,
        debitBucket: BALANCE_BUCKET.PENDING,
        amountCents: pendingReduction,
        currencyCode: input.currencyCode,
        referenceType: 'INVOICE',
        referenceId: input.invoiceId,
        externalReference: input.eventId,
        description: 'Applied invoice refund adjustment to pending balance.',
        metadata: {
          pendingReductionCents: pendingReduction,
          availableReductionCents: remainingReduction
        }
      });
    }

    if (remainingReduction > 0) {
      await insertLedgerEntry(client, {
        entryKey: `${entryKey}:available`,
        walletId: wallet.id,
        userId: input.userId,
        type: LEDGER_ENTRY_TYPE.INVOICE_REFUND_ADJUSTMENT,
        debitBucket: BALANCE_BUCKET.AVAILABLE,
        amountCents: remainingReduction,
        currencyCode: input.currencyCode,
        referenceType: 'INVOICE',
        referenceId: input.invoiceId,
        externalReference: input.eventId,
        description: 'Applied invoice refund adjustment to available balance.',
        metadata: {
          pendingReductionCents: pendingReduction,
          availableReductionCents: remainingReduction
        }
      });
    }

    return nextWallet;
  });
}

module.exports = {
  ledgerService: {
    creditPendingFromInvoice,
    releasePendingFunds,
    getReleasedFundsForInvoice,
    reservePayoutFunds,
    reservePayoutFundsInTransaction,
    settlePayout,
    settlePayoutInTransaction,
    refundReservedPayout,
    refundReservedPayoutInTransaction,
    adjustForInvoiceRefund,
    seedWalletOpeningBalancesInTransaction,
    verifyWalletLedgerInvariant,
    assertWalletLedgerInvariant
  }
};
