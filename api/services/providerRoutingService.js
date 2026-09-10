'use strict';

/**
 * Provider routing — deterministic eligibility pipeline.
 *
 * Routing is implemented as separate, explicit stages:
 *
 *   ELIGIBILITY → RANKING → EXECUTION
 *
 *   ELIGIBILITY gates (all must pass for a provider to be a candidate):
 *     1. provider enabled
 *     2. environment matches the requested execution environment
 *     3. operation supported (not unsupported/planned/disabled)
 *     4. operation production-eligible (never preview/sandbox for production)
 *     5. country supported (explicitly declared — NOT implied by an empty list)
 *     6. currency supported (same explicit rule)
 *     7. payment method supported
 *     8. transaction type supported (mapped to exactly one operation)
 *     9. amount within provider limits
 *    10. provider healthy
 *    11. provider ready
 *
 *   RANKING orders only the eligible providers by score. Preference and risk
 *   policy refine the ranked set before the final execution selection.
 *
 *   EXECUTION returns the selected provider together with the eligibility
 *   evidence, so callers can see exactly why a provider was (or was not)
 *   chosen — and can tell preview/sandbox implementations apart from live ones.
 *
 * Semantic rules enforced here:
 *   - generic `payment` maps to the `payments` operation — never to `invoices`
 *     merely because invoices are one payment flow.
 *   - payouts capability never implies bank-transfer payment support.
 *   - hosted payment links never imply card payment support.
 *   - empty country/currency declarations are UNSPECIFIED (not unrestricted).
 */

const { paymentProviderRegistry } = require('./paymentProviderRegistry');
const { providerStatusService } = require('./providerStatusService');
const providerCapabilityModule = require('./providerCapabilityService');
const { providerCapabilityService } = providerCapabilityModule;
const { AppError } = require('../utils/errors');
const {
  TRANSACTION_TYPE,
  TRANSACTION_TYPE_KEYS,
  OPERATION_BY_TRANSACTION_TYPE,
  EXECUTION_STATUS,
  normalizeProviderKey,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizePaymentMethod,
  normalizeTransactionType,
  normalizeExecutionStatus
} = require('../core/financial/providerContract');

/**
 * Canonical transaction type → provider operation mapping (single source of
 * truth re-exported from the provider contract so consumers cannot diverge).
 */
const OPERATION_BY_TRANSACTION_TYPE_INDEX = OPERATION_BY_TRANSACTION_TYPE;

/**
 * Adapter contract methods used to infer a canonical operation status when the
 * operation is not tracked by the Transferly enablement matrix.
 */
const OPERATION_ADAPTER_METHODS = Object.freeze({
  payments: ['createPayment'],
  payouts: ['createPayout', 'previewPayout'],
  refunds: ['createRefund', 'getRefund'],
  invoices: ['createInvoice', 'sendInvoice', 'previewInvoice'],
  payment_links: ['createInvoice', 'previewInvoice'],
  transfers: ['createPayout', 'previewPayout'],
  subscriptions: [],
  balance: ['getBalance'],
  customers: [],
  wallets: [],
  virtual_accounts: []
});

const ROUTING_WEIGHTS = Object.freeze({
  operation: 40,
  health: 30,
  readiness: 20,
  orderPriority: 10
});

function parseExcludedProviders(value) {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(entries.map(normalizeProviderKey).filter(Boolean))];
}

function scoreOrderPriority(order) {
  if (typeof order !== 'number' || order <= 0) return Math.round(ROUTING_WEIGHTS.orderPriority / 2);
  if (order <= 10) return ROUTING_WEIGHTS.orderPriority;
  if (order <= 20) return 7;
  return 5;
}

function orderIndexByOrder(order) {
  if (typeof order !== 'number' || order <= 0) return Number.MAX_SAFE_INTEGER;
  return order;
}

// ---------------------------------------------------------------------------
// Operation status resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the canonical execution status for a provider operation.
 *
 * Precedence:
 *   1. Transferly enablement matrix (invoices/payouts/balance/activity) when
 *      the operation is tracked there.
 *   2. Adapter contract operation methods (explicit `unsupported` wins, the
 *      inferred status is otherwise used as a fallback signal).
 *   3. `unsupported` — safety default. Routing never assumes a capability the
 *      provider has not declared.
 */
function resolveOperationStatus(provider, operation, adapterContract) {
  const matrixStatus = providerCapabilityModule.OPERATION_SUPPORT?.[operation]?.[provider];
  const normalizedMatrix = normalizeExecutionStatus(matrixStatus);
  if (normalizedMatrix) return normalizedMatrix;

  const methods = OPERATION_ADAPTER_METHODS[operation] || [];
  for (const method of methods) {
    const contractStatus = normalizeExecutionStatus(adapterContract?.operations?.[method]?.status);
    if (contractStatus && contractStatus !== EXECUTION_STATUS.UNSUPPORTED) return contractStatus;
  }
  return EXECUTION_STATUS.UNSUPPORTED;
}

/**
 * Resolves the provider's execution environment. The adapter mode (e.g.
 * config.PAYPAL_ENVIRONMENT) is authoritative when known; otherwise the mode
 * stays unknown and the eligibility pipeline assumes production safety.
 */
function resolveProviderEnvironment(moduleEntry, adapterContract) {
  const mode = adapterContract?.mode || moduleEntry?.metadata?.environment || null;
  const normalized = String(mode || '').trim().toLowerCase();
  if (['sandbox', 'test'].includes(normalized)) return 'sandbox';
  if (['live', 'production', 'prod'].includes(normalized)) return 'live';
  return null;
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

function matchesPaymentMethod(summaryCapabilities, canonicalPaymentMethod) {
  if (!canonicalPaymentMethod) return { eligible: true, reason: null };
  const wanted = String(canonicalPaymentMethod).trim().toLowerCase();
  if (!wanted) return { eligible: true, reason: null };

  const declared = Array.isArray(summaryCapabilities.paymentMethods)
    ? summaryCapabilities.paymentMethods
    : null;

  if (declared) {
    return {
      eligible: declared.some((entry) => String(entry).trim().toLowerCase() === wanted),
      reason: null
    };
  }

  // Legacy capability keys: only explicit payment-method booleans count.
  // `hosted_payment_links` is NOT a card-payment capability and `payouts` is
  // NOT a bank-transfer capability.
  const legacyKeys = {
    card: ['card_payments', 'cardPayments'],
    bank_transfer: ['bank_transfer', 'bankTransfer'],
    mobile_money: ['mobile_money'],
    wallet: ['wallet_payments', 'walletPayments'],
    qr: ['qr_payments', 'qrPayments'],
    direct_debit: ['direct_debit', 'directDebit'],
    ussd: ['ussd']
  };
  const keys = legacyKeys[wanted] || [];
  const supported = keys.some((key) => Boolean(summaryCapabilities[key]));
  return {
    eligible: supported,
    reason: supported ? null : `Provider does not declare payment method ${wanted}.`
  };
}

function matchesDeclaredScope(declaredValues, scope, value) {
  if (!value) return { eligible: true, reason: null };
  if (scope === 'global') return { eligible: true, reason: null };
  if (scope === 'allowlist') {
    const wanted = String(value).trim().toUpperCase();
    return {
      eligible: declaredValues.some((entry) => String(entry).trim().toUpperCase() === wanted),
      reason: null
    };
  }
  // UNSPECIFIED scope: absence of a declaration is not coverage.
  return {
    eligible: false,
    reason: 'Provider has not declared support for the requested scope.'
  };
}

function amountWithinLimits(amountCents, providerLimits) {
  if (amountCents === undefined || amountCents === null) return { eligible: true, reason: null };
  const amount = Number(amountCents);
  if (!Number.isFinite(amount) || amount < 0) {
    return { eligible: false, reason: 'Amount must be a non-negative number.' };
  }
  const min = Number(providerLimits?.minAmountCents);
  const max = Number(providerLimits?.maxAmountCents);
  if (Number.isFinite(min) && amount < min) {
    return { eligible: false, reason: `Amount is below the provider minimum of ${min} minor units.` };
  }
  if (Number.isFinite(max) && amount > max) {
    return { eligible: false, reason: `Amount exceeds the provider maximum of ${max} minor units.` };
  }
  return { eligible: true, reason: null };
}

// ---------------------------------------------------------------------------
// Eligible candidate builder
// ---------------------------------------------------------------------------

/**
 * Applies the deterministic eligibility stages for one provider. Each stage
 * records whether it passed or, if not, the exact reason. A provider is a
 * routing candidate only when every REQUIRED stage passes.
 */
function evaluateProviderEligibility({
  moduleEntry,
  summary,
  adapterContract,
  capability,
  status,
  operation,
  transactionType,
  country,
  currency,
  paymentMethod,
  amountCents,
  requestedEnvironment,
  onlyImplemented
}) {
  const provider = moduleEntry.key;
  const reasons = [];
  const warnings = [];

  function fail(reason) {
    reasons.push(reason);
  }

  // 1. Provider enabled — recorded explicitly for the decision trail.
  // 2. Operation supported.
  const operationStatus = resolveOperationStatus(provider, operation, adapterContract);
  const operationImplemented = operationStatus !== EXECUTION_STATUS.UNSUPPORTED &&
    operationStatus !== EXECUTION_STATUS.PLANNED &&
    operationStatus !== EXECUTION_STATUS.DISABLED;

  // 3+4. Environment eligibility (defaults to production-safety when unknown).
  const providerEnvironment = resolveProviderEnvironment(moduleEntry, adapterContract);
  const effectiveEnvironment = requestedEnvironment || providerEnvironment || EXECUTION_STATUS.LIVE;
  const productionExecution = effectiveEnvironment === EXECUTION_STATUS.LIVE;
  const sandboxExecution = effectiveEnvironment === EXECUTION_STATUS.SANDBOX;
  const productionEligible = operationStatus === EXECUTION_STATUS.LIVE;
  const sandboxEligible = operationStatus === EXECUTION_STATUS.SANDBOX || operationStatus === EXECUTION_STATUS.LIVE;
  const environmentEligible = productionExecution
    ? productionEligible
    : sandboxExecution
      ? sandboxEligible
      : false;

  if (onlyImplemented && !operationImplemented) {
    fail(`Operation "${operation}" is not implemented for provider ${provider} (status=${operationStatus}).`);
  }
  if (!environmentEligible) {
    fail(`Provider operation is not eligible for ${effectiveEnvironment} execution (status=${operationStatus}).`);
  }

  // 5. Country scope — explicit declaration required.
  const countryCheck = matchesDeclaredScope(
    Array.isArray(summary?.capabilities?.supportedCountries) ? summary.capabilities.supportedCountries : [],
    summary?.capabilities?.countryScope || 'unspecified',
    country
  );
  if (!countryCheck.eligible) fail(countryCheck.reason || `Provider is not eligible for country ${country}.`);

  // 6. Currency scope — explicit declaration required.
  const currencyCheck = matchesDeclaredScope(
    Array.isArray(summary?.capabilities?.supportedCurrencies) ? summary.capabilities.supportedCurrencies : [],
    summary?.capabilities?.currencyScope || 'unspecified',
    currency
  );
  if (!currencyCheck.eligible) fail(currencyCheck.reason || `Provider is not eligible for currency ${currency}.`);

  // 7. Payment method — explicit capability only.
  const paymentMethodCheck = matchesPaymentMethod(summary?.capabilities || {}, paymentMethod);
  if (!paymentMethodCheck.eligible) fail(paymentMethodCheck.reason || `Provider does not support payment method ${paymentMethod}.`);

  // 9. Amount within provider limits.
  const amountCheck = amountWithinLimits(amountCents, moduleEntry?.metadata?.limits);
  if (!amountCheck.eligible) fail(amountCheck.reason);

  // 10. Health — critical health blocks; unknown health is a warning.
  const healthCritical = status?.health_status === 'critical';
  if (healthCritical) fail('Provider operational health is critical.');
  if (!status || status.health_status === 'unknown') {
    warnings.push('Provider health is unknown; health scoring is informational.');
  }

  // 11. Readiness — an unready provider cannot execute financially.
  if (!status?.ready) {
    fail('Provider setup is incomplete (provider not ready).');
  }

  const eligible = reasons.length === 0;

  const stages = [
    { stage: 'provider_enabled', required: true, passed: true },
    { stage: 'operation_supported', required: onlyImplemented, passed: operationImplemented },
    {
      stage: 'operation_production_eligible',
      required: true,
      passed: environmentEligible,
      detail: `status=${operationStatus} environment=${effectiveEnvironment} providerEnvironment=${providerEnvironment || 'unknown'}`
    },
    { stage: 'country', required: Boolean(country), passed: countryCheck.eligible },
    { stage: 'currency', required: Boolean(currency), passed: currencyCheck.eligible },
    { stage: 'payment_method', required: Boolean(paymentMethod), passed: paymentMethodCheck.eligible },
    { stage: 'amount_limits', required: amountCents !== undefined && amountCents !== null, passed: amountCheck.eligible },
    { stage: 'health', required: healthCritical, passed: !healthCritical },
    { stage: 'readiness', required: true, passed: Boolean(status?.ready) }
  ];

  const healthScore = typeof status?.health_score === 'number' ? status.health_score : null;
  const readinessPenalty = status?.ready === false ? 10 : 0;

  const candidate = {
    provider,
    transaction_type: transactionType,
    operation,
    operation_status: operationStatus,
    implemented: operationImplemented,
    production_eligible: productionEligible,
    sandbox_eligible: sandboxEligible,
    environment: effectiveEnvironment,
    provider_environment: providerEnvironment || 'unknown',
    status: status?.status || 'unknown',
    ready: Boolean(status?.ready),
    health_score: healthScore,
    health_status: status?.health_status || 'unknown',
    capabilities: Array.isArray(capability?.capabilities) ? capability.capabilities : [],
    total_score:
      (operationImplemented ? ROUTING_WEIGHTS.operation : 0) +
      Math.max(0, (healthScore === null ? 0 : Math.round((healthScore / 100) * ROUTING_WEIGHTS.health)) - readinessPenalty) +
      (status?.ready === true ? ROUTING_WEIGHTS.readiness : 0) +
      scoreOrderPriority(moduleEntry.order),
    order: moduleEntry.order || 100,
    order_index: orderIndexByOrder(moduleEntry.order),
    warnings: Array.isArray(status?.warnings) ? status.warnings.slice(0, 5) : []
  };

  candidate.warnings.push(...warnings);

  return {
    candidate,
    eligibility: {
      provider,
      eligible,
      reasons,
      stages,
      operation_status: operationStatus,
      execution_eligible: eligible && environmentEligible
    }
  };
}

function describeSelection(selected, candidates) {
  if (!selected) return null;
  if (selected.ready && selected.health_status !== 'critical' && selected.implemented && selected.production_eligible) {
    return 'Provider is configured, ready, production-eligible, and supports the requested transaction.';
  }
  if (selected.health_status === 'critical') {
    return 'Highest ranked matching provider, although its operational health is critical.';
  }
  if (!selected.ready) {
    return 'Highest ranked matching provider, although provider setup is incomplete.';
  }
  if (!selected.production_eligible) {
    return 'Highest ranked matching provider, although it is not yet production-eligible (preview or sandbox).';
  }
  return candidates.length > 1
    ? 'Best ranked provider among all eligible candidates.'
    : 'Only provider matching the requested transaction filters.';
}

async function routeProviders(input = {}) {
  // ---- Normalize inputs through the canonical contract ----
  const rawTransactionType = normalizeTransactionType(input.transactionType) || TRANSACTION_TYPE.PAYMENT;
  const transactionType = TRANSACTION_TYPE_KEYS.includes(rawTransactionType) ? rawTransactionType : TRANSACTION_TYPE.PAYMENT;
  const operation = OPERATION_BY_TRANSACTION_TYPE[transactionType];
  if (!operation) {
    throw new AppError(400, 'TRANSACTION_TYPE_UNSUPPORTED', `No provider operation is mapped for transaction type "${transactionType}".`);
  }

  let country = null;
  let currency = null;
  try {
    country = input.country ? normalizeCountryCode(input.country) : null;
    currency = input.currency ? normalizeCurrencyCode(input.currency) : null;
  } catch (error) {
    throw new AppError(400, 'INVALID_ROUTING_SCOPE', error.message || 'Invalid country or currency code supplied for routing.');
  }

  const paymentMethod = input.paymentMethod ? normalizePaymentMethod(input.paymentMethod) : undefined;
  const preferredProvider = input.preferredProvider ? normalizeProviderKey(input.preferredProvider) : undefined;
  const excludedProviders = parseExcludedProviders(input.excludedProviders);
  const onlyImplemented = input.onlyImplemented !== false;
  const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 25);
  const requestedEnvironment = String(input.environment || '').trim().toLowerCase() || null;
  const amountCents = input.amountCents === undefined ? undefined : Number(input.amountCents);

  const summaries = new Map(
    paymentProviderRegistry.listProviders().map((provider) => [normalizeProviderKey(provider.key), provider])
  );
  const modules = paymentProviderRegistry.listProviders().map((provider) => ({
    key: normalizeProviderKey(provider.key),
    order: provider.order ?? 100,
    name: provider.display_name || provider.key,
    metadata: {}
  }));

  const excluded = new Set(excludedProviders);
  const candidates = [];
  const skipped = [];
  const eligible = [];
  const stagesSummary = {};

  for (const moduleEntry of modules) {
    const provider = normalizeProviderKey(moduleEntry.key);
    if (excluded.has(provider)) {
      skipped.push({ provider, stage: 'user_exclusion', reason: 'Explicitly excluded from routing.' });
      continue;
    }

    let capability = null;
    let adapterContract = null;
    let status = null;
    try {
      capability = providerCapabilityService.getProviderCapabilities(provider);
      adapterContract = paymentProviderRegistry.getProviderAdapterContract(provider);
      status = await providerStatusService.getProviderStatus(provider);
    } catch (error) {
      skipped.push({ provider, stage: 'query', reason: error?.message || 'Provider capabilities or status unavailable.' });
      continue;
    }

    const summary = summaries.get(provider) || {};
    const evaluation = evaluateProviderEligibility({
      moduleEntry,
      summary,
      adapterContract,
      capability,
      status,
      operation,
      transactionType,
      country,
      currency,
      paymentMethod,
      amountCents,
      requestedEnvironment,
      onlyImplemented
    });

    for (const stage of evaluation.eligibility.stages) {
      const entry = stagesSummary[stage.stage] || (stagesSummary[stage.stage] = { passed: 0, failed: 0, total: 0 });
      entry.total += 1;
      if (stage.passed) entry.passed += 1;
      else entry.failed += 1;
    }

    if (!evaluation.eligibility.eligible) {
      skipped.push({
        provider,
        stage: 'eligibility',
        reason: evaluation.eligibility.reasons.join(' '),
        operation_status: evaluation.eligibility.operation_status
      });
      continue;
    }

    candidates.push(evaluation.candidate);
    eligible.push(provider);
  }

  // ---- RANKING (only after eligibility) ----
  candidates.sort((left, right) => {
    if (right.total_score !== left.total_score) return right.total_score - left.total_score;
    if (left.ready !== right.ready) return left.ready ? -1 : 1;
    if (left.order_index !== right.order_index) return left.order_index - right.order_index;
    return String(left.provider).localeCompare(String(right.provider));
  });

  // User preference applies only to the eligible set — a preferred provider is
  // not eligible merely by being preferred.
  const preferredEligible = preferredProvider && eligible.includes(preferredProvider);
  const selected = preferredEligible
    ? candidates.find((candidate) => candidate.provider === preferredProvider)
    : candidates[0] || null;

  if (!selected) {
    throw new AppError(400, 'NO_PROVIDER_ROUTE', 'No provider route matches the requested transaction filters.', {
      country: country || null,
      currency: currency || null,
      paymentMethod: paymentMethod || null,
      transactionType,
      operation,
      preferredProvider: preferredProvider || null,
      onlyImplemented,
      excludedProviders,
      skipped
    });
  }

  const ranked = candidates.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    preferred: preferredEligible && candidate.provider === preferredProvider
  }));

  return {
    selected_provider: ranked.find((candidate) => candidate.provider === selected.provider),
    candidates: ranked.slice(0, limit),
    eligibility: {
      eligible_providers: eligible,
      skipped_count: skipped.length,
      stages: stagesSummary,
      environment: requestedEnvironment || 'production-safety-default'
    },
    execution: {
      selected_provider: selected.provider,
      production_eligible: Boolean(selected.production_eligible),
      sandbox_eligible: Boolean(selected.sandbox_eligible),
      environment: selected.environment,
      can_execute: Boolean(selected.production_eligible || selected.sandbox_eligible),
      note: selected.production_eligible
        ? 'Selected provider is production-eligible for this operation.'
        : 'Selected provider is not production-eligible for this operation.'
    },
    decision: {
      country: country || null,
      currency: currency || null,
      paymentMethod: paymentMethod || null,
      transactionType,
      operation,
      preferredProvider: preferredProvider || null,
      excludedProviders,
      onlyImplemented,
      candidateCount: candidates.length,
      skippedCount: skipped.length,
      explanation: describeSelection(selected, candidates),
      evaluatedAt: new Date().toISOString()
    },
    skipped
  };
}

module.exports = {
  providerRoutingService: {
    routeProviders
  }
};