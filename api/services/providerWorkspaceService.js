'use strict';

/**
 * Provider workspace service.
 *
 * Serves the normalized, capability-driven workspace descriptor for a provider
 * and the normalized provider wallet. Everything the frontend needs to render
 * a provider workspace WITHOUT scattering `if provider === ...` conditions
 * lives behind this boundary. Provider-specific code stays in the adapters.
 */

const { providerCapabilityService } = require('./providerCapabilityService');
const { providerReadinessService } = require('./providerReadinessService');
const { providerBalanceService } = require('./providerBalanceService');
const { paymentProviderRegistry } = require('./paymentProviderRegistry');
const { buildProviderWorkspaceDescriptor } = require('../core/financial/providerWorkspace');
const {
  PROVIDER_OPERATION_KEYS,
  normalizeExecutionStatus,
  normalizeProviderKey
} = require('../core/financial/providerContract');
const { PROVIDER_CONTRACT_VERSION } = require('../constants/providerWorkspaceContract');

const OPERATION_ADAPTER_METHODS = Object.freeze({
  payments: ['createPayment'],
  payouts: ['createPayout', 'previewPayout'],
  refunds: ['createRefund', 'getRefund'],
  invoices: ['createInvoice', 'sendInvoice', 'previewInvoice'],
  payment_links: ['createInvoice', 'previewInvoice'],
  transfers: ['createPayout', 'previewPayout'],
  subscriptions: [],
  balance: ['getBalance'],
  customers: [],
  wallets: [],
  virtual_accounts: []
});

/**
 * Resolves canonical operation statuses for a provider by preferring the
 * Transferly enablement matrix, then the adapter contract. This mirrors the
 * routing resolver without importing the routing service (avoiding a cycle).
 */
function resolveCanonicalOperations(providerKey, adapterContract) {
  const operations = {};
  for (const operation of PROVIDER_OPERATION_KEYS) {
    const matrixStatus = providerCapabilityService.OPERATION_SUPPORT?.[operation]?.[providerKey];
    const matrix = normalizeExecutionStatus(matrixStatus);
    if (matrix) {
      operations[operation] = { status: matrix, source: 'transferly_enablement' };
      continue;
    }
    const methods = OPERATION_ADAPTER_METHODS[operation] || [];
    let status = 'unsupported';
    for (const method of methods) {
      const contractStatus = normalizeExecutionStatus(adapterContract?.operations?.[method]?.status);
      if (contractStatus && contractStatus !== 'unsupported') {
        status = contractStatus;
        break;
      }
    }
    operations[operation] = { status, source: 'adapter_contract' };
  }
  return operations;
}

function getProviderWorkspace(providerInput) {
  const provider = normalizeProviderKey(providerInput);
  const capability = providerCapabilityService.getProviderCapabilities(provider);
  const readiness = providerReadinessService.getProviderReadiness(provider);
  const adapterContract = paymentProviderRegistry.getProviderAdapterContract(provider);

  const operations = resolveCanonicalOperations(provider, adapterContract);
  const activityStatus = operations.activity?.status || 'unsupported';
  const invoicesStatus = operations.invoices?.status || 'unsupported';
  const transactionsStatus =
    normalizeExecutionStatus(adapterContract?.operations?.listTransactions?.status) ||
    activityStatus;

  const descriptor = buildProviderWorkspaceDescriptor({
    providerKey: provider,
    operations,
    transferlySections: {
      activity: { status: activityStatus },
      transactions: { status: transactionsStatus },
      analytics: { status: activityStatus },
      reports: { status: activityStatus },
      customers: { status: invoicesStatus },
      settings: { status: 'live' }
    },
    readiness: {
      ready: readiness.ready,
      missing_env: readiness.missing_env,
      environment: adapterContract?.mode || null
    }
  });

  return {
    provider: descriptor.provider,
    display_name: capability.display_name,
    contract_version: PROVIDER_CONTRACT_VERSION,
    registry: {
      enabled: true,
      status: capability.registry_status?.status || capability.status,
      missing_env: capability.registry_status?.missing_env || []
    },
    summary: descriptor.summary,
    sections: descriptor.sections,
    guidance: buildGuidance(descriptor, readiness)
  };
}

function buildGuidance(descriptor, readiness) {
  const recommendations = [];
  if (!readiness.ready) {
    recommendations.push('Finish provider setup before executing supported operations.');
  }
  const previewSections = descriptor.sections.filter((section) => section.status === 'preview');
  if (previewSections.length > 0) {
    recommendations.push('Preview sections are informational only and are not eligible for production execution.');
  }
  if (recommendations.length === 0) recommendations.push('Provider workspace is ready for the supported operations.');
  return recommendations;
}

// ---------------------------------------------------------------------------
// Provider wallet (provider-reported balance, NOT the Transferly ledger)
// ---------------------------------------------------------------------------

const WALLET_CATEGORIES = Object.freeze([
  { id: 'available', label: 'Available' },
  { id: 'pending', label: 'Pending' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'incoming', label: 'Incoming' },
  { id: 'outgoing', label: 'Outgoing' }
]);

function moneyEntry(category, entry, present) {
  const amountCents = entry && Number.isFinite(Number(entry.amount_cents)) ? Number(entry.amount_cents) : null;
  return {
    category,
    present: Boolean(present && amountCents !== null),
    amount_cents: amountCents,
    amount: amountCents === null ? null : (amountCents / 100).toFixed(2),
    currency: entry?.currency || null,
    unavailable_reason: present && amountCents === null ? 'Provider did not expose this balance category.' : null
  };
}

/**
 * Returns the provider-reported wallet in a stable shape. Categories the
 * provider does not expose are `present: false` — they are never fabricated
 * as zero-value balances.
 */
function getProviderWallet(providerInput, input = {}) {
  const provider = normalizeProviderKey(providerInput);
  const capability = providerCapabilityService.getProviderCapabilities(provider);
  const balance = providerBalanceService.getProviderBalance({
    provider,
    connectedAccountId: input.connectedAccountId,
    actorType: input.actorType,
    actorId: input.actorId
  });

  const byCategory = {
    available: moneyEntry('available', Array.isArray(balance.available) ? balance.available[0] : null, balance.mode !== 'unknown'),
    pending: moneyEntry('pending', Array.isArray(balance.pending) ? balance.pending[0] : null, balance.mode !== 'unknown'),
    reserved: moneyEntry('reserved', Array.isArray(balance.connect_reserved) ? balance.connect_reserved[0] : null, balance.mode !== 'unknown'),
    incoming: moneyEntry('incoming', null, false),
    outgoing: moneyEntry('outgoing', null, false)
  };

  return {
    provider,
    display_name: capability.display_name,
    mode: balance.mode || 'unknown',
    provider_reported: balance.mode !== 'unknown',
    // Provider-reported balance is observational only. The Transferly internal
    // ledger remains the source of truth for what Transferly owes/owns.
    semantics: 'provider-reported; observational; not a Transferly ledger or service-point balance.',
    balance: byCategory,
    categories: WALLET_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      present: Boolean(byCategory[category.id]?.present)
    })),
    retrieved_at: new Date().toISOString()
  };
}

module.exports = {
  providerWorkspaceService: {
    getProviderWorkspace,
    getProviderWallet
  }
};