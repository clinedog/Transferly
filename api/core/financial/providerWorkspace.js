'use strict';

/**
 * Canonical provider workspace descriptor.
 *
 * Every provider workspace exposes the same section vocabulary, but only the
 * sections the provider (or Transferly on its behalf) actually supports are
 * surfaced. Sections are classified by SOURCE:
 *
 *   provider-native   — the capability runs on the provider's own API surface
 *                       (invoice.create, payout.create, balance.retrieve, ...).
 *   transferly-native — Transferly provides the capability through its own
 *                       ledger/records and OPTIONALLY routes the financial
 *                       execution through an eligible provider. For example,
 *                       invoices may be a Transferly-native flow backed by a
 *                       provider that does not natively support invoices.
 *
 * Transferly-native features MUST NOT be presented as provider-native, and
 * a section is never shown just because it exists in the vocabulary.
 */

const {
  PROVIDER_OPERATION,
  EXECUTION_STATUS,
  normalizeExecutionStatus
} = require('./providerContract');

const WORKSPACE_SECTIONS = Object.freeze([
  { id: 'overview', label: 'Overview', intent: 'overview' },
  { id: 'wallet', label: 'Wallet / Balance', intent: 'wallet' },
  { id: 'payments', label: 'Payments', intent: 'payments' },
  { id: 'payouts', label: 'Payouts', intent: 'send' },
  { id: 'refunds', label: 'Refunds', intent: 'refunds' },
  { id: 'invoices', label: 'Invoices', intent: 'collect' },
  { id: 'payment_links', label: 'Payment Links', intent: 'collect' },
  { id: 'transfers', label: 'Transfers', intent: 'transfers' },
  { id: 'customers', label: 'Customers', intent: 'customers' },
  { id: 'transactions', label: 'Transactions', intent: 'reconciliation' },
  { id: 'analytics', label: 'Analytics', intent: 'analytics' },
  { id: 'reports', label: 'Reports', intent: 'reports' },
  { id: 'activity', label: 'Activity', intent: 'activity' },
  { id: 'settings', label: 'Settings', intent: 'settings' }
]);

const WORKSPACE_SECTION_IDS = Object.freeze(WORKSPACE_SECTIONS.map((section) => section.id));

/**
 * Which canonical provider operation backs a section, when any.
 * Sections without an operation are derived from provider/Transferly state.
 */
const SECTION_OPERATION = Object.freeze({
  wallet: PROVIDER_OPERATION.BALANCES,
  payments: PROVIDER_OPERATION.PAYMENTS,
  payouts: PROVIDER_OPERATION.PAYOUTS,
  refunds: PROVIDER_OPERATION.REFUNDS,
  invoices: PROVIDER_OPERATION.INVOICES,
  payment_links: PROVIDER_OPERATION.PAYMENT_LINKS,
  transfers: PROVIDER_OPERATION.TRANSFERS,
  subscriptions: PROVIDER_OPERATION.SUBSCRIPTIONS,
  balance: PROVIDER_OPERATION.BALANCES
});

/**
 * Sections that Transferly composes from its own records even when the
 * provider has no native API for them. These are transferly-native by design.
 */
const TRANSFERLY_NATIVE_SECTIONS = Object.freeze([
  'transactions',
  'analytics',
  'reports',
  'activity',
  'customers',
  'settings',
  'overview'
]);

function isTransferlyNativeSection(sectionId) {
  return TRANSFERLY_NATIVE_SECTIONS.includes(sectionId);
}

/**
 * Builds the normalized workspace descriptor for one provider.
 *
 * @param {object} input
 * @param {string} input.providerKey
 * @param {object} input.operations - canonical operation map from
 *   normalizeCapabilities().operations (provider-native status per operation)
 * @param {object} [input.transferlyOperations] - statuses for Transferly-native
 *   capabilities Transferly provides for this provider regardless of the
 *   provider's native API (e.g. invoices routed through an eligible provider).
 * @param {object} [input.transferlySections] - statuses for Transferly-native
 *   record sections (activity, transactions, analytics, reports, customers).
 * @param {object} [input.readiness] - { ready, missing_env, environment }
 * @returns {object} frozen workspace descriptor
 */
function buildProviderWorkspaceDescriptor({ providerKey, operations = {}, transferlyOperations = {}, transferlySections = {}, readiness = {} }) {
  const providerNativeSections = new Set();
  const statusBySection = {};

  for (const [operation, descriptor] of Object.entries(operations)) {
    const status = normalizeExecutionStatus(descriptor?.status) || EXECUTION_STATUS.UNSUPPORTED;
    const implemented =
      status === EXECUTION_STATUS.PREVIEW ||
      status === EXECUTION_STATUS.SANDBOX ||
      status === EXECUTION_STATUS.LIVE;

    const sectionForOperation = Object.keys(SECTION_OPERATION).find((section) => SECTION_OPERATION[section] === operation);
    if (!sectionForOperation) continue;
    if (implemented) providerNativeSections.add(sectionForOperation);
    statusBySection[sectionForOperation] = {
      status,
      implemented,
      source: implemented ? 'provider_native' : null
    };
  }

  // Transferly-native capabilities Transferly offers for this provider via
  // routing/ledger work (keyed by canonical operation).
  for (const [operation, descriptor] of Object.entries(transferlyOperations)) {
    const sectionForOperation = Object.keys(SECTION_OPERATION).find((section) => SECTION_OPERATION[section] === operation);
    if (!sectionForOperation) continue;
    const status = normalizeExecutionStatus(descriptor?.status) || EXECUTION_STATUS.UNSUPPORTED;
    const implemented =
      status === EXECUTION_STATUS.PREVIEW ||
      status === EXECUTION_STATUS.SANDBOX ||
      status === EXECUTION_STATUS.LIVE;
    if (implemented && !providerNativeSections.has(sectionForOperation)) {
      statusBySection[sectionForOperation] = {
        status,
        implemented,
        source: 'transferly_native',
        basis: 'Transferly provides this capability and routes execution through an eligible provider.'
      };
    }
  }

  // Transferly-native sections without a provider operation (activity,
  // transactions, analytics, reports, customers, settings). Their support is
  // driven by the backing Transferly capability when one is supplied.
  for (const [sectionId, descriptor] of Object.entries(transferlySections || {})) {
    const status = normalizeExecutionStatus(descriptor?.status) || EXECUTION_STATUS.UNSUPPORTED;
    const implemented =
      status === EXECUTION_STATUS.PREVIEW ||
      status === EXECUTION_STATUS.SANDBOX ||
      status === EXECUTION_STATUS.LIVE;
    if (implemented && !statusBySection[sectionId]) {
      statusBySection[sectionId] = {
        status,
        implemented,
        source: 'transferly_native',
        basis: 'Transferly provides this capability from its own records.'
      };
    }
  }

  const sections = WORKSPACE_SECTIONS.map((section) => {
    const operation = SECTION_OPERATION[section.id];
    const support = statusBySection[section.id];
    let source = null;
    let supported = false;

    if (section.id === 'overview') {
      source = 'transferly_native';
      supported = true;
    } else if (isTransferlyNativeSection(section.id)) {
      source = 'transferly_native';
      supported = true;
      if (operation && (!support || !support.implemented)) supported = false;
    } else if (support) {
      source = support.source;
      supported = support.implemented;
    }

    const status = support?.status || EXECUTION_STATUS.UNSUPPORTED;
    const executionEligible = supported
      ? status === EXECUTION_STATUS.LIVE || (readiness?.environment === 'sandbox' && status === EXECUTION_STATUS.SANDBOX)
      : false;

    return Object.freeze({
      id: section.id,
      label: section.label,
      intent: section.intent,
      supported,
      source,
      status,
      executionEligible,
      basis: support?.basis || (source
        ? (source === 'provider_native' ? 'Provider exposes this capability on its own API surface.' : 'Transferly provides this capability from its own records.')
        : null)
    });
  });

  return Object.freeze({
    provider: providerKey,
    version: 1,
    summary: Object.freeze({
      total_sections: sections.length,
      supported_sections: sections.filter((section) => section.supported).length,
      provider_native_sections: sections.filter((section) => section.source === 'provider_native').length,
      transferly_native_sections: sections.filter((section) => section.source === 'transferly_native').length,
      execution_eligible_sections: sections.filter((section) => section.executionEligible).length,
      ready: Boolean(readiness.ready),
      missing_env: Array.isArray(readiness.missing_env) ? readiness.missing_env : []
    }),
    sections
  });
}

module.exports = {
  WORKSPACE_SECTIONS,
  WORKSPACE_SECTION_IDS,
  SECTION_OPERATION,
  TRANSFERLY_NATIVE_SECTIONS,
  isTransferlyNativeSection,
  buildProviderWorkspaceDescriptor
};