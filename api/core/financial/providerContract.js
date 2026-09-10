'use strict';

/**
 * Canonical Transferly provider contract.
 *
 * Single normalized representation of what a provider supports and how far that
 * support has progressed. Every provider adapter, capability service, routing
 * decision, workspace descriptor, and wallet presentation MUST go through this
 * module so provider-specific formats never leak into the core domain.
 *
 * Capability semantics (MUST NOT be implied):
 * - A provider that supports payouts does NOT automatically support
 *   bank-transfer payments.
 * - A provider that exposes hosted payment links does NOT automatically support
 *   card payments.
 * - An empty country/currency list means the scope is UNSPECIFIED — it must not
 *   be interpreted as "global support".
 * - A preview or sandbox implementation is NEVER production-execution eligible.
 */

const PROVIDER_OPERATION = Object.freeze({
  PAYMENTS: 'payments',
  PAYOUTS: 'payouts',
  REFUNDS: 'refunds',
  INVOICES: 'invoices',
  PAYMENT_LINKS: 'payment_links',
  TRANSFERS: 'transfers',
  SUBSCRIPTIONS: 'subscriptions',
  BALANCES: 'balance',
  CUSTOMERS: 'customers',
  WALLETS: 'wallets',
  VIRTUAL_ACCOUNTS: 'virtual_accounts'
});

const PROVIDER_OPERATION_KEYS = Object.freeze(Object.values(PROVIDER_OPERATION));

/**
 * Execution lifecycle for a provider operation. Ordered from least to most ready.
 *
 *   UNSUPPORTED — the provider does not expose the capability at all.
 *   PLANNED     — roadmap only; nothing is wired up.
 *   PREVIEW     — implemented/partially wired for review; NOT eligible for
 *                 financial execution in any environment.
 *   SANDBOX     — validated against a provider sandbox/test environment.
 *                 Eligible for execution ONLY when executing in a sandbox/
 *                 test environment. Never for production money movement.
 *   LIVE        — validated, credentialed, and approved for real execution.
 *   DISABLED    — implemented but intentionally disabled (outage, risk, flag).
 */
const EXECUTION_STATUS = Object.freeze({
  UNSUPPORTED: 'unsupported',
  PLANNED: 'planned',
  PREVIEW: 'preview',
  SANDBOX: 'sandbox',
  LIVE: 'live',
  DISABLED: 'disabled'
});

const EXECUTION_STATUS_KEYS = Object.freeze(Object.values(EXECUTION_STATUS));

/**
 * Normalized payment methods shared across all providers.
 */
const PAYMENT_METHOD = Object.freeze({
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  MOBILE_MONEY: 'mobile_money',
  USSD: 'ussd',
  QR: 'qr',
  WALLET: 'wallet',
  DIRECT_DEBIT: 'direct_debit'
});

const PAYMENT_METHOD_KEYS = Object.freeze(Object.values(PAYMENT_METHOD));

/**
 * Normalized transaction types. A transaction type is a user-visible intent;
 * it maps to exactly one provider operation via OPERATION_BY_TRANSACTION_TYPE.
 *
 * Note: a generic PAYMENT is NOT an invoice payment, and an invoice payment is
 * NOT a generic payment. They are distinct transaction types so routing can
 * never accidentally substitute one flow for another.
 */
const TRANSACTION_TYPE = Object.freeze({
  PAYMENT: 'payment',
  INVOICE_PAYMENT: 'invoice_payment',
  PAYMENT_LINK: 'payment_link',
  TRANSFER: 'transfer',
  PAYOUT: 'payout',
  REFUND: 'refund',
  SUBSCRIPTION: 'subscription',
  TOP_UP: 'top_up'
});

const TRANSACTION_TYPE_KEYS = Object.freeze(Object.values(TRANSACTION_TYPE));

const OPERATION_BY_TRANSACTION_TYPE = Object.freeze({
  [TRANSACTION_TYPE.PAYMENT]: PROVIDER_OPERATION.PAYMENTS,
  [TRANSACTION_TYPE.INVOICE_PAYMENT]: PROVIDER_OPERATION.INVOICES,
  [TRANSACTION_TYPE.PAYMENT_LINK]: PROVIDER_OPERATION.PAYMENT_LINKS,
  [TRANSACTION_TYPE.TRANSFER]: PROVIDER_OPERATION.TRANSFERS,
  [TRANSACTION_TYPE.PAYOUT]: PROVIDER_OPERATION.PAYOUTS,
  [TRANSACTION_TYPE.REFUND]: PROVIDER_OPERATION.REFUNDS,
  [TRANSACTION_TYPE.SUBSCRIPTION]: PROVIDER_OPERATION.SUBSCRIPTIONS,
  [TRANSACTION_TYPE.TOP_UP]: PROVIDER_OPERATION.PAYMENTS
});

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeProviderKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCountryCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return null;
  if (!/^[A-Z]{2}$/.test(code)) {
    const err = new Error('Invalid country code: ' + code);
    err.code = 'INVALID_COUNTRY_CODE';
    throw err;
  }
  return code;
}

function normalizeCurrencyCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return null;
  if (!/^[A-Z]{3}$/.test(code)) {
    const err = new Error('Invalid currency code: ' + code);
    err.code = 'INVALID_CURRENCY_CODE';
    throw err;
  }
  return code;
}

const PAYMENT_METHOD_ALIASES = Object.freeze({
  card: 'card',
  card_payment: 'card',
  card_payments: 'card',
  bank_transfer: 'bank_transfer',
  banktransfer: 'bank_transfer',
  bank_transfer_payment: 'bank_transfer',
  'bank-transfer': 'bank_transfer',
  mobile_money: 'mobile_money',
  mobilemoney: 'mobile_money',
  ussd: 'ussd',
  qr: 'qr',
  qr_payment: 'qr',
  wallet: 'wallet',
  wallet_payment: 'wallet',
  wallet_payments: 'wallet',
  direct_debit: 'direct_debit',
  directdebit: 'direct_debit',
  'direct-debit': 'direct_debit'
});

function normalizePaymentMethod(value) {
  const key = normalizeProviderKey(value);
  if (!key) return null;
  if (PAYMENT_METHOD_ALIASES[key]) return PAYMENT_METHOD_ALIASES[key];
  if (PAYMENT_METHOD_KEYS.includes(key)) return key;
  return key; // unknown but normalized; callers decide whether to reject
}

const TRANSACTION_TYPE_ALIASES = Object.freeze({
  payment: 'payment',
  payments: 'payment',
  invoice: 'invoice_payment',
  invoices: 'invoice_payment',
  invoice_payment: 'invoice_payment',
  invoicepayment: 'invoice_payment',
  'invoice-payment': 'invoice_payment',
  payment_link: 'payment_link',
  payment_links: 'payment_link',
  paymentlink: 'payment_link',
  'payment-link': 'payment_link',
  hosted_link: 'payment_link',
  transfer: 'transfer',
  transfers: 'transfer',
  payout: 'payout',
  payouts: 'payout',
  refund: 'refund',
  refunds: 'refund',
  subscription: 'subscription',
  subscriptions: 'subscription',
  top_up: 'top_up',
  topup: 'top_up',
  'top-up': 'top_up'
});

function normalizeTransactionType(value) {
  const key = normalizeProviderKey(value);
  if (!key) return null;
  if (TRANSACTION_TYPE_ALIASES[key]) return TRANSACTION_TYPE_ALIASES[key];
  return key; // unknown but normalized; callers decide whether to reject
}

const EXECUTION_STATUS_ALIASES = Object.freeze({
  unsupported: 'unsupported',
  not_supported: 'unsupported',
  planned: 'planned',
  roadmap: 'planned',
  coming_soon: 'planned',
  preview: 'preview',
  sandbox: 'sandbox',
  sandbox_ready: 'sandbox',
  'sandbox-ready': 'sandbox',
  test: 'sandbox',
  live: 'live',
  production: 'live',
  prod: 'live',
  disabled: 'disabled',
  off: 'disabled',
  setup: 'planned' // legacy adapter status: "needs setup" behaves as planned
});

function normalizeExecutionStatus(value) {
  const key = normalizeProviderKey(value);
  if (!key) return null;
  if (EXECUTION_STATUS_ALIASES[key]) return EXECUTION_STATUS_ALIASES[key];
  if (EXECUTION_STATUS_KEYS.includes(key)) return key;
  return null;
}
 // ---------------------------------------------------------------------------
// Capability construction helpers
// ---------------------------------------------------------------------------

/**
 * Describes one operation for a provider.
 *
 * @param {object} opts
 * @param {string} opts.status - an EXECUTION_STATUS value (or legacy alias)
 * @param {string} [opts.environment] - provider environment ('sandbox'|'live')
 * @returns {object} normalized operation descriptor
 */
function describeOperation({ status, environment }) {
  const normalizedStatus = normalizeExecutionStatus(status) || EXECUTION_STATUS.UNSUPPORTED;
  const normalizedEnvironment = String(environment || '').trim().toLowerCase();
  const productionEnvironment = normalizedEnvironment === 'live' || normalizedEnvironment === 'production';
  const sandboxEnvironment = normalizedEnvironment === 'sandbox' || normalizedEnvironment === 'test';

  return Object.freeze({
    status: normalizedStatus,
    implemented: Boolean(
      normalizedStatus === EXECUTION_STATUS.PREVIEW ||
      normalizedStatus === EXECUTION_STATUS.SANDBOX ||
      normalizedStatus === EXECUTION_STATUS.LIVE
    ),
    productionEligible: normalizedStatus === EXECUTION_STATUS.LIVE,
    sandboxEligible: normalizedStatus === EXECUTION_STATUS.SANDBOX || normalizedStatus === EXECUTION_STATUS.LIVE,
    executionEligible: {
      production: normalizedStatus === EXECUTION_STATUS.LIVE,
      sandbox: normalizedStatus === EXECUTION_STATUS.SANDBOX || normalizedStatus === EXECUTION_STATUS.LIVE,
      requestedEnvironment: normalizedEnvironment || null,
      eligibleForRequestedEnvironment: productionEnvironment
        ? normalizedStatus === EXECUTION_STATUS.LIVE
        : sandboxEnvironment
          ? normalizedStatus === EXECUTION_STATUS.SANDBOX || normalizedStatus === EXECUTION_STATUS.LIVE
          : null
    }
  });
}

/**
 * Normalizes a capability declaration without inventing implied capabilities.
 *
 * @param {object} caps - provider-declared capabilities
 * @param {object} [opts]
 * @param {string} [opts.environment]
 * @returns {object} canonical capability object
 */
function normalizeCapabilities(caps = {}, { environment } = {}) {
  const paymentMethods = new Set();
  for (const [key, enabled] of Object.entries(caps.paymentMethods || {})) {
    if (!enabled) continue;
    const normalized = normalizePaymentMethod(key);
    if (normalized && PAYMENT_METHOD_KEYS.includes(normalized)) paymentMethods.add(normalized);
  }

  const operations = {};
  for (const operation of PROVIDER_OPERATION_KEYS) {
    const declared = caps.operations?.[operation];
    const status =
      typeof declared === 'string'
        ? declared
        : typeof declared === 'object'
          ? declared.status
          : declared === true
            ? EXECUTION_STATUS.PREVIEW
            : caps[operation] === true
              ? EXECUTION_STATUS.PREVIEW
              : EXECUTION_STATUS.UNSUPPORTED;
    operations[operation] = describeOperation({
      status,
      environment: (typeof declared === 'object' && declared.environment) || environment
    });
  }

  const countries = caps.countries || caps.supportedCountries || [];
  const currencies = caps.currencies || caps.supportedCurrencies || [];

  const scope =
    caps.countries === 'all' || caps.supportedCountries === 'all'
      ? 'global'
      : Array.isArray(countries) && countries.length > 0
        ? 'allowlist'
        : 'unspecified';

  return Object.freeze({
    provider: caps.provider || null,
    displayName: caps.displayName || null,
    environment: String(environment || caps.environment || '').trim().toLowerCase() || null,
    operations,
    paymentMethods: Object.freeze([...paymentMethods]),
    countries: Object.freeze((Array.isArray(countries) ? countries : []).map(normalizeCountryCode).filter(Boolean)),
    countryScope: scope,
    currencies: Object.freeze((Array.isArray(currencies) ? currencies : []).map(normalizeCurrencyCode).filter(Boolean)),
    currencyScope: scope
  });
}

/**
 * True when the provider explicitly declares the country. A provider with no
 * declared country list (scope 'unspecified') returns false on purpose —
 * absence of a list must never be read as "supports every country".
 */
function supportsCountry(normalizedCapabilities, countryCode) {
  if (normalizedCapabilities.countryScope === 'global') return true;
  if (normalizedCapabilities.countryScope !== 'allowlist') return false;
  const code = normalizeCountryCode(countryCode);
  return Boolean(code && normalizedCapabilities.countries.includes(code));
}

/**
 * True when the provider explicitly declares the currency. Same rule as
 * supportsCountry — an unspecified list is NOT unrestricted.
 */
function supportsCurrency(normalizedCapabilities, currencyCode) {
  if (normalizedCapabilities.currencyScope === 'global') return true;
  if (normalizedCapabilities.currencyScope !== 'allowlist') return false;
  const code = normalizeCurrencyCode(currencyCode);
  return Boolean(code && normalizedCapabilities.currencies.includes(code));
}

module.exports = {
  PROVIDER_OPERATION,
  PROVIDER_OPERATION_KEYS,
  EXECUTION_STATUS,
  EXECUTION_STATUS_KEYS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_KEYS,
  TRANSACTION_TYPE,
  TRANSACTION_TYPE_KEYS,
  OPERATION_BY_TRANSACTION_TYPE,
  normalizeProviderKey,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizePaymentMethod,
  normalizeTransactionType,
  normalizeExecutionStatus,
  describeOperation,
  normalizeCapabilities,
  supportsCountry,
  supportsCurrency
};