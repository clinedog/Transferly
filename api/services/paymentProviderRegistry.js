const { providerModuleRegistry } = require('../providers/moduleRegistry');
const { selectBestProvider, filterByCapability, validateCapabilities } = require('../core/financial/providerRegistry');

function listProviders() {
  return providerModuleRegistry.list().map((provider) => provider.adapter.getSummary());
}

function getProvider(providerKey) {
  return providerModuleRegistry.get(providerKey).adapter;
}

function getProviderStatus(providerKey) {
  return getProvider(providerKey).getStatus();
}

function listInvoiceFeatures() {
  return providerModuleRegistry.list().map((provider) => provider.adapter.getInvoiceFeatures());
}

function getProviderInvoiceFeatures(providerKey) {
  return getProvider(providerKey).getInvoiceFeatures();
}

function listProviderAdapterContracts() {
  return providerModuleRegistry.list().map((provider) => provider.adapter.getAdapterContract());
}

function getProviderAdapterContract(providerKey) {
  return getProvider(providerKey).getAdapterContract();
}

/**
 * Adapt a payment provider adapter (legacy adapter shape) to the abstract
 * provider contract expected by core/financial/providerRegistry utilities.
 *
 * @param {object} moduleEntry - entry from providerModuleRegistry
 * @returns {object} provider-shaped object usable with selectBestProvider etc.
 */
function adaptToProvider(moduleEntry) {
  const adapter = moduleEntry.adapter;
  const contract = adapter.getAdapterContract();
  return {
    key: moduleEntry.key,
    name: contract.display_name || moduleEntry.key,
    order: moduleEntry.order || 100,
    getKey: () => moduleEntry.key,
    getName: () => contract.display_name || moduleEntry.key,
    getOrder: () => moduleEntry.order || 100,
    getCapabilities: () => ({
      payouts: contract.operations?.createPayout?.status !== 'unsupported',
      refunds: contract.operations?.createRefund?.status !== 'unsupported',
      webhooks: Boolean(contract.capabilities?.webhooks),
      bankTransfer: Boolean(contract.capabilities?.bank_transfer),
      cardPayments: Boolean(contract.capabilities?.card_payments),
      mobileMoney: Boolean(contract.capabilities?.mobile_money),
      supportedCountries: contract.supported_countries || [],
      supportedCurrencies: contract.supported_currencies || []
    })
  };
}

/**
 * Returns the highest-priority provider matching the requested country, currency,
 * payment method, and transaction type. Throws when no suitable provider is found.
 *
 * @param {object} opts
 * @param {string} opts.country        - ISO 3166-1 alpha-2 country code
 * @param {string} opts.currency       - ISO 4217 currency code
 * @param {string} [opts.paymentMethod] - payment method capability to require
 * @param {string} [opts.transactionType='payment'] - 'payment' or 'payout'
 * @returns {{provider: object, decision: object}}
 */
function selectProvider({ country, currency, paymentMethod, transactionType = 'payment' }) {
  const providers = providerModuleRegistry.list().map(adaptToProvider);
  return selectBestProvider({ country, currency, paymentMethod, transactionType, providers });
}

/**
 * Returns providers (from the enabled module registry) that advertise a capability.
 *
 * @param {string} capability
 * @returns {Array<object>} adapted provider objects
 */
function listProvidersWithCapability(capability) {
  const providers = providerModuleRegistry.list().map(adaptToProvider);
  return filterByCapability(providers, capability);
}

/**
 * Validates that a provider exposes all required capabilities.
 *
 * @param {string} providerKey
 * @param {string[]} requiredCapabilities
 * @returns {{valid: boolean, missing: string[]}}
 */
function validateProviderCapabilities(providerKey, requiredCapabilities) {
  const moduleEntry = providerModuleRegistry.get(providerKey);
  return validateCapabilities(adaptToProvider(moduleEntry), requiredCapabilities);
}

module.exports = {
  paymentProviderRegistry: {
    listProviders,
    getProvider,
    getProviderStatus,
    listInvoiceFeatures,
    getProviderInvoiceFeatures,
    listProviderAdapterContracts,
    getProviderAdapterContract,
    selectProvider,
    listProvidersWithCapability,
    validateProviderCapabilities
  }
};
