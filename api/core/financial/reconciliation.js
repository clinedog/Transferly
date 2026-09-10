'use strict';

const { randomUUID } = require('node:crypto');

const DISCREPANCY_TYPES = Object.freeze({
  MATCH: 'MATCH',
  MISSING_PROVIDER_TRANSACTION: 'MISSING_PROVIDER_TRANSACTION',
  MISSING_LEDGER_ENTRY: 'MISSING_LEDGER_ENTRY',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  DUPLICATE: 'DUPLICATE',
  STATUS_MISMATCH: 'STATUS_MISMATCH',
  UNKNOWN: 'UNKNOWN'
});

const DISCREPANCY_SEVERITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

function classifySeverity(discrepancies) {
  if (discrepancies.includes('Currency mismatch')) return DISCREPANCY_SEVERITY.HIGH;
  if (discrepancies.includes('Amount mismatch')) return DISCREPANCY_SEVERITY.HIGH;
  return DISCREPANCY_SEVERITY.LOW;
}

function compareTransaction(providerTx, ledgerEntry) {
  const discrepancies = [];
  const details = {};

  if (!providerTx && !ledgerEntry) {
    return { status: DISCREPANCY_TYPES.UNKNOWN, discrepancies: ['Unable to locate transaction'], details };
  }

  if (!providerTx) {
    return { status: DISCREPANCY_TYPES.MISSING_PROVIDER_TRANSACTION, discrepancies: ['Provider record not found'], details };
  }

  if (!ledgerEntry) {
    return { status: DISCREPANCY_TYPES.MISSING_LEDGER_ENTRY, discrepancies: ['Ledger entry not found'], details };
  }

  // Deterministic duplicate detection: a provider transaction that carries a
  // duplicate flag (or a duplicated subscription/idempotency key delivered with
  // duplicate verification) is classified as DUPLICATE, never as a match.
  const providerKey = providerTx.subscriptionKey || providerTx.dedupKey || providerTx.idempotencyKey;
  const ledgerKey = ledgerEntry.subscriptionKey || ledgerEntry.dedupKey || ledgerEntry.idempotencyKey || ledgerEntry.providerTransactionKey;
  if (providerTx.duplicate || providerTx.isDuplicate || (providerKey && ledgerKey && providerKey === ledgerKey && providerTx.duplicateVerification)) {
    return {
      status: DISCREPANCY_TYPES.DUPLICATE,
      discrepancies: ['Provider transaction appears to be a duplicate delivery.'],
      details: { duplicateKey: providerKey || null }
    };
  }

  const providerAmount = Number(providerTx.amountMinor ?? providerTx.amount);
  const ledgerAmount = Number(ledgerEntry.amountCents);

  // Only evaluate amount/currency when both values are present.
  if (Number.isFinite(providerAmount) && Number.isFinite(ledgerAmount)) {
    if (providerAmount !== ledgerAmount) {
      discrepancies.push('Amount mismatch');
      details.amountDifference = providerAmount - ledgerAmount;
      details.providerAmount = providerAmount;
      details.ledgerAmount = ledgerAmount;
    }
  }

  const providerCurrency = String(providerTx.currency || '').toUpperCase();
  const ledgerCurrency = String(ledgerEntry.currencyCode || '').toUpperCase();

  if (providerCurrency && ledgerCurrency && providerCurrency !== ledgerCurrency) {
    discrepancies.push('Currency mismatch');
    details.providerCurrency = providerCurrency;
    details.ledgerCurrency = ledgerCurrency;
  }

  const normalizedProviderStatus = normalizeProviderStatus(providerTx.status);
  const ledgerStatus = ledgerEntry.status;

  if (normalizedProviderStatus === 'UNKNOWN' && ledgerStatus && ledgerStatus !== 'UNKNOWN') {
    // The provider has not confirmed a known terminal state. Unknown must
    // never silently settle, so the reconciliation type is UNKNOWN.
    return {
      status: DISCREPANCY_TYPES.UNKNOWN,
      discrepancies: ['Provider status is unknown and must be verified before this transaction can settle.'],
      details: { providerStatus: providerTx.status, ledgerStatus, ...details }
    };
  }

  if (normalizedProviderStatus !== ledgerStatus) {
    discrepancies.push('Status mismatch');
    details.statusDifference = { provider: normalizedProviderStatus, ledger: ledgerStatus };
  }

  if (discrepancies.length === 0) {
    return { status: DISCREPANCY_TYPES.MATCH, discrepancies, details };
  }

  // Pick the most specific classification instead of lumping every mismatch
  // into STATUS_MISMATCH.
  let status;
  if (discrepancies.includes('Amount mismatch')) status = DISCREPANCY_TYPES.AMOUNT_MISMATCH;
  else if (discrepancies.includes('Currency mismatch')) status = DISCREPANCY_TYPES.CURRENCY_MISMATCH;
  else status = DISCREPANCY_TYPES.STATUS_MISMATCH;

  return { status, discrepancies, details, severity: classifySeverity(discrepancies) };
}

function normalizeProviderStatus(status) {
  const s = String(status || '').toUpperCase();
  if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID', 'SETTLED', 'CAPTURED'].includes(s)) return 'SUCCEEDED';
  if (['FAILED', 'DECLINED', 'ERROR', 'REJECTED', 'DENIED'].includes(s)) return 'FAILED';
  if (['CANCELLED', 'CANCELED', 'VOIDED', 'EXPIRED'].includes(s)) return 'CANCELLED';
  if (['PENDING', 'PROCESSING', 'SUBMITTED', 'IN_PROGRESS', 'QUEUED', 'HELD', 'ONHOLD', 'UNCLAIMED', 'RESERVED', 'AWAITING_CONFIRMATION'].includes(s)) return 'PROCESSING';
  return 'UNKNOWN';
}

function createReconciliationCase({ type, referenceId, providerKey, ledgerEntryId, providerTransaction, discrepancy, severity }) {
  return {
    id: 'RC-' + randomUUID(),
    type,
    referenceId,
    providerKey,
    ledgerEntryId,
    providerTransaction,
    discrepancy,
    severity: severity || classifySeverity(Array.isArray(discrepancy) ? discrepancy : discrepancy ? [discrepancy] : []),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolution: null
  };
}

module.exports = {
  DISCREPANCY_TYPES,
  DISCREPANCY_SEVERITY,
  compareTransaction,
  normalizeProviderStatus,
  createReconciliationCase
};
