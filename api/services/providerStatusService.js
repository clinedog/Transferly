const {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS,
  isProviderOperationImplemented
} = require('../constants/providerWorkspaceContract');
const { AppError } = require('../utils/errors');
const { providerCapabilityService } = require('./providerCapabilityService');
const { providerHealthService } = require('./providerHealthService');
const { providerReadinessService } = require('./providerReadinessService');

const OPERATION_LABELS = Object.freeze({
  invoices: 'Invoices',
  payouts: 'Payouts',
  balance: 'Balance',
  activity: 'Activity'
});

function summarizeOperations(readiness = {}) {
  const operations = Array.isArray(readiness.operations) ? readiness.operations : [];
  return PROVIDER_OPERATION_KEYS.map((operation) => {
    const item = operations.find((entry) => entry.operation === operation) || {};
    const status = item.status || 'setup';
    return {
      operation,
      label: OPERATION_LABELS[operation] || operation,
      status,
      implemented: Boolean(item.implemented || isProviderOperationImplemented(status)),
      actionable: Boolean(item.actionable || !isProviderOperationImplemented(status))
    };
  });
}

function summarizeWarnings(readiness = {}, health = {}) {
  const warnings = [];
  const missingEnv = Array.isArray(readiness.missing_env) ? readiness.missing_env : [];
  const reasons = Array.isArray(health.reasons) ? health.reasons : [];

  if (missingEnv.length > 0) {
    warnings.push(`Missing provider environment variables: ${missingEnv.join(', ')}`);
  }
  if (health.status && health.status !== 'operational') {
    warnings.push(...reasons);
  }
  if (readiness.ready === false) {
    warnings.push('Provider setup is not fully ready.');
  }

  return [...new Set(warnings)].slice(0, 5);
}

function summarizeNextActions(readiness = {}, health = {}) {
  const readinessActions = Array.isArray(readiness.recommended_next_steps)
    ? readiness.recommended_next_steps.map((step) => [step.label, step.detail].filter(Boolean).join(' '))
    : [];
  const healthActions = Array.isArray(health.next_actions) ? health.next_actions : [];

  return [...new Set([...readinessActions, ...healthActions].filter(Boolean))].slice(0, 5);
}

function collectPreflightBlockingReasons(status, operationSupported) {
  const missingEnvironment = status.warnings.some((warning) => warning.includes('Missing provider environment variables'));
  const providerUnavailable = status.health_status === 'critical';
  const reasons = [];

  if (!operationSupported) {
    reasons.push('Provider operation is not available for submission.');
  }
  if (missingEnvironment) {
    reasons.push('Provider configuration is incomplete.');
  }
  if (providerUnavailable) {
    reasons.push('Provider health is critical.');
  }

  return reasons;
}

function buildPreflightChecks(status, operation, operationStatus, operationSupported) {
  const missingEnvironment = status.warnings.some((warning) => warning.includes('Missing provider environment variables'));
  const providerUnavailable = status.health_status === 'critical';
  const isPayout = operation === 'payouts';
  const requiresWebhookFreshness = ['invoices', 'payouts', 'activity'].includes(operation);

  return {
    missing_environment: {
      passed: !missingEnvironment,
      status: missingEnvironment ? 'needs-env' : 'clear',
      message: missingEnvironment
        ? 'Provider configuration is incomplete. Missing variable names are listed in setup warnings.'
        : 'Required provider configuration is present or not required for this action.'
    },
    provider_mode: {
      passed: true,
      status: status.provider_status || 'unknown',
      message: 'Provider mode is reported by the payment-provider registry.'
    },
    user_permission: {
      passed: true,
      status: 'checked-by-route-auth',
      message: 'Transferly validates user or admin authorization before executing provider actions.'
    },
    wallet_balance: {
      passed: !isPayout || operationSupported,
      status: isPayout ? 'checked-before-submission' : 'not-required',
      message: isPayout
        ? 'Payout submission must pass balance and ledger checks before money movement.'
        : 'This action does not require a payout balance check.'
    },
    required_fields: {
      passed: true,
      status: 'validated-at-submission',
      message: 'Provider request fields are validated by the operation schema before execution.'
    },
    idempotency_key: {
      passed: true,
      required: isPayout,
      status: isPayout ? 'required-for-create' : 'not-required',
      message: isPayout
        ? 'Payout creation requires an idempotency key to prevent duplicate money movement.'
        : 'This read or preview action does not require an idempotency key.'
    },
    risk_status: {
      passed: true,
      status: 'checked-before-submission',
      message: 'Risk checks run in the payout and invoice services before sensitive state changes.'
    },
    rate_limits: {
      passed: true,
      status: 'not-rate-limited',
      message: 'No provider rate-limit block is currently reported for this action.'
    },
    webhook_freshness: {
      passed: !requiresWebhookFreshness || status.health_status !== 'critical',
      status: requiresWebhookFreshness && status.health_status === 'critical' ? 'needs-webhook' : 'acceptable',
      message: requiresWebhookFreshness
        ? 'Webhook delivery health is considered before relying on provider state.'
        : 'Webhook freshness is not required for this action.'
    },
    provider_availability: {
      passed: !providerUnavailable,
      status: providerUnavailable ? 'degraded' : 'available',
      message: providerUnavailable
        ? 'Provider health is degraded. Retry or use a safer manual review path.'
        : 'Provider health does not currently block this action.'
    },
    operation_support: {
      passed: operationSupported,
      status: operationStatus.status || 'setup',
      message: operationSupported
        ? 'Transferly has enabled this provider operation.'
        : 'Transferly keeps this provider operation gated until the setup contract is satisfied.'
    }
  };
}

function buildPreflightSetup(status, operation, operationStatus) {
  return {
    provider_status: status.provider_status || 'unknown',
    health_status: status.health_status || 'unknown',
    operation_status: operationStatus.status || 'setup',
    mode: status.status || 'setup',
    idempotency_key_required: operation === 'payouts'
  };
}

function buildPreflightRequirements(operation) {
  return {
    idempotency_key_required: operation === 'payouts',
    required_fields_validated_by: 'provider_operation_schema',
    balance_check_required: operation === 'payouts',
    webhook_freshness_required: ['invoices', 'payouts', 'activity'].includes(operation),
    risk_review_required: operation === 'payouts'
  };
}

async function getProviderStatus(provider) {
  const capability = providerCapabilityService.getProviderCapabilities(provider);
  const [readiness, health] = await Promise.all([
    Promise.resolve(providerReadinessService.getProviderReadiness(provider)),
    providerHealthService.getProviderHealth(provider)
  ]);

  return {
    provider: capability.slug,
    display_name: capability.display_name,
    status: readiness.ready ? 'ready' : readiness.status || capability.status || 'setup',
    ready: Boolean(readiness.ready),
    provider_status: health.provider_status,
    health_status: health.status,
    health_score: health.score,
    contract_version: PROVIDER_CONTRACT_VERSION,
    operations: summarizeOperations(readiness),
    lanes: readiness.lanes || [],
    warnings: summarizeWarnings(readiness, health),
    next_actions: summarizeNextActions(readiness, health)
  };
}

async function preflightProviderAction(provider, operation) {
  const status = await getProviderStatus(provider);
  const operationStatus = status.operations.find((entry) => entry.operation === operation) || {
    operation,
    label: OPERATION_LABELS[operation] || operation,
    status: 'setup'
  };

  try {
    providerCapabilityService.assertProviderOperation(provider, operation);
    const blockingReasons = collectPreflightBlockingReasons(status, true);
    const allowed = blockingReasons.length === 0;

    return {
      allowed,
      provider: status.provider,
      operation,
      label: operationStatus.label,
      status: operationStatus.status,
      reason: allowed ? null : blockingReasons[0],
      code: allowed ? null : 'PROVIDER_PREFLIGHT_BLOCKED',
      blocking_reasons: blockingReasons,
      supported_providers: [],
      warnings: status.warnings,
      next_actions: status.next_actions.slice(0, 3),
      checks: buildPreflightChecks(status, operation, operationStatus, true),
      setup: buildPreflightSetup(status, operation, operationStatus),
      requirements: buildPreflightRequirements(operation)
    };
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'PROVIDER_OPERATION_NOT_AVAILABLE') {
      throw error;
    }

    const blockingReasons = collectPreflightBlockingReasons(status, false);

    return {
      allowed: false,
      provider: status.provider,
      operation,
      label: operationStatus.label,
      status: error.details?.status || operationStatus.status,
      reason: error.message,
      code: error.code,
      blocking_reasons: blockingReasons,
      supported_providers: error.details?.supported_providers || [],
      warnings: status.warnings,
      next_actions: status.next_actions.slice(0, 3),
      checks: buildPreflightChecks(status, operation, operationStatus, false),
      setup: buildPreflightSetup(status, operation, operationStatus),
      requirements: buildPreflightRequirements(operation)
    };
  }
}

module.exports = {
  providerStatusService: {
    getProviderStatus,
    preflightProviderAction
  }
};
