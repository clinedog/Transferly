const {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS
} = require('../constants/providerWorkspaceContract');
const { buildProviderReadinessDescriptor, normalizeExecutionStatus } = require('../core/financial/providerContract');
const { providerCapabilityService } = require('./providerCapabilityService');
const { providerModuleRegistry } = require('../providers/moduleRegistry');

function summarizeOperationReadiness(operations = {}, descriptor) {
  return PROVIDER_OPERATION_KEYS.map((operation) => {
    const support = operations[operation] || {
      status: 'unsupported',
      implemented: false
    };

    // `setup` predates the canonical readiness contract. Keep it in `status`
    // for existing consumers, while publishing its unambiguous replacement in
    // `operation_status`. No client may infer execution from either field.
    const operationStatus = normalizeExecutionStatus(support.status) ||
      (support.status === 'setup' ? 'coming_soon' : 'unsupported');
    const canonical = descriptor.operations[operation];

    return {
      operation,
      status: support.status,
      operation_status: operationStatus,
      implemented: Boolean(support.implemented),
      actionable: canonical.executionEligible.production,
      execution_eligible: canonical.executionEligible,
      production_enabled: canonical.productionEnabled,
      sandbox_enabled: canonical.sandboxEnabled,
      reason: support.reason || null
    };
  });
}

function summarizeLaneReadiness(lanes = []) {
  return lanes.map((lane) => ({
    id: lane.id,
    label: lane.label,
    status: lane.status,
    bot_action: lane.bot_action || null,
    mini_app_section: lane.mini_app_section,
    needs_backend: lane.status === 'setup',
    needs_product_review: lane.status === 'preview'
  }));
}

function buildReadiness(capability) {
  const module = providerModuleRegistry.get(capability.slug);
  const descriptor = buildProviderReadinessDescriptor({
    provider: capability.slug,
    adapterContract: module.adapter.getAdapterContract(),
    summary: module.adapter.getSummary(),
    enabled: providerModuleRegistry.isEnabled(capability.slug),
    operationStatuses: Object.fromEntries(Object.entries(capability.operations || {}).map(([operation, support]) => [operation, support.status]))
  });
  const operations = summarizeOperationReadiness(capability.operations, descriptor);
  const lanes = summarizeLaneReadiness(capability.lanes);
  const missingEnv = capability.registry_status?.missing_env || [];
  const liveOperations = operations.filter((operation) => operation.implemented);
  const setupOperations = operations.filter((operation) => operation.status === 'setup');
  const unsupportedOperations = operations.filter((operation) => operation.status === 'unsupported');

  return {
    provider: capability.slug,
    contract_version: PROVIDER_CONTRACT_VERSION,
    display_name: capability.display_name,
    status: capability.status,
    environment: descriptor.environment,
    enabled: descriptor.enabled,
    production_enabled: descriptor.productionEnabled,
    sandbox_enabled: descriptor.sandboxEnabled,
    countries: descriptor.countries,
    country_scope: descriptor.countryScope,
    currencies: descriptor.currencies,
    currency_scope: descriptor.currencyScope,
    payment_methods: descriptor.paymentMethods,
    limits: descriptor.limits,
    configuration: {
      configured: descriptor.configured,
      required: descriptor.requiredConfiguration,
      missing: descriptor.missingConfiguration
    },
    credentials: {
      configured: descriptor.configured,
      // Only names are exposed; neither values nor credential material leave
      // the adapter boundary.
      required: descriptor.requiredCredentials,
      missing: descriptor.missingCredentials
    },
    ready: missingEnv.length === 0 && liveOperations.some((operation) => operation.production_enabled),
    registry_status: capability.registry_status,
    missing_env: missingEnv,
    operations,
    lanes,
    summary: {
      live_operations: liveOperations.length,
      setup_operations: setupOperations.length,
      unsupported_operations: unsupportedOperations.length,
      live_lanes: lanes.filter((lane) => lane.status === 'live').length,
      preview_lanes: lanes.filter((lane) => lane.status === 'preview').length,
      setup_lanes: lanes.filter((lane) => lane.status === 'setup').length
    },
    recommended_next_steps: buildNextSteps(capability, operations, lanes, missingEnv)
  };
}

function buildNextSteps(capability, operations, lanes, missingEnv) {
  const steps = [];

  if (missingEnv.length > 0) {
    steps.push({
      code: 'CONFIGURE_ENV',
      label: 'Configure missing provider environment variables.',
      detail: missingEnv.join(', ')
    });
  }

  for (const operation of operations) {
    if (operation.status === 'setup') {
      steps.push({
        code: `ENABLE_${operation.operation.toUpperCase()}`,
        label: `Finish ${operation.operation} backend support for ${capability.display_name}.`,
        detail: 'Add adapter implementation, validation, tests, and provider-specific operational checks.'
      });
    }
  }

  for (const lane of lanes) {
    if (lane.status === 'preview') {
      steps.push({
        code: `REVIEW_${lane.id.toUpperCase()}`,
        label: `Review ${lane.label} before promoting it to live.`,
        detail: 'Confirm API behavior, bot action, Mini App route state, and production logging.'
      });
    }
  }

  if (steps.length === 0) {
    steps.push({
      code: 'MONITOR',
      label: 'Monitor provider activity, errors, and webhook delivery.',
      detail: 'Keep dashboards and logs tied to request ids, provider ids, and resource ids.'
    });
  }

  return steps;
}

function listProviderReadiness() {
  return providerCapabilityService.listProviderCapabilities().map(buildReadiness);
}

function getProviderReadiness(provider) {
  return buildReadiness(providerCapabilityService.getProviderCapabilities(provider));
}

module.exports = {
  PROVIDER_CONTRACT_VERSION,
  providerReadinessService: {
    getProviderReadiness,
    listProviderReadiness
  }
};
