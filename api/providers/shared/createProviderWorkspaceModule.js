const { buildProviderReadinessDescriptor } = require('../../core/financial/providerContract');

function createProviderWorkspaceModule({
  key,
  adapter,
  fixtures = {},
  order = Number.MAX_SAFE_INTEGER,
  enabledByDefault = true,
  metadata = {}
}) {
  if (!key) {
    throw new Error('Provider workspace module requires a key.');
  }

  if (!adapter || typeof adapter.getAdapterContract !== 'function') {
    throw new Error(`Provider workspace module "${key}" requires an adapter contract.`);
  }

  function getContract() {
    return adapter.getAdapterContract();
  }

  function getReadiness() {
    const contract = getContract();
    return buildProviderReadinessDescriptor({
      provider: key,
      adapterContract: contract,
      summary: adapter.getSummary(),
      enabled: enabledByDefault
    });
  }

  return Object.freeze({
    key,
    order,
    enabledByDefault,
    metadata: Object.freeze({ ...metadata }),
    adapter,
    fixtures,
    getContract,
    getReadiness
  });
}

module.exports = {
  createProviderWorkspaceModule
};
