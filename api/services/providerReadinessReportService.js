const { providerHealthService } = require('./providerHealthService');
const { providerManifestService } = require('./providerManifestService');
const { providerReadinessService } = require('./providerReadinessService');

function disabledReadiness(manifest) {
  const descriptor = manifest.readiness || {};
  const operations = Object.values(descriptor.operations || {}).map((operation) => ({
    operation: operation.operation,
    status: 'disabled',
    operation_status: operation.operationStatus === 'unsupported' ? 'unsupported' : 'disabled',
    execution_eligible: { production: false, sandbox: false, requestedEnvironment: descriptor.environment || null, eligibleForRequestedEnvironment: false },
    production_enabled: false,
    sandbox_enabled: false,
    reason: 'This discovery-only provider is disabled and cannot execute provider operations.'
  }));

  return {
    provider: manifest.key,
    display_name: manifest.display_name,
    status: 'disabled',
    ready: false,
    environment: descriptor.environment || null,
    enabled: false,
    production_enabled: false,
    sandbox_enabled: false,
    configuration: {
      configured: Boolean(manifest.configuration.configured),
      required: manifest.configuration.required_env || [],
      missing: manifest.configuration.missing_env || []
    },
    credentials: {
      configured: Boolean(manifest.configuration.configured),
      required: manifest.configuration.required_env || [],
      missing: manifest.configuration.missing_env || []
    },
    missing_env: manifest.configuration.missing_env || [],
    operations,
    summary: {
      live_operations: 0,
      setup_operations: 0,
      unsupported_operations: 0,
      live_lanes: 0,
      preview_lanes: 0,
      setup_lanes: 0
    },
    recommended_next_steps: [
      {
        code: 'COMPLETE_PROVIDER_INTEGRATION',
        label: `Complete ${manifest.display_name} integration before enabling it.`,
        detail: 'Credentials and feature flags do not enable unimplemented provider operations.'
      }
    ]
  };
}

async function listProviderReadinessReport() {
  const manifests = providerManifestService.listProviderManifests({ includeDisabled: true });

  return Promise.all(manifests.map(async (manifest) => {
    if (!manifest.enabled) {
      return { manifest, readiness: disabledReadiness(manifest), health: null };
    }

    const [readiness, health] = await Promise.all([
      Promise.resolve(providerReadinessService.getProviderReadiness(manifest.key)),
      providerHealthService.getProviderHealth(manifest.key)
    ]);

    return { manifest, readiness, health };
  }));
}

module.exports = {
  providerReadinessReportService: {
    listProviderReadinessReport
  }
};
