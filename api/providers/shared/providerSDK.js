'use strict';

/**
 * Provider SDK — central entry point for all shared provider infrastructure.
 *
 * Import this when you need multiple provider primitives in one go:
 *
 *   const { ProviderSDK } = require('../shared/providerSDK');
 *   const cfg  = ProviderSDK.config.getProviderConfig('stripe');
 *   const reg  = ProviderSDK.registry.providerModuleRegistry;
 *   const base = ProviderSDK.BaseProvider;
 *
 * Or use named imports for individual pieces:
 *
 *   const { providerModuleRegistry, getProviderConfig } = require('../shared/providerSDK');
 */

const BaseProvider = require('../base-provider');
const {
  ProviderModuleRegistry,
  discoverProviderModules,
  normalizeProviderKey,
  providerModuleRegistry
} = require('../moduleRegistry');
const { createProviderAdapter } = require('../../adapters/paymentProviders/baseProviderAdapter');
const { createProviderWorkspaceModule } = require('./createProviderWorkspaceModule');
const {
  getProviderConfig,
  isProviderConfigured,
  listProviderConfigs
} = require('./providerConfig');

// ---------------------------------------------------------------------------
// Aggregated SDK object
// ---------------------------------------------------------------------------

const ProviderSDK = Object.freeze({
  /** Base class for all provider modules */
  BaseProvider,

  /** Registry primitives */
  registry: Object.freeze({
    ProviderModuleRegistry,
    discoverProviderModules,
    normalizeProviderKey,
    providerModuleRegistry
  }),

  /** Adapter factory */
  createProviderAdapter,

  /** Module factory */
  createProviderWorkspaceModule,

  /** Config helpers */
  config: Object.freeze({
    getProviderConfig,
    isProviderConfigured,
    listProviderConfigs
  })
});

module.exports = {
  ProviderSDK,
  BaseProvider,
  ProviderModuleRegistry,
  discoverProviderModules,
  normalizeProviderKey,
  providerModuleRegistry,
  createProviderAdapter,
  createProviderWorkspaceModule,
  getProviderConfig,
  isProviderConfigured,
  listProviderConfigs
};
