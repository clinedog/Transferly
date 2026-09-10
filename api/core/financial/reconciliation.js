'use strict';

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

  const providerAmount = Number(providerTx.amountMinor || providerTx.amount);
  const ledgerAmount = Number(ledgerEntry.amountCents);

  if (providerAmount !== ledgerAmount) {
    discrepancies.push('Amount mismatch: provider=' + providerAmount + ', ledger=' + ledgerAmount);
    details.amountDifference = providerAmount - ledgerAmount;
  }

  const providerCurrency = String(providerTx.currency || '').toUpperCase();
  const ledgerCurrency = String(ledgerEntry.currencyCode || '').toUpperCase();

  if (providerCurrency && ledgerCurrency && providerCurrency !== ledgerCurrency) {
    discrepancies.push('Currency mismatch: provider=' + providerCurrency + ', ledger=' + ledgerCurrency);
  }

  const normalizedProviderStatus = normalizeProviderStatus(providerTx.status);
  const ledgerStatus = ledgerEntry.status;

  if (normalizedProviderStatus !== ledgerStatus) {
    discrepancies.push('Status mismatch: provider=' + normalizedProviderStatus + ', ledger=' + ledgerStatus);
    details.statusDifference = { provider: normalizedProviderStatus, ledger: ledgerStatus };
  }

  return {
    status: discrepancies.length === 0 ? DISCREPANCY_TYPES.MATCH : DISCREPANCY_TYPES.STATUS_MISMATCH,
    discrepancies,
    details
  };
}

function normalizeProviderStatus(status) {
  const s = String(status || '').toUpperCase();
  if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID', 'SETTLED'].includes(s)) return 'SUCCEEDED';
  if (['FAILED', 'DECLINED', 'ERROR', 'REJECTED'].includes(s)) return 'FAILED';
  if (['PENDING', 'PROCESSING', 'SUBMITTED', 'IN_PROGRESS'].includes(s)) return 'PROCESSING';
  if (['CANCELLED', 'CANCELED', 'VOIDED'].includes(s)) return 'CANCELLED';
  return 'UNKNOWN';
}

function createReconciliationCase({ type, referenceId, providerKey, ledgerEntryId, providerTransaction, discrepancy, severity }) {
  return {
    id: 'RC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    type, referenceId, providerKey, ledgerEntryId,
    providerTransaction, discrepancy,
    severity: severity || 'LOW',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    resolvedAt: null, resolution: null
  };
}

module.exports = {
  DISCREPANCY_TYPES,
  compareTransaction,
  normalizeProviderStatus,
  createReconciliationCase
};
