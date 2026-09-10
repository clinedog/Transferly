'use strict';

const { AppError } = require('../../utils/errors');

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

function selectBestProvider({ country, currency, paymentMethod, transactionType, providers }) {
  if (!providers || providers.length === 0) {
    throw new AppError(400, 'NO_PROVIDERS_AVAILABLE', 'No payment providers available.');
  }

  const candidates = [];

  for (const provider of providers) {
    const caps = provider.getCapabilities();
    if (transactionType === 'payout' && !caps.payouts) continue;
    const countryCheck = supportsFilteredValue(caps, 'supportedCountries', 'countryScope', country, 'supportsAllCountries');
    if (!countryCheck.eligible) continue;
    const currencyCheck = supportsFilteredValue(caps, 'supportedCurrencies', 'currencyScope', currency, 'supportsAllCurrencies');
    if (!currencyCheck.eligible) continue;
    if (paymentMethod && caps[paymentMethod] !== true) continue;
    candidates.push(provider);
  }

  if (candidates.length === 0) {
    throw new AppError(400, 'NO_SUITABLE_PROVIDER', 'No provider supports the requested country, currency, and payment method.', { country, currency, paymentMethod, transactionType });
  }

  candidates.sort((a, b) => a.getOrder() - b.getOrder());

  return {
    provider: candidates[0],
    decision: {
      selectedProvider: candidates[0].getKey(),
      candidateCount: candidates.length,
      country, currency, paymentMethod, transactionType,
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
