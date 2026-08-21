const { providerHealthService } = require('./providerHealthService');
const { providerManifestService } = require('./providerManifestService');
const { providerReadinessService } = require('./providerReadinessService');

function disabledReadiness(manifest) {
  return {
    provider: manifest.key,
    display_name: manifest.display_name,
    status: 'disabled',
    ready: false,
    missing_env: manifest.configuration.missing_env,
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
