// ProviderRegistry is the live module registry for Transferly.
// Discovery, feature-gating, and provider lookup are handled by ProviderModuleRegistry.
// This file re-exports the live registry so any code that imports registry.js
// gets the same singleton used by all routes and services.

const {
  ProviderModuleRegistry,
  discoverProviderModules,
  normalizeProviderKey,
  providerModuleRegistry
} = require('./moduleRegistry');

module.exports = {
  ProviderModuleRegistry,
  discoverProviderModules,
  normalizeProviderKey,
  providerModuleRegistry
};
