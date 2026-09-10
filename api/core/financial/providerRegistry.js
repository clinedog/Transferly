'use strict';

const { AppError } = require('../../utils/errors');

function selectBestProvider({ country, currency, paymentMethod, transactionType, providers }) {
  if (!providers || providers.length === 0) {
    throw new AppError(400, 'NO_PROVIDERS_AVAILABLE', 'No payment providers available.');
  }

  const candidates = [];

  for (const provider of providers) {
    const caps = provider.getCapabilities();
    if (transactionType === 'payout' && !caps.payouts) continue;
    if (caps.supportedCountries.length && !caps.supportedCountries.includes(country)) continue;
    if (caps.supportedCurrencies.length && !caps.supportedCurrencies.includes(currency)) continue;
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
