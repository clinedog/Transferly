'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BALANCE_BUCKET } = require('../utils/constants');
const { validateLedgerEntry } = require('../core/financial/ledgerContract');

test('accepts balanced bucket transfers and one-sided adjustments', () => {
  const transfer = validateLedgerEntry({
    amountCents: 125,
    currencyCode: 'usd',
    debitBucket: BALANCE_BUCKET.AVAILABLE,
    creditBucket: BALANCE_BUCKET.FROZEN
  });
  const adjustment = validateLedgerEntry({
    amountCents: 25,
    currencyCode: 'USD',
    creditBucket: BALANCE_BUCKET.PENDING
  });

  assert.equal(transfer.currencyCode, 'USD');
  assert.equal(adjustment.debitBucket, null);
});

test('rejects malformed amounts, currencies, and missing buckets', () => {
  assert.throws(
    () => validateLedgerEntry({ amountCents: 0, currencyCode: 'USD', creditBucket: BALANCE_BUCKET.AVAILABLE }),
    (error) => error.code === 'LEDGER_AMOUNT_INVALID'
  );
  assert.throws(
    () => validateLedgerEntry({ amountCents: 1, currencyCode: 'US', creditBucket: BALANCE_BUCKET.AVAILABLE }),
    (error) => error.code === 'LEDGER_CURRENCY_INVALID'
  );
  assert.throws(
    () => validateLedgerEntry({ amountCents: 1, currencyCode: 'USD' }),
    (error) => error.code === 'LEDGER_BUCKET_REQUIRED'
  );
});

test('rejects invalid and self-transfer buckets', () => {
  assert.throws(
    () => validateLedgerEntry({
      amountCents: 1,
      currencyCode: 'USD',
      debitBucket: 'UNKNOWN',
      creditBucket: BALANCE_BUCKET.AVAILABLE
    }),
    (error) => error.code === 'LEDGER_DEBIT_BUCKET_INVALID'
  );
  assert.throws(
    () => validateLedgerEntry({
      amountCents: 1,
      currencyCode: 'USD',
      debitBucket: BALANCE_BUCKET.AVAILABLE,
      creditBucket: BALANCE_BUCKET.AVAILABLE
    }),
    (error) => error.code === 'LEDGER_SELF_TRANSFER_INVALID'
  );
});
