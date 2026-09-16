const { getProviderWorkspace, getProviderLanes } = require('../constants/providerWorkspaceContract');
const { buildProviderReadinessDescriptor } = require('../core/financial/providerContract');
const { providerModuleRegistry } = require('../providers/moduleRegistry');

function buildRoutes(provider) {
  const prefix = `/api/providers/${encodeURIComponent(provider)}`;

  return {
    workspace: prefix,
    readiness: `${prefix}/readiness`,
    health: `${prefix}/health`,
    status: `${prefix}/status`,
    dashboard: `${prefix}/dashboard`
  };
}

function buildLifecycle(module, workspace) {
  if (module.metadata?.lifecycle) return module.metadata.lifecycle;
  if (workspace?.status === 'live') return 'production-ready';
  return 'planned';
}

function presentProviderManifest(module) {
  const workspace = getProviderWorkspace(module.key);
  const adapter = module.adapter.getSummary();
  const enabled = providerModuleRegistry.isEnabled(module.key);
  const readiness = buildProviderReadinessDescriptor({
    provider: module.key,
    adapterContract: module.adapter.getAdapterContract(),
    summary: adapter,
    enabled
  });

  return {
    key: module.key,
    display_name: workspace?.displayName || adapter.display_name,
    category: module.metadata?.category || 'payments',
    lifecycle: buildLifecycle(module, workspace),
    enabled,
    enabled_by_default: module.enabledByDefault !== false,
    feature_flags: {
      provider_enabled: enabled,
      default_enabled: module.enabledByDefault !== false
    },
    configuration: {
      status: adapter.status,
      configured: readiness.configured,
      required_env: readiness.requiredConfiguration,
      missing_env: readiness.missingConfiguration
    },
    readiness: {
      environment: readiness.environment,
      production_enabled: readiness.productionEnabled,
      sandbox_enabled: readiness.sandboxEnabled,
      operations: readiness.operations
    },
    capabilities: adapter.capabilities || {},
    routes: buildRoutes(module.key),
    navigation: workspace
      ? {
          visible: enabled,
          default_lane: workspace.lanes?.[0]?.id || 'overview',
          lanes: getProviderLanes(module.key).map((lane) => ({
            id: lane.id,
            label: lane.label,
            status: lane.status,
            mini_app_section: lane.miniAppSection
          }))
        }
      : {
          visible: false,
          default_lane: null,
          lanes: []
        },
    permissions: {
      workspace: 'authenticated_user',
      readiness: 'authenticated_user',
      operational_summary: 'admin'
    }
  };
}

function listProviderManifests({ includeDisabled = false } = {}) {
  return providerModuleRegistry.list({ includeDisabled }).map(presentProviderManifest);
}

module.exports = {
  providerManifestService: {
    listProviderManifests
  }
};
