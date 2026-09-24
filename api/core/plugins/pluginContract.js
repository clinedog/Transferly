'use strict';

const { AppError } = require('../../utils/errors');

const PLUGIN_LIFECYCLE = Object.freeze({
  DISCOVERED: 'DISCOVERED',
  INSTALLED: 'INSTALLED',
  VERIFIED: 'VERIFIED',
  CONFIGURED: 'CONFIGURED',
  ENABLED: 'ENABLED',
  DISABLED: 'DISABLED',
  REVOKED: 'REVOKED'
});

const PLUGIN_RISK_CLASS = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

function required(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new AppError(422, 'PLUGIN_FIELD_REQUIRED', `${field} is required.`);
  return normalized;
}

function normalizePluginManifest(input = {}) {
  const pluginId = required(input.pluginId, 'pluginId');
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)+$/i.test(pluginId)) {
    throw new AppError(422, 'PLUGIN_ID_INVALID', 'pluginId must be a namespaced identifier.');
  }
  const permissions = [...new Set((input.permissions || []).map((entry) => required(entry, 'permission')))];
  const capabilities = [...new Set((input.capabilities || []).map((entry) => required(entry, 'capability')))];
  const environments = [...new Set((input.supportedEnvironments || ['sandbox']).map((entry) => required(entry, 'environment')))];
  const riskClass = String(input.riskClass || PLUGIN_RISK_CLASS.LOW).trim().toUpperCase();
  if (!Object.values(PLUGIN_RISK_CLASS).includes(riskClass)) {
    throw new AppError(422, 'PLUGIN_RISK_CLASS_INVALID', 'Plugin risk class is invalid.');
  }
  if (input.financialSideEffects === true && !permissions.some((permission) => permission.startsWith('tool:'))) {
    throw new AppError(422, 'PLUGIN_FINANCIAL_ACCESS_INVALID', 'Financial plugins must use approved tools.');
  }

  return Object.freeze({
    pluginId,
    version: required(input.version, 'version'),
    publisher: required(input.publisher, 'publisher'),
    displayName: required(input.displayName, 'displayName'),
    permissions: Object.freeze(permissions),
    capabilities: Object.freeze(capabilities),
    requiredApis: Object.freeze([...(input.requiredApis || [])]),
    events: Object.freeze([...(input.events || [])]),
    supportedCountries: Object.freeze([...(input.supportedCountries || [])]),
    supportedCurrencies: Object.freeze([...(input.supportedCurrencies || [])]),
    supportedEnvironments: Object.freeze(environments),
    riskClass,
    dataAccess: Object.freeze([...(input.dataAccess || [])]),
    financialSideEffects: input.financialSideEffects === true,
    verified: input.verified === true,
    lifecycle: input.lifecycle || PLUGIN_LIFECYCLE.DISCOVERED
  });
}

module.exports = {
  PLUGIN_LIFECYCLE,
  PLUGIN_RISK_CLASS,
  normalizePluginManifest
};
