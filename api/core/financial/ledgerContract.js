'use strict';

const { AppError } = require('../../utils/errors');
const { BALANCE_BUCKET } = require('../../utils/constants');

const BALANCE_BUCKETS = new Set(Object.values(BALANCE_BUCKET));

function validateLedgerEntry(input = {}) {
  const amountCents = Number(input.amountCents);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new AppError(422, 'LEDGER_AMOUNT_INVALID', 'Ledger amount must be a positive safe integer.');
  }

  const currencyCode = String(input.currencyCode || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new AppError(422, 'LEDGER_CURRENCY_INVALID', 'Ledger currency must be a three-letter ISO code.');
  }

  const debitBucket = input.debitBucket || null;
  const creditBucket = input.creditBucket || null;
  if (!debitBucket && !creditBucket) {
    throw new AppError(422, 'LEDGER_BUCKET_REQUIRED', 'Ledger entry must identify a debit or credit bucket.');
  }
  if (debitBucket && !BALANCE_BUCKETS.has(debitBucket)) {
    throw new AppError(422, 'LEDGER_DEBIT_BUCKET_INVALID', 'Ledger debit bucket is invalid.', { debitBucket });
  }
  if (creditBucket && !BALANCE_BUCKETS.has(creditBucket)) {
    throw new AppError(422, 'LEDGER_CREDIT_BUCKET_INVALID', 'Ledger credit bucket is invalid.', { creditBucket });
  }
  if (debitBucket && creditBucket && debitBucket === creditBucket) {
    throw new AppError(422, 'LEDGER_SELF_TRANSFER_INVALID', 'Ledger entry cannot debit and credit the same bucket.');
  }

  return Object.freeze({
    amountCents,
    currencyCode,
    debitBucket,
    creditBucket
  });
}

module.exports = {
  validateLedgerEntry
};
