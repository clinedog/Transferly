'use strict';

const { AppError } = require('../../utils/errors');
const {
  TRANSACTION_TYPE,
  normalizeTransactionType,
  normalizePaymentMethod
} = require('./providerContract');

function supportsFilteredValue(caps, valuesKey, scopeKey, value, allowAllValuesKey) {
  if (!value) return { eligible: true, reason: null };
  const values = caps[valuesKey] || [];
  const scope = caps[scopeKey] ||
    (Array.isArray(values) && values.length > 0 ? 'allowlist' : 'unspecified');
  if (scope === 'global') return { eligible: true, reason: null };
  if (scope === 'allowlist') {
    const normalized = String(value).trim().toUpperCase();
    return { eligible: values.some((entry) => String(entry).trim().toUpperCase() === normalized), reason: null };
  }
  // 'unspecified' scope: absence of a declaration is not coverage. The
  // provider must explicitly declare support before it can be selected.
  return {
    eligible: Boolean(caps[allowAllValuesKey]),
    reason: 'Provider has not declared support for the requested scope.'
  };
}

function capabilityKeyForTransactionType(transactionType) {
  const normalized = normalizeTransactionType(transactionType) || TRANSACTION_TYPE.PAYMENT;
  const legacyMap = {
    [TRANSACTION_TYPE.PAYMENT]: 'payments',
    [TRANSACTION_TYPE.INVOICE_PAYMENT]: 'invoices',
    [TRANSACTION_TYPE.PAYMENT_LINK]: 'payment_links',
    [TRANSACTION_TYPE.TRANSFER]: 'transfers',
    [TRANSACTION_TYPE.PAYOUT]: 'payouts',
    [TRANSACTION_TYPE.REFUND]: 'refunds',
    [TRANSACTION_TYPE.SUBSCRIPTION]: 'subscriptions',
    [TRANSACTION_TYPE.TOP_UP]: 'payments'
  };

  return legacyMap[normalized] || 'payments';
}

function capabilityPassesForTransactionType(caps, transactionType) {
  const requiredCapability = capabilityKeyForTransactionType(transactionType);
  if (!requiredCapability) return true;

  // Explicit capability keys carry the canonical semantics. We never fold an
  // unrelated capability into a requested transaction type.
  const supported = Boolean(caps[requiredCapability]);
  if (supported) return true;

  const aliasMap = {
    payments: ['payments', 'cardPayments', 'walletPayments'],
    invoices: ['invoices', 'invoicePayments'],
    payment_links: ['payment_links', 'hostedPaymentLinks'],
    transfers: ['transfers'],
    payouts: ['payouts'],
    refunds: ['refunds'],
    subscriptions: ['subscriptions']
  };

  const aliases = aliasMap[requiredCapability] || [];
  return aliases.some((alias) => Boolean(caps[alias]));
}

// A canonical payment method may be advertised in the capability map either by
// its canonical key (card, wallet, bank_transfer) or by a legacy adapter key
// (cardPayments, walletPayments, bankTransfer). A provider is eligible for the
// requested method only when at least one matching key is explicitly true. The
// canonical method is never implied from an unrelated capability.
const PAYMENT_METHOD_CAPABILITY_KEYS = Object.freeze({
  card: ['card', 'cardPayments', 'card_payments'],
  bank_transfer: ['bank_transfer', 'bank_transfer_payment', 'bankTransfer'],
  mobile_money: ['mobile_money', 'mobile_money_payment', 'mobileMoney'],
  ussd: ['ussd', 'ussd_payment'],
  qr: ['qr', 'qr_payment', 'qrPayments'],
  wallet: ['wallet', 'wallet_payment', 'walletPayments', 'wallet_payments'],
  direct_debit: ['direct_debit', 'direct_debit_payment', 'directDebit'],
  bnpl: ['bnpl', 'bnpl_payment']
});

function capabilityPassesForPaymentMethod(caps, canonicalMethod) {
  if (!canonicalMethod) return true;
  const keys = PAYMENT_METHOD_CAPABILITY_KEYS[canonicalMethod] || [canonicalMethod];
  return keys.some((key) => Boolean(caps[key]));
}
function selectBestProvider({ country, currency, paymentMethod, transactionType, providers }) {
  if (!providers || providers.length === 0) {
    throw new AppError(400, 'NO_PROVIDERS_AVAILABLE', 'No payment providers available.');
  }

  const normalizedPaymentMethod = paymentMethod ? normalizePaymentMethod(paymentMethod) : null;
  const normalizedTransactionType = normalizeTransactionType(transactionType) || TRANSACTION_TYPE.PAYMENT;
  const candidates = [];

  for (const provider of providers) {
    const caps = provider.getCapabilities();
    if (!capabilityPassesForTransactionType(caps, normalizedTransactionType)) continue;
    const countryCheck = supportsFilteredValue(caps, 'supportedCountries', 'countryScope', country, 'supportsAllCountries');
    if (!countryCheck.eligible) continue;
    const currencyCheck = supportsFilteredValue(caps, 'supportedCurrencies', 'currencyScope', currency, 'supportsAllCurrencies');
    if (!currencyCheck.eligible) continue;
    if (!capabilityPassesForPaymentMethod(caps, normalizedPaymentMethod)) continue;
    candidates.push(provider);
  }

  if (candidates.length === 0) {
    throw new AppError(400, 'NO_SUITABLE_PROVIDER', 'No provider supports the requested country, currency, and payment method.', { country, currency, paymentMethod: normalizedPaymentMethod, transactionType: normalizedTransactionType });
  }

  candidates.sort((a, b) => a.getOrder() - b.getOrder());

  return {
    provider: candidates[0],
    decision: {
      selectedProvider: candidates[0].getKey(),
      candidateCount: candidates.length,
      country, currency, paymentMethod: normalizedPaymentMethod, transactionType: normalizedTransactionType,
      timestamp: new Date().toISOString()
    }
  };
}

function filterByCapability(providers, capability) {
  return providers.filter(p => {
    const caps = p.getCapabilities ? p.getCapabilities() : p.capabilities;
    return caps && caps[capability] === true;
  });
}

function validateCapabilities(provider, requiredCapabilities) {
  const caps = provider.getCapabilities ? provider.getCapabilities() : provider.capabilities;
  const missing = requiredCapabilities.filter(c => !caps || caps[c] !== true);
  return { valid: missing.length === 0, missing };
}

module.exports = {
  selectBestProvider,
  filterByCapability,
  validateCapabilities
};
