const { providerModuleRegistry } = require('../providers/moduleRegistry');

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

module.exports = {
  paymentProviderRegistry: {
    listProviders,
    getProvider,
    getProviderStatus,
    listInvoiceFeatures,
    getProviderInvoiceFeatures,
    listProviderAdapterContracts,
    getProviderAdapterContract
  }
};
