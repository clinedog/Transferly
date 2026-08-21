/**
 * Bot provider workspace definitions.
 *
 * The canonical workspace manifests (provider slugs, lane IDs, miniAppSection paths,
 * status values, and contract version) are sourced from the shared contract at
 * shared/providerWorkspaceContract.js, which re-exports api/constants/providerWorkspaceContract.js.
 *
 * Bot-specific overrides (botAction values, requiresAdmin flags, extra lanes like
 * "custom-details") are merged on top of the shared definitions here. This ensures
 * the bot stays aligned with the API and miniapp without duplicating the full manifest.
 */

const {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_KEYS,
  PROVIDER_OPERATION_KEYS,
  PROVIDER_OPERATION_STATUSES,
  PROVIDER_WORKSPACES: SHARED_WORKSPACES,
  isProviderOperationImplemented,
  listProviderWorkspaces: listSharedWorkspaces,
  getProviderWorkspace: getSharedWorkspace,
  getProviderLanes,
  getProviderLane,
  getProviderLaneStatus,
  getDefaultProviderLane,
  findProviderLanesByIntent,
  buildProviderMiniAppSection
} = require('../../shared/providerWorkspaceContract');

// ---------------------------------------------------------------------------
// Bot-specific lane additions (merged into shared workspace definitions)
// These add botAction values and bot-only lanes that don't belong in the API.
// ---------------------------------------------------------------------------

const BOT_LANE_OVERRIDES = Object.freeze({
  paypal: {
    extraLanes: [
      {
        id: 'custom-details',
        label: 'Notification',
        commandLabel: 'PayPal Notification',
        intent: 'custom',
        status: 'live',
        summary: 'Guided receipt-style notification composer using Transferly templates.',
        botAction: 'PROVIDER_CUSTOM:paypal',
        miniAppSection: 'services/paypal/overview',
        requiresAdmin: false
      }
    ],
    laneActionMap: {
      invoices: 'PP:INV',
      payouts: 'PP:PO',
      activity: 'PROVIDER_WEBHOOKS:paypal'
    }
  },
  stripe: {
    laneActionMap: {
      payments: 'PROVIDER_INV:stripe',
      connect: 'PROVIDER_PO:stripe',
      activity: 'PROVIDER_WEBHOOKS:stripe'
    }
  },
  crypto: {
    laneActionMap: {
      receive: 'PROVIDER_INV:crypto',
      activity: 'PROVIDER_WEBHOOKS:crypto'
    }
  },
  paystack: {
    laneActionMap: {
      collections: 'PROVIDER_PO:paystack'
    }
  },
  flutterwave: {
    laneActionMap: {
      collections: 'PROVIDER_INV:flutterwave',
      transfers: 'PROVIDER_PO:flutterwave'
    }
  }
});

// ---------------------------------------------------------------------------
// Merge shared workspaces with bot-specific overrides
// ---------------------------------------------------------------------------

function mergeWorkspaceForBot(workspace) {
  const overrides = BOT_LANE_OVERRIDES[workspace.slug];
  if (!overrides) return workspace;

  const { extraLanes = [], laneActionMap = {} } = overrides;

  // Apply botAction to existing lanes where applicable
  const updatedLanes = workspace.lanes.map((lane) => {
    const botAction = laneActionMap[lane.id];
    return botAction ? { ...lane, botAction } : lane;
  });

  // Append bot-only extra lanes (e.g. 'custom-details' for PayPal)
  const allLanes = extraLanes.length
    ? [...updatedLanes, ...extraLanes]
    : updatedLanes;

  return { ...workspace, lanes: Object.freeze(allLanes) };
}

const PROVIDER_WORKSPACES = Object.freeze(
  SHARED_WORKSPACES.map(mergeWorkspaceForBot)
);

// ---------------------------------------------------------------------------
// Re-export the shared helpers (unchanged) alongside bot-merged workspace list
// ---------------------------------------------------------------------------

function listProviderWorkspaces() {
  return PROVIDER_WORKSPACES;
}

function getProviderWorkspace(slug) {
  const normalized = String(slug || '').toLowerCase();
  return PROVIDER_WORKSPACES.find((p) => p.slug === normalized) || null;
}

module.exports = {
  // Shared contract passthrough
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_KEYS,
  PROVIDER_OPERATION_KEYS,
  PROVIDER_OPERATION_STATUSES,
  isProviderOperationImplemented,
  getProviderLanes,
  getProviderLane,
  getProviderLaneStatus,
  getDefaultProviderLane,
  findProviderLanesByIntent,
  buildProviderMiniAppSection,

  // Bot-merged versions
  PROVIDER_WORKSPACES,
  listProviderWorkspaces,
  getProviderWorkspace
};
