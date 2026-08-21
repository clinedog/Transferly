const { PROVIDER_CONTRACT_VERSION, PROVIDER_OPERATION_KEYS, isProviderOperationImplemented } = require('../constants/providerWorkspaceContract');
const { presentInvoice, presentPayout } = require('../presenters/paymentPresenter');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { providerActivityService } = require('./providerActivityService');
const { providerBalanceService } = require('./providerBalanceService');
const { providerCapabilityService } = require('./providerCapabilityService');
const { providerHealthService } = require('./providerHealthService');
const { providerReadinessService } = require('./providerReadinessService');
const { providerStatusService } = require('./providerStatusService');
const { paymentProviderRegistry } = require('./paymentProviderRegistry');
const { listPayPalResourceReadiness } = require('../providers/paypal/readiness');

const DEFAULT_RECENT_LIMIT = 5;

function normalizeProviderKey(provider) {
  return String(provider || '').trim().toLowerCase();
}

function getOperationStatus(readiness, operation) {
  const operationReadiness = readiness?.operations?.find((entry) => entry.operation === operation);
  return operationReadiness?.status || 'unsupported';
}

function canReadOperation(readiness, operation) {
  return isProviderOperationImplemented(getOperationStatus(readiness, operation));
}

function normalizeSectionError(error, fallbackMessage) {
  const code = error?.code || 'PROVIDER_SECTION_UNAVAILABLE';
  const missingEnv = error?.details?.missing_env || [];

  if (code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
    return {
      status: 'needs-env',
      code,
      message: 'Provider configuration is incomplete. Finish setup before using this section.',
      missing_env: missingEnv
    };
  }

  if (['PROVIDER_BALANCE_NOT_IMPLEMENTED', 'PROVIDER_OPERATION_NOT_AVAILABLE', 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED'].includes(code)) {
    return {
      status: 'unsupported',
      code,
      message: 'This provider section is not available in Transferly yet.',
      missing_env: missingEnv
    };
  }

  return {
    status: 'unavailable',
    code,
    message: fallbackMessage,
    missing_env: missingEnv
  };
}

function createSection(status, message, extra = {}) {
  return {
    status,
    message,
    ...extra
  };
}

async function readRecentInvoices({ provider, readiness, userId }) {
  const operationStatus = getOperationStatus(readiness, 'invoices');
  if (!canReadOperation(readiness, 'invoices')) {
    return createSection(operationStatus, 'Invoice collection is gated for this provider.', {
      items: [],
      count: 0
    });
  }

  try {
    const items = await invoiceRepository.findMany({
      provider,
      userId,
      pageSize: DEFAULT_RECENT_LIMIT,
      offset: 0,
      sortBy: 'createdAt',
      sortDirection: 'desc'
    });

    return createSection('live', 'Recent provider invoices loaded from Transferly records.', {
      items: items.map(presentInvoice),
      count: items.length
    });
  } catch (error) {
    const normalizedError = normalizeSectionError(error, 'Recent invoices could not be loaded.');
    return createSection(normalizedError.status, normalizedError.message, {
      items: [],
      count: 0,
      error_code: normalizedError.code
    });
  }
}

async function readRecentPayouts({ provider, readiness, userId }) {
  const operationStatus = getOperationStatus(readiness, 'payouts');
  if (!canReadOperation(readiness, 'payouts')) {
    return createSection(operationStatus, 'Payouts and transfers are gated for this provider.', {
      items: [],
      count: 0
    });
  }

  try {
    const items = await payoutRepository.findMany({
      provider,
      userId,
      pageSize: DEFAULT_RECENT_LIMIT,
      offset: 0,
      sortBy: 'createdAt',
      sortDirection: 'desc'
    });

    return createSection('live', 'Recent provider payouts loaded from Transferly records.', {
      items: items.map(presentPayout),
      count: items.length
    });
  } catch (error) {
    const normalizedError = normalizeSectionError(error, 'Recent payouts could not be loaded.');
    return createSection(normalizedError.status, normalizedError.message, {
      items: [],
      count: 0,
      error_code: normalizedError.code
    });
  }
}

async function readBalanceSummary({ provider, readiness, connectedAccountId, actorType, actorId }) {
  const operationStatus = getOperationStatus(readiness, 'balance');
  if (!canReadOperation(readiness, 'balance')) {
    return createSection(operationStatus, 'Balance lookup is gated for this provider.', {
      data: null
    });
  }

  try {
    return createSection('live', 'Provider balance snapshot loaded.', {
      data: await providerBalanceService.getProviderBalance({
        provider,
        connectedAccountId,
        actorType,
        actorId
      })
    });
  } catch (error) {
    const normalizedError = normalizeSectionError(error, 'Provider balance could not be loaded.');
    return createSection(normalizedError.status, normalizedError.message, {
      data: null,
      error_code: normalizedError.code,
      missing_env: normalizedError.missing_env
    });
  }
}

async function readActivitySummary({ provider, readiness, userId }) {
  const operationStatus = getOperationStatus(readiness, 'activity');
  if (!canReadOperation(readiness, 'activity')) {
    return createSection(operationStatus, 'Provider activity is gated until webhooks and records are connected.', {
      items: [],
      pagination: null
    });
  }

  try {
    const activity = await providerActivityService.listProviderActivity({
      provider,
      userId,
      limit: DEFAULT_RECENT_LIMIT
    });

    return createSection('live', 'Recent provider activity loaded from invoices and payouts.', {
      items: activity.items,
      pagination: activity.pagination
    });
  } catch (error) {
    const normalizedError = normalizeSectionError(error, 'Provider activity could not be loaded.');
    return createSection(normalizedError.status, normalizedError.message, {
      items: [],
      pagination: null,
      error_code: normalizedError.code
    });
  }
}

function buildWebhookStatus(health, settings) {
  return {
    status: health.status === 'operational' ? 'live' : health.status || 'needs-review',
    endpoint_status: settings.webhook_endpoint_status,
    secret_status: settings.webhook_secret_status,
    failed_webhooks: health.failed_webhooks || 0,
    recent_webhooks: health.recent_webhooks || 0,
    last_webhook_at: health.last_webhook_at || null,
    message: health.status === 'operational'
      ? 'Webhook delivery has no active provider health block.'
      : 'Review webhook delivery, signatures, and dead-letter entries before relying on provider state.'
  };
}

function buildSettingsSummary(capability, readiness, health, registryStatus) {
  const missingEnv = readiness.missing_env || [];
  const requiredEnv = registryStatus?.required_env || capability.registry_status?.required_env || [];
  const enabledActions = readiness.operations
    .filter((operation) => operation.implemented)
    .map((operation) => operation.operation);

  return {
    status: missingEnv.length ? 'needs-env' : readiness.ready ? 'live' : readiness.status || 'needs-review',
    environment_mode: registryStatus?.mode || capability.registry_status?.mode || 'external',
    provider_status: registryStatus?.status || capability.registry_status?.status || 'unknown',
    required_env: requiredEnv,
    missing_env: missingEnv,
    webhook_endpoint_status: health.recent_webhooks > 0 || health.failed_webhooks === 0 ? 'configured' : 'needs-webhook',
    webhook_secret_status: requiredEnv.some((name) => /WEBHOOK|SIGNATURE|SECRET/.test(name))
      ? (missingEnv.some((name) => /WEBHOOK|SIGNATURE|SECRET/.test(name)) ? 'needs-env' : 'configured')
      : 'not-required',
    supported_currencies: capability.invoice_features?.supported_currencies || capability.invoice_features?.currencies || [],
    enabled_actions: enabledActions,
    payout_limits: {
      status: enabledActions.includes('payouts') ? 'checked-before-submission' : 'not-enabled',
      message: 'Provider payout limits are enforced by provider-specific submission services when available.'
    },
    notification_preferences: {
      status: 'managed-in-transferly',
      message: 'Provider user notifications remain controlled by Transferly templates and provider capabilities.'
    },
    docs_url: capability.docs_url,
    support_url: capability.support_url,
    secret_values_exposed: false
  };
}

function buildRiskFlags(status, health, settings) {
  const flags = [];

  if (settings.missing_env.length > 0) {
    flags.push({
      code: 'MISSING_PROVIDER_ENV',
      severity: 'setup',
      label: 'Missing provider configuration',
      detail: 'Required environment variable names are visible, but secret values are never returned.'
    });
  }

  if (['critical', 'degraded'].includes(health.status)) {
    flags.push({
      code: 'PROVIDER_HEALTH_REVIEW',
      severity: health.status,
      label: 'Provider health needs review',
      detail: 'Webhook failures or payment operations issues may require manual investigation.'
    });
  }

  if ((health.unresolved_issues || 0) > 0) {
    flags.push({
      code: 'OPEN_PAYMENT_ISSUES',
      severity: 'needs-review',
      label: 'Open payment operations issues',
      detail: `${health.unresolved_issues} issue(s) remain unresolved for this provider.`
    });
  }

  if (!status.ready) {
    flags.push({
      code: 'WORKSPACE_NOT_READY',
      severity: 'needs-review',
      label: 'Workspace is not fully ready',
      detail: 'Keep sensitive actions gated until setup and preflight checks pass.'
    });
  }

  return flags.length ? flags : [{
    code: 'NO_ACTIVE_FLAGS',
    severity: 'clear',
    label: 'No active provider risk flags',
    detail: 'Continue monitoring provider activity, webhooks, and ledger reconciliation.'
  }];
}

function buildNextActions(readiness, status) {
  const readinessActions = Array.isArray(readiness.recommended_next_steps) ? readiness.recommended_next_steps : [];
  const statusActions = Array.isArray(status.next_actions)
    ? status.next_actions.map((action, index) => ({
        code: `STATUS_ACTION_${index + 1}`,
        label: action,
        detail: ''
      }))
    : [];

  return [...readinessActions, ...statusActions]
    .filter((action) => action?.label)
    .slice(0, 6);
}

function buildReconciliationSummary({ provider, readiness, health }) {
  const activityReady = canReadOperation(readiness, 'activity');
  return {
    provider,
    status: activityReady ? 'preview' : 'setup',
    message: activityReady
      ? 'Reconciliation foundations are available from provider activity, ledger, webhook, invoice, and payout records.'
      : 'Reconciliation remains a setup workspace until activity and webhook records are connected.',
    checks: [
      {
        code: 'PROVIDER_BALANCE_VS_LEDGER',
        label: 'Provider balance vs internal ledger',
        status: canReadOperation(readiness, 'balance') ? 'preview' : 'needs-balance',
        detail: 'Compare provider available and pending funds against Transferly ledger balances before settlement.'
      },
      {
        code: 'MISSING_WEBHOOKS',
        label: 'Missing webhook detection',
        status: health.failed_webhooks > 0 ? 'needs-review' : 'monitoring',
        detail: 'Flag gaps between provider resource changes and webhook/audit records.'
      },
      {
        code: 'DUPLICATE_PAYOUTS',
        label: 'Duplicate payout warnings',
        status: 'guarded-by-idempotency',
        detail: 'Use idempotency keys and payout batch identifiers to prevent duplicate money movement.'
      },
      {
        code: 'STALE_PENDING_FUNDS',
        label: 'Stale pending funds',
        status: 'preview',
        detail: 'Surface invoice or payout records that remain pending longer than expected.'
      },
      {
        code: 'FAILED_SETTLEMENT_CHAINS',
        label: 'Failed settlement chains',
        status: 'preview',
        detail: 'Connect invoice, ledger, payout, webhook, and audit entries into a settlement timeline.'
      },
      {
        code: 'MANUAL_REVIEW_QUEUE',
        label: 'Manual review queue',
        status: health.unresolved_issues > 0 ? 'needs-review' : 'clear',
        detail: 'Use payment operations issues as the review queue foundation.'
      }
    ],
    timeline: []
  };
}

function buildProfileFoundation(provider, kind) {
  return {
    provider,
    kind,
    status: 'preview',
    items: [],
    fields: [
      'contact_identity',
      'provider',
      'invoice_history',
      'payout_history',
      'country_currency',
      'verification_status',
      'risk_notes',
      'lifetime_value',
      'last_transaction'
    ],
    message: `${kind === 'customer' ? 'Customer' : 'Recipient'} profiles are prepared as a provider-aware contract and will populate from invoice, payout, and verification records.`
  };
}

function listProviderResourceReadiness(provider) {
  if (provider === 'paypal') {
    return listPayPalResourceReadiness();
  }

  return [];
}

async function buildPreflightMatrix(provider) {
  const results = await Promise.allSettled(
    PROVIDER_OPERATION_KEYS.map((operation) => providerStatusService.preflightProviderAction(provider, operation))
  );

  return results.map((result, index) => {
    const operation = PROVIDER_OPERATION_KEYS[index];
    if (result.status === 'fulfilled') {
      return result.value;
    }

    return {
      allowed: false,
      provider,
      operation,
      label: operation,
      status: 'unavailable',
      reason: 'Preflight could not be loaded for this provider action.',
      code: result.reason?.code || 'PREFLIGHT_UNAVAILABLE',
      supported_providers: [],
      warnings: [],
      next_actions: []
    };
  });
}

async function getProviderDashboard(input = {}) {
  const provider = normalizeProviderKey(input.provider);
  const [capability, readiness, health, status] = await Promise.all([
    Promise.resolve(providerCapabilityService.getProviderCapabilities(provider)),
    Promise.resolve(providerReadinessService.getProviderReadiness(provider)),
    providerHealthService.getProviderHealth(provider),
    providerStatusService.getProviderStatus(provider)
  ]);
  const registryStatus = paymentProviderRegistry.getProviderStatus(provider);
  const adapterContract = paymentProviderRegistry.getProviderAdapterContract(provider);
  const settings = buildSettingsSummary(capability, readiness, health, registryStatus);

  const [balances, recentInvoices, recentPayouts, recentActivity, preflight] = await Promise.all([
    readBalanceSummary({
      provider,
      readiness,
      connectedAccountId: input.connectedAccountId,
      actorType: input.actorType,
      actorId: input.actorId
    }),
    readRecentInvoices({ provider, readiness, userId: input.userId }),
    readRecentPayouts({ provider, readiness, userId: input.userId }),
    readActivitySummary({ provider, readiness, userId: input.userId }),
    buildPreflightMatrix(provider)
  ]);

  return {
    provider: {
      id: capability.id,
      slug: capability.slug,
      display_name: capability.display_name,
      short_description: capability.short_description,
      icon: capability.icon,
      accent_color: capability.accent_color,
      docs_url: capability.docs_url,
      support_url: capability.support_url,
      environments: capability.environments,
      status: capability.status,
      registry_status: registryStatus.status
    },
    readiness,
    health,
    status,
    operation_support: status.operations || [],
    lanes: readiness.lanes || capability.lanes || [],
    provider_resources: listProviderResourceReadiness(provider),
    balances,
    recent_invoices: recentInvoices,
    recent_payouts: recentPayouts,
    recent_activity: recentActivity,
    webhook_status: buildWebhookStatus(health, settings),
    risk_flags: buildRiskFlags(status, health, settings),
    next_recommended_actions: buildNextActions(readiness, status),
    settings,
    adapter_contract: adapterContract,
    preflight,
    reconciliation: buildReconciliationSummary({ provider, readiness, health }),
    customer_profiles: buildProfileFoundation(provider, 'customer'),
    recipient_profiles: buildProfileFoundation(provider, 'recipient'),
    metadata: {
      contract_version: PROVIDER_CONTRACT_VERSION,
      request_id: input.requestId || null,
      generated_at: new Date().toISOString(),
      data_classification: 'no-secret-values'
    }
  };
}

module.exports = {
  providerDashboardService: {
    getProviderDashboard
  }
};
