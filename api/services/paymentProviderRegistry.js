const { providerModuleRegistry } = require('../providers/moduleRegistry');
const { AppError } = require('../utils/errors');
const { selectBestProvider, filterByCapability, validateCapabilities } = require('../core/financial/providerRegistry');
const {
  CANONICAL_OPERATION_METHODS,
  normalizeExecutionStatus
} = require('../core/financial/providerContract');
const { executeProviderOperation } = require('../core/financial/providerExecution');
const { executeFinancialOperation } = require('../core/financial/financialExecutionService');

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

async function executeOperation({ provider, operation, input, environment, mutating } = {}) {
  return executeProviderOperation(getProvider(provider), operation, input, {
    environment,
    mutating
  });
}

/**
 * Additive canonical execution entry point. Existing executeOperation callers
 * retain the raw adapter response; new financial flows can opt into the
 * context, idempotency, and durable-result boundary.
 */
async function executeFinancially({ context, input, environment, mutating } = {}) {
  if (!context?.provider) {
    throw new AppError(422, 'FINANCIAL_PROVIDER_REQUIRED', 'A provider is required for canonical financial execution.');
  }

  return executeFinancialOperation({
    context,
    execute: async () => {
      const adapterOperation = CANONICAL_OPERATION_METHODS[context.operation]?.find((method) =>
        typeof getProvider(context.provider)?.[method] === 'function'
      );
      if (!adapterOperation) {
        throw new AppError(422, 'PAYMENT_PROVIDER_OPERATION_UNAVAILABLE',
          `Provider ${context.provider} does not implement ${context.operation}.`, {
            provider: context.provider,
            operation: context.operation
          });
      }
      const response = await executeOperation({
        provider: context.provider,
        operation: adapterOperation,
        input,
        environment: environment || context.environment,
        mutating
      });

      return {
        status: response?.status || response?.state || response?.outcome || 'unknown',
        authoritative: response?.authoritative === true,
        reconciliationRequired: response?.reconciliationRequired === true ||
          response?.reconciliation_required === true ||
          String(response?.status || response?.state || response?.outcome || '').toLowerCase() === 'unknown',
        resourceId: response?.resourceId || response?.id || null,
        providerRequestId: response?.providerRequestId || response?.provider_request_id || null,
        data: response
      };
    }
  });
}

/**
 * Adapt a payment provider adapter (legacy adapter shape) to the abstract
 * provider contract expected by core/financial/providerRegistry utilities.
 *
 * Capability inference is STRICTLY explicit:
 *   - payout capability never implies bank-transfer payment support.
 *   - hosted payment links never imply card payment support.
 *   - empty country/currency declarations mean the scope is UNSPECIFIED and
 *     must not be treated as universal coverage.
 *
 * @param {object} moduleEntry - entry from providerModuleRegistry
 * @returns {object} provider-shaped object usable with selectBestProvider etc.
 */
function adaptToProvider(moduleEntry) {
  const adapter = moduleEntry.adapter;
  const contract = adapter.getAdapterContract();
  const summaryCapabilities = adapter.getSummary()?.capabilities || {};

  function operationStatus(operationName) {
    return normalizeExecutionStatus(contract.operations?.[operationName]?.status) || 'unsupported';
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function resolveScope(values, allFlag) {
    if (allFlag) return 'global';
    return values.length > 0 ? 'allowlist' : 'unspecified';
  }

  const supportedCountries = asArray(summaryCapabilities.supported_countries || summaryCapabilities.countries);
  const supportedCurrencies = asArray(summaryCapabilities.supported_currencies || summaryCapabilities.currencies);

  return {
    key: moduleEntry.key,
    name: contract.display_name || moduleEntry.key,
    order: moduleEntry.order || 100,
    getKey: () => moduleEntry.key,
    getName: () => contract.display_name || moduleEntry.key,
    getOrder: () => moduleEntry.order || 100,
    getCapabilities: () => ({
      payouts: operationStatus('createPayout') !== 'unsupported',
      refunds: Boolean(summaryCapabilities.refunds),
      webhooks: operationStatus('verifyWebhook') !== 'unsupported',
      bankTransfer: Boolean(summaryCapabilities.bank_transfer || summaryCapabilities.bankTransfer),
      cardPayments: Boolean(summaryCapabilities.card_payments || summaryCapabilities.cardPayments),
      mobileMoney: Boolean(summaryCapabilities.mobile_money),
      walletPayments: Boolean(summaryCapabilities.wallet_payments || summaryCapabilities.walletPayments),
      supportedCountries,
      supportedCurrencies,
      countryScope: resolveScope(supportedCountries, Boolean(summaryCapabilities.supports_all_countries || summaryCapabilities.supportsAllCountries)),
      currencyScope: resolveScope(supportedCurrencies, Boolean(summaryCapabilities.supports_all_currencies || summaryCapabilities.supportsAllCurrencies))
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
    executeOperation,
    executeFinancially,
    selectProvider,
    listProvidersWithCapability,
    validateProviderCapabilities
  }
};
