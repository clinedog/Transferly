'use strict';

const config = require('../config');

function parseEntries(value) {
  if (!value) return new Set();
  return new Set(
    String(value)
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function getPolicy(overrides = {}) {
  return {
    providers: parseEntries(overrides.providers ?? config.PAYMENT_PROVIDER_KILL_SWITCHES),
    corridors: parseEntries(overrides.corridors ?? config.PAYMENT_CORRIDOR_KILL_SWITCHES)
  };
}

function getBlockedReason({ provider, country, currency, policy } = {}) {
  const normalizedProvider = normalize(provider);
  const normalizedCountry = normalize(country);
  const normalizedCurrency = normalize(currency);
  const resolved = getPolicy(policy);

  if (normalizedProvider && resolved.providers.has(normalizedProvider)) {
    return `Provider ${normalizedProvider} is temporarily disabled by a kill switch.`;
  }

  const corridorKeys = [
    normalizedProvider && normalizedCountry && normalizedCurrency
      ? `${normalizedProvider}:${normalizedCountry}:${normalizedCurrency}`
      : null,
    normalizedProvider && normalizedCurrency ? `${normalizedProvider}:*:${normalizedCurrency}` : null,
    normalizedProvider && normalizedCountry ? `${normalizedProvider}:${normalizedCountry}:*` : null,
    normalizedProvider ? `${normalizedProvider}:*:*` : null
  ].filter(Boolean);

  const blockedKey = corridorKeys.find((key) => resolved.corridors.has(key));
  return blockedKey
    ? `Corridor ${blockedKey} is temporarily disabled by a kill switch.`
    : null;
}

function isBlocked(input = {}) {
  return Boolean(getBlockedReason(input));
}

module.exports = {
  providerKillSwitchService: {
    getBlockedReason,
    isBlocked
  },
  getBlockedReason,
  isBlocked
};
