const fs = require('node:fs');
const path = require('node:path');

const config = require('../config');
const { AppError } = require('../utils/errors');

function normalizeProviderKey(value) {
  return String(value || '').trim().toLowerCase();
}

function discoverProviderModules(directory = __dirname) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'shared')
    .sort((left, right) => left.name.localeCompare(right.name));
  const modules = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name, 'index.js');
    if (!fs.existsSync(entryPath)) continue;
    const provider = require(entryPath);
    const key = normalizeProviderKey(provider?.key);
    if (!key || key !== entry.name || !provider.adapter || typeof provider.getContract !== 'function') {
      throw new Error(`Provider module ${entry.name} must expose key, adapter, and getContract().`);
    }
    modules.push(Object.freeze({ ...provider, key }));
  }

  return Object.freeze(modules.sort((left, right) => left.order - right.order || left.key.localeCompare(right.key)));
}

class ProviderModuleRegistry {
  constructor({ modules = discoverProviderModules(), enabledKeys = config.ENABLED_PAYMENT_PROVIDERS } = {}) {
    this.modulesByKey = new Map();
    this.enabledKeys = enabledKeys instanceof Set ? enabledKeys : new Set(enabledKeys || []);
    for (const provider of modules) {
      if (this.modulesByKey.has(provider.key)) throw new Error(`Provider ${provider.key} is registered twice.`);
      this.modulesByKey.set(provider.key, provider);
    }
  }

  isEnabled(key) {
    const normalized = normalizeProviderKey(key);
    const provider = this.modulesByKey.get(normalized);
    if (!provider) return false;

    // An explicit feature-flag list is an allowlist. Without one, preserve
    // established providers while keeping scaffolded integrations dark.
    return this.enabledKeys.size > 0
      ? this.enabledKeys.has(normalized)
      : provider.enabledByDefault !== false;
  }

  list({ includeDisabled = false } = {}) {
    return [...this.modulesByKey.values()].filter((provider) => includeDisabled || this.isEnabled(provider.key));
  }

  get(key) {
    const normalized = normalizeProviderKey(key);
    const provider = this.modulesByKey.get(normalized);
    if (!provider || !this.isEnabled(normalized)) {
      throw new AppError(404, 'PAYMENT_PROVIDER_NOT_FOUND', 'Payment provider not found.', {
        provider: key,
        available_providers: this.list().map((entry) => entry.key)
      });
    }
    return provider;
  }
}

const providerModuleRegistry = new ProviderModuleRegistry();

module.exports = {
  ProviderModuleRegistry,
  discoverProviderModules,
  normalizeProviderKey,
  providerModuleRegistry
};
