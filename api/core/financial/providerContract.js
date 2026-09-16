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
  COMING_SOON: 'coming_soon',
  PREVIEW: 'preview',
  SANDBOX: 'sandbox',
  LIVE: 'live',
  DISABLED: 'disabled',
  DEGRADED: 'degraded',
  MAINTENANCE: 'maintenance'
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
  DIRECT_DEBIT: 'direct_debit',
  BNPL: 'bnpl'
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

// Adapter methods remain provider-specific implementation details. This map is
// the one place where they are translated into Transferly's public operations.
const CANONICAL_OPERATION_METHODS = Object.freeze({
  [PROVIDER_OPERATION.PAYMENTS]: ['createPayment'],
  [PROVIDER_OPERATION.PAYOUTS]: ['createPayout', 'previewPayout'],
  [PROVIDER_OPERATION.REFUNDS]: ['createRefund', 'getRefund'],
  [PROVIDER_OPERATION.INVOICES]: ['createInvoice', 'sendInvoice', 'previewInvoice'],
  [PROVIDER_OPERATION.PAYMENT_LINKS]: ['createPaymentLink', 'createInvoice', 'previewInvoice'],
  [PROVIDER_OPERATION.TRANSFERS]: ['createTransfer', 'createPayout', 'previewPayout'],
  [PROVIDER_OPERATION.SUBSCRIPTIONS]: ['createSubscription'],
  [PROVIDER_OPERATION.BALANCES]: ['getBalance'],
  [PROVIDER_OPERATION.CUSTOMERS]: ['createCustomer'],
  [PROVIDER_OPERATION.WALLETS]: ['getWallet'],
  [PROVIDER_OPERATION.VIRTUAL_ACCOUNTS]: ['createVirtualAccount']
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
  'direct-debit': 'direct_debit',
  bnpl: 'bnpl',
  buy_now_pay_later: 'bnpl',
  'buy-now-pay-later': 'bnpl',
  'buy-now-pay-later-payment': 'bnpl'
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
  coming_soon: 'coming_soon',
  'coming-soon': 'coming_soon',
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

  const countryScope =
    caps.countries === 'all' || caps.supportedCountries === 'all'
      ? 'global'
      : Array.isArray(countries) && countries.length > 0
        ? 'allowlist'
        : 'unspecified';
  const currencyScope =
    caps.currencies === 'all' || caps.supportedCurrencies === 'all'
      ? 'global'
      : Array.isArray(currencies) && currencies.length > 0
        ? 'allowlist'
        : 'unspecified';

  return Object.freeze({
    provider: caps.provider || null,
    displayName: caps.displayName || null,
    environment: String(environment || caps.environment || '').trim().toLowerCase() || null,
    operations,
    paymentMethods: Object.freeze([...paymentMethods]),
    countries: Object.freeze((Array.isArray(countries) ? countries : []).map(normalizeCountryCode).filter(Boolean)),
    countryScope,
    currencies: Object.freeze((Array.isArray(currencies) ? currencies : []).map(normalizeCurrencyCode).filter(Boolean)),
    currencyScope
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

function statusPriority(status) {
  return [
    EXECUTION_STATUS.UNSUPPORTED,
    EXECUTION_STATUS.PLANNED,
    EXECUTION_STATUS.COMING_SOON,
    EXECUTION_STATUS.PREVIEW,
    EXECUTION_STATUS.SANDBOX,
    EXECUTION_STATUS.LIVE
  ].indexOf(status);
}

function resolveOperationStatus(adapterContract, operation, declaredStatus) {
  const override = normalizeExecutionStatus(declaredStatus);
  if (override) return override;

  const methodStatuses = (CANONICAL_OPERATION_METHODS[operation] || [])
    .map((method) => normalizeExecutionStatus(adapterContract?.operations?.[method]?.status))
    .filter(Boolean);
  if (methodStatuses.length === 0) return EXECUTION_STATUS.UNSUPPORTED;

  return methodStatuses.reduce(
    (mostReady, candidate) => statusPriority(candidate) > statusPriority(mostReady) ? candidate : mostReady,
    EXECUTION_STATUS.UNSUPPORTED
  );
}

/**
 * Produce the safe, canonical representation consumed by readiness, routing,
 * admin, and UI surfaces. It deliberately contains configuration names, never
 * credential values or provider request material.
 */
function buildProviderReadinessDescriptor({
  provider,
  adapterContract = {},
  summary = {},
  enabled = false,
  operationStatuses = {}
} = {}) {
  const configured = Boolean(adapterContract.configured);
  const environment = String(adapterContract.mode || summary.mode || '').trim().toLowerCase() || null;
  const capabilities = normalizeCapabilities(summary.capabilities || {}, { environment });
  const operationNames = [...new Set([...PROVIDER_OPERATION_KEYS, ...Object.keys(operationStatuses)])];
  const operations = Object.fromEntries(operationNames.map((operation) => {
    const status = resolveOperationStatus(adapterContract, operation, operationStatuses[operation]);
    const execution = describeOperation({ status, environment });
    const productionEligible = enabled && configured && execution.productionEligible;
    const sandboxEligible = enabled && configured && execution.sandboxEligible;
    return [operation, Object.freeze({
      operation,
      operationStatus: status,
      executionEligible: Object.freeze({
        production: productionEligible,
        sandbox: sandboxEligible,
        requestedEnvironment: execution.executionEligible.requestedEnvironment,
        eligibleForRequestedEnvironment: environment === 'sandbox' || environment === 'test'
          ? sandboxEligible
          : environment === 'live' || environment === 'production'
            ? productionEligible
            : null
      }),
      productionEnabled: productionEligible,
      sandboxEnabled: sandboxEligible
    })];
  }));

  const requiredEnv = Object.freeze([...(adapterContract.required_env || [])]);
  const missingEnv = Object.freeze([...(adapterContract.missing_env || [])]);
  const providerStatus = String(summary.status || (configured ? 'configured' : 'not_configured'));

  return Object.freeze({
    provider: normalizeProviderKey(provider || adapterContract.provider),
    status: providerStatus,
    environment,
    enabled: Boolean(enabled),
    productionEnabled: Object.values(operations).some((operation) => operation.productionEnabled),
    sandboxEnabled: Object.values(operations).some((operation) => operation.sandboxEnabled),
    countries: capabilities.countries,
    countryScope: capabilities.countryScope,
    currencies: capabilities.currencies,
    currencyScope: capabilities.currencyScope,
    paymentMethods: capabilities.paymentMethods,
    limits: summary.limits || null,
    requiredConfiguration: requiredEnv,
    missingConfiguration: missingEnv,
    requiredCredentials: requiredEnv,
    missingCredentials: missingEnv,
    required_env: requiredEnv,
    missing_env: missingEnv,
    configured,
    operations: Object.freeze(operations)
  });
}

// ---------------------------------------------------------------------------
// Result + error normalization (provider-agnostic)
//
// Converts raw provider responses and errors into canonical Transferly shapes
// so provider-specific formats never leak into domain logic. Two safety rules
// are enforced here:
//   - An unknown or ambiguous raw outcome is NEVER normalized to success.
//     (reconciliation_required is raised instead so it can be reviewed.)
//   - Provider request material / credential values are screened out of
//     metadata before it can reach logs, API responses, or the client.
// ---------------------------------------------------------------------------

/** Canonical financial outcome of a provider operation. */
const RESULT_STATE = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
  UNKNOWN: 'unknown'
});

const RESULT_STATE_KEYS = Object.freeze(Object.values(RESULT_STATE));

/**
 * Settlement is a separate concept from outcome. A provider may report success
 * (the operation executed) while settlement is still pending. The internal
 * ledger remains the authority for final balance changes.
 */
const SETTLEMENT_STATE = Object.freeze({
  SETTLED: 'settled',
  PENDING: 'pending',
  UNKNOWN: 'unknown'
});

const SETTLEMENT_STATE_KEYS = Object.freeze(Object.values(SETTLEMENT_STATE));

/** Canonical categories for a normalized provider error. */
const PROVIDER_ERROR_CATEGORY = Object.freeze({
  AUTHENTICATION: 'authentication',
  CONFIGURATION: 'configuration',
  RATE_LIMIT: 'rate_limit',
  TIMEOUT: 'timeout',
  CONNECTIVITY: 'connectivity',
  PROVIDER_DOWN: 'provider_down',
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  INVALID_REQUEST: 'invalid_request',
  DECLINED: 'declined',
  DUPLICATE: 'duplicate',
  UNKNOWN: 'unknown'
});

const PROVIDER_ERROR_CATEGORY_KEYS = Object.freeze(Object.values(PROVIDER_ERROR_CATEGORY));

const RETRYABLE_ERROR_CATEGORIES = Object.freeze(new Set([
  PROVIDER_ERROR_CATEGORY.TIMEOUT,
  PROVIDER_ERROR_CATEGORY.CONNECTIVITY,
  PROVIDER_ERROR_CATEGORY.RATE_LIMIT,
  PROVIDER_ERROR_CATEGORY.PROVIDER_DOWN
]));

/** Canonical categorization of an inbound webhook/provider event. */
const WEBHOOK_EVENT_CATEGORY = Object.freeze({
  FINANCIAL: 'financial',
  DISPUTE: 'dispute',
  ADMINISTRATIVE: 'administrative',
  UNKNOWN: 'unknown'
});

const WEBHOOK_EVENT_CATEGORY_KEYS = Object.freeze(Object.values(WEBHOOK_EVENT_CATEGORY));

// Explicit hints used for conservative outcome normalization. Anything not
// listed resolves to UNKNOWN so reconciliation is triggered, never silent.
const SUCCESS_TERMS = Object.freeze(new Set([
  'success', 'successful', 'successfully', 'succeeded', 'completed', 'complete',
  'paid', 'captured', 'approved', 'settled', 'fulfilled', 'done', 'ok', 'okay'
]));

const FAILED_TERMS = Object.freeze(new Set([
  'failed', 'failure', 'rejected', 'refused', 'declined', 'denied', 'cancelled',
  'canceled', 'voided', 'expired', 'blocked', 'error', 'errored', 'faulted'
]));

const PENDING_TERMS = Object.freeze(new Set([
  'pending', 'processing', 'in_progress', 'in-progress', 'awaiting',
  'authorized', 'authorization', 'on_hold', 'on-hold', 'hold'
]));

// Raw keys that must never survive metadata screening (lower-case match).
const SENSITIVE_METADATA_KEYS = Object.freeze(new Set([
  'secret', 'secrets', 'client_secret', 'clientsecret', 'token', 'tokens',
  'access_token', 'accesstoken', 'refresh_token', 'refreshtoken', 'password',
  'passphrase', 'api_key', 'apikey', 'private_key', 'privatekey',
  'authorization', 'authorization_header', 'signature', 'sig', 'cvv', 'cvc',
  'pan', 'card_number', 'cardnumber', 'cc', 'secret_key', 'secretkey',
  'webhook_secret'
]));

/**
 * Maps a raw provider status into a canonical financial outcome.
 *
 * Normalization is deliberately conservative: an empty string, any pending/
 * in-flight term, and any unrecognised status resolve to UNKNOWN. A raw status
 * is never upgraded to SUCCESS just because it is present.
 *
 * @param {boolean|string|null|undefined} rawStatus
 * @returns {{state: string, matched: string|null}}
 */
function normalizeProviderOutcome(rawStatus) {
  if (rawStatus === true) return { state: RESULT_STATE.SUCCESS, matched: 'explicit_true' };
  if (rawStatus === false) return { state: RESULT_STATE.FAILED, matched: 'explicit_false' };

  const raw = String(rawStatus ?? '').trim().toLowerCase();
  if (!raw) return { state: RESULT_STATE.UNKNOWN, matched: null };
  if (PENDING_TERMS.has(raw)) return { state: RESULT_STATE.UNKNOWN, matched: raw };
  if (SUCCESS_TERMS.has(raw)) return { state: RESULT_STATE.SUCCESS, matched: raw };
  if (FAILED_TERMS.has(raw)) return { state: RESULT_STATE.FAILED, matched: raw };
  return { state: RESULT_STATE.UNKNOWN, matched: raw };
}

/**
 * Classifies an error into a canonical category with a deterministic answer
 * about whether it is safe to retry. The raw message is never surfaced.
 *
 * @param {object} [error]
 * @param {string} [fallbackCode]
 * @returns {object} normalized, safe error descriptor
 */
function categorizeProviderError(error = {}, fallbackCode = 'PROVIDER_ERROR') {
  const code = String(error?.code || error?.name || '').toLowerCase();
  const message = String(error?.message || error?.msg || '').toLowerCase();
  const text = `${code} ${message}`.trim();

  let category = PROVIDER_ERROR_CATEGORY.UNKNOWN;
  if (/\b(401|unauthorized|invalid.credentials|authentication|auth.token|invalid.token)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.AUTHENTICATION;
  } else if (/\b(429|rate.limit|too.many.requests|throttl)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.RATE_LIMIT;
  } else if (/\b(timeout|timed.out|timed_out|deadline)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.TIMEOUT;
  } else if (/\b(502|503|504|service.unavailable|gateway|maintenance)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.PROVIDER_DOWN;
  } else if (/\b(connection|connectivity|network|econnreset|econnrefused|socket|unreachable|dns)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.CONNECTIVITY;
  } else if (/\b(insufficient.funds|low.balance|no.funds)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.INSUFFICIENT_FUNDS;
  } else if (/\b(duplicate|already.exists|idempotency)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.DUPLICATE;
  } else if (/\b(declined|do.not.honor|card.declined)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.DECLINED;
  } else if (/\b(400|422|invalid|missing.field|schema|interrupt)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.INVALID_REQUEST;
  } else if (/\b(environment|configuration|misconfigur|env)\b/.test(text)) {
    category = PROVIDER_ERROR_CATEGORY.CONFIGURATION;
  }

  const outcome = normalizeProviderOutcome(error?.status);

  return Object.freeze({
    code: String(error?.code || error?.name || fallbackCode),
    category,
    retryable: RETRYABLE_ERROR_CATEGORIES.has(category),
    timeout: category === PROVIDER_ERROR_CATEGORY.TIMEOUT,
    auth_required: category === PROVIDER_ERROR_CATEGORY.AUTHENTICATION,
    rate_limited: category === PROVIDER_ERROR_CATEGORY.RATE_LIMIT,
    outcome: outcome.state,
    raw_provider_error_exposed: false
  });
}

/**
 * Redacts credential-shaped values and sensitive keys from arbitrary provider
 * metadata. Depth- and key-count-limited so huge payloads cannot be echoed.
 *
 * @param {object} [metadata]
 * @param {object} [opts]
 * @returns {object} safe metadata (never raw provider request material)
 */
function screenSafeMetadata(metadata = {}, { depth = 3, maxKeys = 50 } = {}) {
  function walk(value, level) {
    if (level > depth) return '[TRUNCATED]';
    if (value === null || value === undefined) return null;
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      if (
        type === 'string' &&
        /^(sk_|sk-live|sk-test|whsec_|rk_|pk_live|pk_test|AKIA|ghp_|eyJ[A-Za-z0-9_.-]{20,})/.test(value)
      ) {
        return '[REDACTED]';
      }
      return value;
    }
    if (type !== 'object') return null;
    if (Array.isArray(value)) {
      return value.slice(0, maxKeys).map((entry) => walk(entry, level + 1));
    }
    const out = {};
    let count = 0;
    for (const [key, val] of Object.entries(value)) {
      if (count >= maxKeys) break;
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const lower = String(key).toLowerCase();
      const normalizedKey = lower.replace(/[^a-z0-9]/g, '');
      if (SENSITIVE_METADATA_KEYS.has(lower) || SENSITIVE_METADATA_KEYS.has(normalizedKey)) {
        out[key] = '[REDACTED]';
        continue;
      }
      out[key] = walk(val, level + 1);
      count += 1;
    }
    return out;
  }
  return walk(metadata, 0) || {};
}

/**
 * Builds the canonical result for a provider operation (payment, payout,
 * refund, or balance depending on `operation`). Never treats an unknown raw
 * outcome as success and never echoes provider request material.
 */
function buildProviderResult({
  operation,
  provider,
  rawStatus,
  settlement = SETTLEMENT_STATE.UNKNOWN,
  providerTransactionId = null,
  providerReference = null,
  amount = null,
  currency = null,
  fee = null,
  safeMetadata = {},
  error = null
} = {}) {
  const outcome = normalizeProviderOutcome(rawStatus);
  const normalizedSettlement = SETTLEMENT_STATE_KEYS.includes(settlement) ? settlement : SETTLEMENT_STATE.UNKNOWN;
  const reconciliationRequired =
    outcome.state === RESULT_STATE.UNKNOWN ||
    normalizedSettlement === SETTLEMENT_STATE.UNKNOWN;

  return Object.freeze({
    operation: String(operation || '').toLowerCase() || null,
    provider: normalizeProviderKey(provider),
    outcome: outcome.state,
    matched_status: outcome.matched,
    settlement: normalizedSettlement,
    reconciliation_required: reconciliationRequired,
    provider_transaction_id: providerTransactionId || null,
    provider_reference: providerReference || null,
    amount,
    currency: currency ? String(currency).toUpperCase() : null,
    fee: fee === undefined || fee === null ? null : fee,
    safe_metadata: screenSafeMetadata(safeMetadata),
    error: error ? categorizeProviderError(error) : null
  });
}

/**
 * Classifies an inbound provider event type into a canonical category.
 *
 * @param {string|undefined} eventType
 * @returns {string} a WEBHOOK_EVENT_CATEGORY value
 */
function categorizeWebhookEventType(eventType) {
  const raw = String(eventType || '').toLowerCase();
  if (!raw) return WEBHOOK_EVENT_CATEGORY.UNKNOWN;
  if (/\b(dispute|customer.dispute|case.id|case|resolution)\b/.test(raw)) {
    return WEBHOOK_EVENT_CATEGORY.DISPUTE;
  }
  if (/\b(payment|capture|refund|payout|invoice|charge|transfer|authorization|settlement|billing|subscription|order)\b/.test(raw)) {
    return WEBHOOK_EVENT_CATEGORY.FINANCIAL;
  }
  return WEBHOOK_EVENT_CATEGORY.ADMINISTRATIVE;
}

/**
 * Builds the canonical shape for a verified, deduplicated webhook event.
 * Financial events whose outcome is unknown are flagged for reconciliation.
 */
function normalizeWebhookEvent({
  provider,
  eventId,
  eventType,
  rawStatus,
  safeMetadata = {},
  receivedAt = new Date().toISOString()
} = {}) {
  const category = categorizeWebhookEventType(eventType);
  const outcome = normalizeProviderOutcome(rawStatus);
  const requiresReconciliation =
    category === WEBHOOK_EVENT_CATEGORY.FINANCIAL &&
    outcome.state === RESULT_STATE.UNKNOWN;

  return Object.freeze({
    provider: normalizeProviderKey(provider),
    event_id: String(eventId || '').trim() || null,
    event_type: String(eventType || '').trim() || null,
    category,
    received_at: receivedAt ? String(receivedAt) : null,
    outcome: outcome.state,
    matched_status: outcome.matched,
    requires_reconciliation: requiresReconciliation,
    safe_metadata: screenSafeMetadata(safeMetadata)
  });
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
  CANONICAL_OPERATION_METHODS,
  RESULT_STATE,
  RESULT_STATE_KEYS,
  SETTLEMENT_STATE,
  SETTLEMENT_STATE_KEYS,
  PROVIDER_ERROR_CATEGORY,
  PROVIDER_ERROR_CATEGORY_KEYS,
  WEBHOOK_EVENT_CATEGORY,
  WEBHOOK_EVENT_CATEGORY_KEYS,
  normalizeProviderKey,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizePaymentMethod,
  normalizeTransactionType,
  normalizeExecutionStatus,
  normalizeProviderOutcome,
  categorizeProviderError,
  screenSafeMetadata,
  buildProviderResult,
  categorizeWebhookEventType,
  normalizeWebhookEvent,
  describeOperation,
  normalizeCapabilities,
  supportsCountry,
  supportsCurrency,
  buildProviderReadinessDescriptor
};
