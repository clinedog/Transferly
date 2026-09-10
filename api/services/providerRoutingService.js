'use strict';

const { paymentProviderRegistry } = require('./paymentProviderRegistry');
const { providerStatusService } = require('./providerStatusService');
const { providerCapabilityService } = require('./providerCapabilityService');
const { AppError } = require('../utils/errors');

const ROUTING_OPERATION_BY_TRANSACTION_TYPE = Object.freeze({
  payment: 'invoices',
  payout: 'payouts'
});

const ROUTING_WEIGHTS = Object.freeze({
  operation: 40,
  health: 30,
  readiness: 20,
  orderPriority: 10
});

function normalizeProviderKey(value) {
  return String(value || '').trim().toLowerCase();
}

function parseExcludedProviders(value) {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(entries.map(normalizeProviderKey).filter(Boolean))];
}

function isOperationImplemented(status) {
  return status === 'live' || status === 'preview';
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

function matchesPaymentMethod({ summaryCapabilities, workspaceCapabilities }, paymentMethod) {
  if (!paymentMethod) return true;
  const wanted = String(paymentMethod).trim().toLowerCase();
  if (!wanted) return true;
  if (summaryCapabilities && typeof summaryCapabilities === 'object' && !Array.isArray(summaryCapabilities)) {
    const hit = Object.entries(summaryCapabilities).find(([key, value]) => String(key).toLowerCase() === wanted && Boolean(value));
    if (hit) return true;
  }
  if (Array.isArray(workspaceCapabilities)) {
    return workspaceCapabilities.some((entry) => String(entry).toLowerCase() === wanted);
  }
  return false;
}

function matchesRoutingValue(entries, value) {
  if (!value) return true;
  if (!Array.isArray(entries) || entries.length === 0) return true;
  const wanted = String(value).trim().toUpperCase();
  return entries.some((entry) => String(entry).trim().toUpperCase() === wanted);
}

function buildProviderCandidate({ moduleEntry, capability, status, operation }) {
  const operationDetail = capability?.operations?.[operation] || {};
  const operationStatus = operationDetail.status || 'unsupported';
  const implemented = Boolean(operationDetail.implemented || isOperationImplemented(operationStatus));
  const healthScore = typeof status?.health_score === 'number' ? status.health_score : null;
  const readinessPenalty = status?.ready === false ? 10 : 0;
  return {
    provider: moduleEntry.key,
    operation_status: operationStatus,
    implemented,
    status: status?.status || 'unknown',
    ready: Boolean(status?.ready),
    health_score: healthScore,
    health_status: status?.health_status || 'unknown',
    capabilities: Array.isArray(capability?.capabilities) ? capability.capabilities : [],
    total_score:
      (implemented ? ROUTING_WEIGHTS.operation : 0) +
      Math.max(0, (healthScore === null ? 0 : Math.round((healthScore / 100) * ROUTING_WEIGHTS.health)) - readinessPenalty) +
      (status?.ready === true ? ROUTING_WEIGHTS.readiness : 0) +
      scoreOrderPriority(moduleEntry.order),
    order: moduleEntry.order || 100,
    order_index: orderIndexByOrder(moduleEntry.order),
    warnings: Array.isArray(status?.warnings) ? status.warnings.slice(0, 5) : []
  };
}

function describeSelection(selected, candidates) {
  if (!selected) return null;
  if (selected.ready && selected.health_status !== 'critical' && selected.implemented) {
    return 'Provider is configured, ready, and supports the requested transaction.';
  }
  if (selected.health_status === 'critical') {
    return 'Highest ranked matching provider, although its operational health is critical.';
  }
  if (!selected.ready) {
    return 'Highest ranked matching provider, although provider setup is incomplete.';
  }
  return candidates.length > 1
    ? 'Best ranked provider among all eligible candidates.'
    : 'Only provider matching the requested transaction filters.';
}



async function routeProviders(input = {}) {
  const transactionType = input.transactionType === 'payout' ? 'payout' : 'payment';
  const operation = ROUTING_OPERATION_BY_TRANSACTION_TYPE[transactionType];
  const country = input.country ? String(input.country).trim().toUpperCase() : undefined;
  const currency = input.currency ? String(input.currency).trim().toUpperCase() : undefined;
  const paymentMethod = input.paymentMethod ? String(input.paymentMethod).trim() : undefined;
  const preferredProvider = input.preferredProvider ? normalizeProviderKey(input.preferredProvider) : undefined;
  const excludedProviders = parseExcludedProviders(input.excludedProviders);
  const onlyImplemented = input.onlyImplemented !== false;
  const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 25);
  const summaries = new Map(
    paymentProviderRegistry.listProviders().map((provider) => [normalizeProviderKey(provider.key), provider])
  );
  const modules = paymentProviderRegistry.listProviders().map((provider) => ({
    key: normalizeProviderKey(provider.key),
    order: provider.order ?? 100,
    name: provider.display_name || provider.key
  }));
  const excluded = new Set(excludedProviders);
  const candidates = [];
  const skipped = [];

  for (const moduleEntry of modules) {
    const provider = normalizeProviderKey(moduleEntry.key);
    if (!provider || excluded.has(provider)) {
      if (provider) skipped.push({ provider, reason: 'Explicitly excluded from routing.' });
      continue;
    }

    let capability = null;
    let status = null;
    try {
      capability = providerCapabilityService.getProviderCapabilities(provider);
    } catch (error) {
      skipped.push({ provider, reason: error?.message || 'Provider capabilities unavailable.' });
      continue;
    }
    try {
      status = await providerStatusService.getProviderStatus(provider);
    } catch (error) {
      skipped.push({ provider, reason: error?.message || 'Provider status unavailable.' });
      continue;
    }

    const summary = summaries.get(provider) || {};
    if (
      !matchesPaymentMethod(
        { summaryCapabilities: summary.capabilities, workspaceCapabilities: capability?.capabilities },
        paymentMethod
      )
    ) {
      skipped.push({ provider, reason: `Provider does not advertise payment method ${paymentMethod}.` });
      continue;
    }

    const candidate = buildProviderCandidate({ moduleEntry, capability, status, operation });
    if (country && !matchesRoutingValue(summary?.capabilities?.supportedCountries, country)) {
      skipped.push({ provider, reason: `Provider is not eligible for country ${country}.` });
      continue;
    }
    if (currency && !matchesRoutingValue(summary?.capabilities?.supportedCurrencies, currency)) {
      skipped.push({ provider, reason: `Provider is not eligible for currency ${currency}.` });
      continue;
    }
    if (onlyImplemented && !candidate.implemented) {
      skipped.push({ provider, reason: `Provider operation ${operation} is not implemented for this provider.` });
      continue;
    }
    candidates.push(candidate);
  }

  candidates.sort((left, right) => {
    if (right.total_score !== left.total_score) return right.total_score - left.total_score;
    if (left.ready !== right.ready) return left.ready ? -1 : 1;
    if (left.order_index !== right.order_index) return left.order_index - right.order_index;
    return String(left.provider).localeCompare(String(right.provider));
  });

  const selected = preferredProvider && candidates.some((candidate) => candidate.provider === preferredProvider)
    ? candidates.find((candidate) => candidate.provider === preferredProvider)
    : candidates[0] || null;

  if (!selected) {
    throw new AppError(400, 'NO_PROVIDER_ROUTE', 'No provider route matches the requested transaction filters.', {
      country, currency, paymentMethod: paymentMethod || null, transactionType, operation,
      preferredProvider: preferredProvider || null, onlyImplemented, skipped
    });
  }

  const ranked = candidates.map((candidate, index) => ({ ...candidate, rank: index + 1, preferred: preferredProvider === candidate.provider }));
  return {
    selected_provider: ranked.find((candidate) => candidate.provider === selected.provider),
    candidates: ranked.slice(0, limit),
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
