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
    return {
      provider: key,
      status: contract.configured ? 'sandbox-ready' : 'needs-env',
      configured: contract.configured,
      mode: contract.mode,
      required_env: contract.required_env,
      missing_env: contract.missing_env,
      operations: contract.operations
    };
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
