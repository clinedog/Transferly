export const PROVIDER_CONTRACT_VERSION = '2026-06-provider-v1';

export const PROVIDER_OPERATION_KEYS = Object.freeze([
  'invoices',
  'payouts',
  'balance',
  'activity'
]);

export const PROVIDER_OPERATION_STATUSES = Object.freeze([
  'live',
  'sandbox-ready',
  'needs-env',
  'needs-webhook',
  'needs-review',
  'preview',
  'disabled',
  'setup',
  'unsupported',
  'unavailable'
]);

export function normalizeProviderRuntimeStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isProviderReadinessReady(status) {
  const normalized = normalizeProviderRuntimeStatus(status);
  return ['live', 'ready', 'healthy', 'configured', 'authenticated', 'sandbox-ready', 'production-ready', 'webhook-ready', 'connected'].includes(normalized);
}

export function isProviderOperationImplemented(status) {
  const normalized = normalizeProviderRuntimeStatus(status);
  return normalized === 'live' || normalized === 'sandbox-ready' || normalized === 'preview' || normalized === 'ready';
}

export function normalizeProviderCapability(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const operations = value.operations && typeof value.operations === 'object'
    ? value.operations
    : {};
  const lanes = Array.isArray(value.lanes) ? value.lanes.filter((lane) => lane?.id) : [];

  return {
    ...value,
    slug: String(value.slug || value.id || '').trim().toLowerCase(),
    operations,
    lanes
  };
}

export function isProviderLaneVisible(status) {
  return status !== 'disabled' && status !== 'unsupported';
}

export function getRuntimeLaneCapability(capability, laneId) {
  const normalized = normalizeProviderCapability(capability);
  return normalized?.lanes.find((lane) => lane.id === laneId) || null;
}

/**
 * Merge canonical server capability metadata into the static presentation
 * manifest without turning setup or preview lanes into executable actions.
 */
export function mergeProviderManifestCapability(manifest, capability) {
  const normalized = normalizeProviderCapability(capability);

  if (!manifest || !normalized || normalized.slug !== String(manifest.slug).toLowerCase()) {
    return manifest;
  }

  const runtimeLanes = new Map(normalized.lanes.map((lane) => [lane.id, lane]));
  const hasRuntimeLanes = runtimeLanes.size > 0;
  const lanes = manifest.lanes
    .map((lane) => {
      const runtimeLane = runtimeLanes.get(lane.id);
      if (!runtimeLane) {
        return hasRuntimeLanes ? null : lane;
      }

      return {
        ...lane,
        label: runtimeLane.label || lane.label,
        shortLabel: runtimeLane.command_label || lane.shortLabel,
        description: runtimeLane.summary || lane.description,
        runtimeStatus: runtimeLane.status || lane.support
      };
    })
    .filter(Boolean)
    .filter((lane) => isProviderLaneVisible(lane.runtimeStatus));

  const supportedLanes = lanes.map((lane) => lane.id);

  return {
    ...manifest,
    displayName: normalized.display_name || manifest.displayName,
    shortDescription: normalized.short_description || manifest.shortDescription,
    capabilities: Array.isArray(normalized.capabilities) && normalized.capabilities.length
      ? normalized.capabilities
      : manifest.capabilities,
    lanes,
    supportedLanes,
    runtimeCapability: normalized
  };
}
