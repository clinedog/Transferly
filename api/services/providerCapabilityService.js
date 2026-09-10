const {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS,
  getProviderLane,
  getProviderLanes,
  getProviderWorkspace,
  isProviderOperationImplemented,
  listProviderWorkspaces
} = require('../constants/providerWorkspaceContract');
const { paymentProviderRegistry } = require('./paymentProviderRegistry');
const { AppError } = require('../utils/errors');

function deriveOperationSupport() {
  // Capability mapping: capability key -> adapter method names that determine it
  const CAPABILITY_METHOD_MAP = {
    invoices: ['createInvoice', 'sendInvoice', 'previewInvoice'],
    payouts: ['createPayout', 'previewPayout'],
    balance: ['getBalance'],
    activity: ['listTransactions']
  };

  // Get all provider module entries (which contain both the adapter and key)
  const { providerModuleRegistry } = require('../providers/moduleRegistry');
  const modules = providerModuleRegistry.list({ includeDisabled: true });

  // Get all provider adapter contracts
  const adapters = modules.map((provider) => ({
    key: provider.key,
    adapterContract: provider.adapter.getAdapterContract()
  }));

  // Derive operation support from adapter contracts
  const operationSupport = {
    invoices: {},
    payouts: {},
    balance: {},
    activity: {}
  };

  // For each provider, determine capability status based on adapter contract
  adapters.forEach(({ key, adapterContract }) => {
    Object.keys(CAPABILITY_METHOD_MAP).forEach(capability => {
      const methodNames = CAPABILITY_METHOD_MAP[capability];
      let status = 'unsupported'; // Start with worst case

      // Check each relevant method for this capability
      methodNames.forEach(methodName => {
        const methodStatus = adapterContract.operations?.[methodName]?.status;
        if (!methodStatus) return;

        // Status precedence: unsupported < setup < preview < live
        if (methodStatus === 'live') {
          status = 'live'; // Best possible status
        } else if (methodStatus === 'preview' && status !== 'live') {
          status = 'preview';
        } else if (methodStatus === 'setup' && status === 'unsupported') {
          status = 'setup';
        }
        // If status is already 'live', it stays 'live'
        // If status is 'unsupported', it stays 'unsupported' unless we find better
      });

      operationSupport[capability][key] = status;
    });
  });

  return Object.freeze({
    invoices: Object.freeze(operationSupport.invoices),
    payouts: Object.freeze(operationSupport.payouts),
    balance: Object.freeze(operationSupport.balance),
    activity: Object.freeze(operationSupport.activity)
  });
}

// Base enablement matrix - what Transferly has explicitly enabled for each provider.
// This is the source of truth for what's "live" vs "preview".
// Adapter contracts can override to 'unsupported' if the provider genuinely doesn't support it.
const BASE_OPERATION_SUPPORT = Object.freeze({
  invoices: Object.freeze({
    paypal: 'live',
    stripe: 'live',
    wise: 'unsupported',
    paystack: 'setup',
    flutterwave: 'setup',
    crypto: 'live'
  }),
  payouts: Object.freeze({
    paypal: 'live',
    stripe: 'live',
    wise: 'setup',
    paystack: 'setup',
    flutterwave: 'setup',
    crypto: 'unsupported'
  }),
  balance: Object.freeze({
    paypal: 'setup',
    stripe: 'live',
    wise: 'setup',
    paystack: 'setup',
    flutterwave: 'setup',
    crypto: 'unsupported'
  }),
  activity: Object.freeze({
    paypal: 'live',
    stripe: 'live',
    wise: 'setup',
    paystack: 'setup',
    flutterwave: 'setup',
    crypto: 'live'
  })
});

function mergeOperationSupport() {
  const derived = deriveOperationSupport();
  const merged = {
    invoices: {},
    payouts: {},
    balance: {},
    activity: {}
  };

  // Get all provider keys from both sources
  const allKeys = new Set([
    ...Object.keys(derived.invoices),
    ...Object.keys(BASE_OPERATION_SUPPORT.invoices)
  ]);

  allKeys.forEach(key => {
    Object.keys(merged).forEach(capability => {
      const baseStatus = BASE_OPERATION_SUPPORT[capability]?.[key];
      const derivedStatus = derived[capability]?.[key];
      
      // If adapter contract says unsupported, override to unsupported
      if (derivedStatus === 'unsupported') {
        merged[capability][key] = 'unsupported';
      } else if (baseStatus) {
        // Use base status if it exists (preserves existing enablement decisions)
        merged[capability][key] = baseStatus;
      } else {
        // New provider not in base matrix - use derived status
        merged[capability][key] = derivedStatus || 'setup';
      }
    });
  });

  return Object.freeze({
    invoices: Object.freeze(merged.invoices),
    payouts: Object.freeze(merged.payouts),
    balance: Object.freeze(merged.balance),
    activity: Object.freeze(merged.activity)
  });
}

const OPERATION_SUPPORT = mergeOperationSupport();

const OPERATION_LABELS = Object.freeze({
  invoices: 'invoice collection',
  payouts: 'payout submission',
  balance: 'provider balance lookup',
  activity: 'provider activity'
});

const OPERATION_STATUS_DETAILS = Object.freeze({
  live: Object.freeze({
    label: 'Live',
    actionable: true,
    reason: 'Transferly has enabled this operation for production use.'
  }),
  sandbox: Object.freeze({
    label: 'Sandbox-ready',
    actionable: true,
    reason: 'Transferly can run this operation in a sandbox or test environment.'
  }),
  preview: Object.freeze({
    label: 'Preview',
    actionable: false,
    reason: 'Transferly shows this operation for planning, but submission is not enabled.'
  }),
  setup: Object.freeze({
    label: 'Needs setup',
    actionable: false,
    reason: 'Provider configuration, permissions, or webhook setup must be completed before use.'
  }),
  disabled: Object.freeze({
    label: 'Disabled',
    actionable: false,
    reason: 'This operation is intentionally disabled for this provider.'
  }),
  unsupported: Object.freeze({
    label: 'Unsupported',
    actionable: false,
    reason: 'Transferly does not support this operation for this provider.'
  })
});

function normalizeProviderKey(provider) {
  return String(provider || '').trim().toLowerCase();
}

function listImplementedProviders(operation) {
  const support = OPERATION_SUPPORT[operation] || {};
  return Object.entries(support)
    .filter(([, status]) => isProviderOperationImplemented(status))
    .map(([provider]) => provider);
}

function readRegistryStatus(provider) {
  try {
    return paymentProviderRegistry.getProviderStatus(provider);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      throw error;
    }
    return null;
  }
}

function readInvoiceFeatures(provider) {
  try {
    return paymentProviderRegistry.getProviderInvoiceFeatures(provider);
  } catch (_error) {
    return null;
  }
}

function describeOperationSupport(status) {
  return OPERATION_STATUS_DETAILS[status] || {
    label: 'Unknown',
    actionable: false,
    reason: 'Transferly has not published an operation status for this provider.'
  };
}

function presentOperationSupport(provider) {
  return Object.fromEntries(
    PROVIDER_OPERATION_KEYS.map((operation) => {
      const status = OPERATION_SUPPORT[operation]?.[provider] || 'unsupported';
      const detail = describeOperationSupport(status);

      return [
        operation,
        {
          status,
          implemented: isProviderOperationImplemented(status),
          label: detail.label,
          actionable: detail.actionable,
          reason: detail.reason
        }
      ];
    })
  );
}

function presentProviderCapability(provider) {
  const providerKey = normalizeProviderKey(provider.slug || provider.id);
  const registryStatus = readRegistryStatus(providerKey);
  const invoiceFeatures = readInvoiceFeatures(providerKey);

  return {
    id: provider.id,
    slug: provider.slug,
    display_name: provider.displayName,
    short_description: provider.shortDescription,
    icon: provider.icon,
    accent_color: provider.accentColor,
    docs_url: provider.docsUrl,
    support_url: provider.supportUrl,
    environments: provider.environments || [],
    status: provider.status,
    capabilities: provider.capabilities || [],
    operations: presentOperationSupport(providerKey),
    lanes: getProviderLanes(providerKey).map((lane) => ({
      id: lane.id,
      label: lane.label,
      command_label: lane.commandLabel || lane.label,
      intent: lane.intent,
      status: lane.status,
      summary: lane.summary,
      bot_action: lane.botAction || null,
      mini_app_section: lane.miniAppSection,
      requires_admin: Boolean(lane.requiresAdmin)
    })),
    registry_status: registryStatus
      ? {
          key: registryStatus.key,
          status: registryStatus.status,
          missing_env: registryStatus.missing_env || [],
          capabilities: registryStatus.capabilities || {}
        }
      : null,
    invoice_features: invoiceFeatures?.invoice_features || null
  };
}

function listProviderCapabilities() {
  return listProviderWorkspaces().map(presentProviderCapability);
}

function getProviderCapabilities(provider) {
  const providerKey = normalizeProviderKey(provider);
  const workspace = getProviderWorkspace(providerKey);
  if (!workspace) {
    paymentProviderRegistry.getProviderStatus(providerKey);
    throw new AppError(404, 'PAYMENT_PROVIDER_NOT_FOUND', 'Payment provider was not found.', {
      provider: providerKey
    });
  }
  return presentProviderCapability(workspace);
}

function listProviderLanes(provider) {
  getProviderCapabilities(provider);
  return getProviderLanes(provider).map((lane) => ({
    id: lane.id,
    label: lane.label,
    command_label: lane.commandLabel || lane.label,
    intent: lane.intent,
    status: lane.status,
    summary: lane.summary,
    bot_action: lane.botAction || null,
    mini_app_section: lane.miniAppSection,
    requires_admin: Boolean(lane.requiresAdmin)
  }));
}

function getProviderLaneCapability(provider, laneId) {
  getProviderCapabilities(provider);
  const lane = getProviderLane(provider, laneId);
  if (!lane) {
    throw new AppError(404, 'PROVIDER_LANE_NOT_FOUND', 'Provider lane was not found.', {
      provider: normalizeProviderKey(provider),
      lane: String(laneId || '').toLowerCase(),
      available_lanes: getProviderLanes(provider).map((entry) => entry.id)
    });
  }
  return listProviderLanes(provider).find((entry) => entry.id === lane.id);
}

function assertProviderOperation(provider, operation) {
  const providerKey = normalizeProviderKey(provider);
  getProviderCapabilities(providerKey);
  const support = OPERATION_SUPPORT[operation]?.[providerKey] || 'unsupported';
  if (isProviderOperationImplemented(support)) {
    return {
      provider: providerKey,
      operation,
      status: support
    };
  }

  throw new AppError(501, 'PROVIDER_OPERATION_NOT_AVAILABLE', 'Provider operation is not available yet.', {
    provider: providerKey,
    operation,
    operation_label: OPERATION_LABELS[operation] || operation,
    status: support,
    supported_providers: listImplementedProviders(operation)
  });
}

module.exports = {
  OPERATION_SUPPORT,
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS,
  providerCapabilityService: {
    assertProviderOperation,
    getProviderCapabilities,
    getProviderLaneCapability,
    listProviderCapabilities,
    listProviderLanes
  }
};
