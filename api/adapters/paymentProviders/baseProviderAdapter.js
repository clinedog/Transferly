const config = require('../../config');
const { AppError } = require('../../utils/errors');

function hasConfiguredValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function resolveEnv(name) {
  return config[name] ?? process.env[name] ?? '';
}

function getReadiness(requiredEnv) {
  const missingEnv = requiredEnv.filter((name) => !hasConfiguredValue(resolveEnv(name)));

  return {
    configured: missingEnv.length === 0,
    required_env: requiredEnv,
    missing_env: missingEnv
  };
}

const PROVIDER_ADAPTER_METHODS = Object.freeze({
  createInvoice: ['invoice.create', 'payment_request.create', 'payment_link.create', 'charge.create'],
  sendInvoice: ['invoice.send', 'payment_request.send', 'invoice.finalize'],
  previewInvoice: ['invoice.create', 'payment_request.create', 'payment_link.create', 'charge.create'],
  createPayout: ['payout.create', 'transfer.create', 'payout.transfer_to_connected_account'],
  previewPayout: ['payout.preview', 'quote.create', 'transfer_rate.quote'],
  refreshTransaction: ['invoice.refresh', 'charge.refresh', 'transfer.refresh', 'transfer.verify'],
  getBalance: ['balance.retrieve'],
  listTransactions: ['transaction.list', 'transaction.search', 'activity.list', 'dispute.list'],
  verifyWebhook: ['webhook.verify'],
  normalizeWebhookEvent: ['webhook.verify'],
  mapProviderStatus: ['invoice.refresh', 'charge.refresh', 'transfer.refresh', 'transfer.verify', 'webhook.verify']
});

function inferAdapterOperationStatus(definition, methodName) {
  const explicit = definition.adapterOperations?.[methodName];
  if (explicit) {
    return typeof explicit === 'string' ? { status: explicit } : explicit;
  }

  const supportedOperations = new Set(definition.supportedOperations || []);
  const mappedOperations = PROVIDER_ADAPTER_METHODS[methodName] || [];
  const supported = mappedOperations.filter((operation) => supportedOperations.has(operation));

  if (!supported.length) {
    return {
      status: 'unsupported',
      provider_operations: mappedOperations
    };
  }

  return {
    status: 'preview',
    provider_operations: supported
  };
}

function createProviderAdapter(definition) {
  const requiredEnv = definition.requiredEnv || [];
  const invoiceFeatures = definition.invoiceFeatures || {
    supported: false,
    provider_resource: 'none',
    collection_method: 'not_supported',
    reason: 'This provider does not expose an invoice collection flow for Transferly.'
  };

  function buildSummary() {
    const readiness = getReadiness(requiredEnv);

    return {
      key: definition.key,
      display_name: definition.displayName,
      status: readiness.configured ? 'configured' : 'not_configured',
      mode: definition.mode || 'external',
      capabilities: definition.capabilities,
      invoice_features: invoiceFeatures,
      supported_operations: definition.supportedOperations,
      required_env: readiness.required_env,
      missing_env: readiness.missing_env,
      docs: definition.docs,
      next_actions: readiness.configured
        ? definition.configuredNextActions
        : definition.nextActions
      };
  }

  function buildAdapterContract() {
    const readiness = getReadiness(requiredEnv);
    return {
      provider: definition.key,
      display_name: definition.displayName,
      mode: definition.mode || 'external',
      configured: readiness.configured,
      required_env: readiness.required_env,
      missing_env: readiness.missing_env,
      operations: Object.fromEntries(
        Object.keys(PROVIDER_ADAPTER_METHODS).map((methodName) => [
          methodName,
          {
            method: methodName,
            ...inferAdapterOperationStatus(definition, methodName)
          }
        ])
      )
    };
  }

  async function operationNotImplemented(operation) {
    const contract = buildAdapterContract();
    const operationContract = contract.operations[operation] || { status: 'unsupported' };
    const status = operationContract.status === 'unsupported' ? 'unsupported' : 'setup';

    throw new AppError(
      501,
      'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      `${definition.displayName} ${operation} is not available in Transferly yet.`,
      {
        provider: definition.key,
        operation,
        status,
        readiness: contract.configured ? 'configured' : 'needs-env',
        required_env: contract.required_env,
        missing_env: contract.missing_env,
        supported_operations: definition.supportedOperations || [],
        message: status === 'unsupported'
          ? 'This provider does not support this Transferly action yet.'
          : 'This provider action is registered for the workspace and remains gated until the service module is implemented.'
      }
    );
  }

  return {
    key: definition.key,
    getSummary: buildSummary,
    getStatus() {
      return {
        ...buildSummary(),
        notes: definition.notes || []
      };
    },
    getInvoiceFeatures() {
      const summary = buildSummary();

      return {
        provider: {
          key: summary.key,
          display_name: summary.display_name,
          status: summary.status,
          mode: summary.mode
        },
        invoice_features: invoiceFeatures,
        required_env: summary.required_env,
        missing_env: summary.missing_env,
        docs: summary.docs
      };
    },
    getAdapterContract: buildAdapterContract,
    createInvoice: () => operationNotImplemented('createInvoice'),
    sendInvoice: () => operationNotImplemented('sendInvoice'),
    previewInvoice: () => operationNotImplemented('previewInvoice'),
    createPayout: () => operationNotImplemented('createPayout'),
    previewPayout: () => operationNotImplemented('previewPayout'),
    refreshTransaction: () => operationNotImplemented('refreshTransaction'),
    refreshResource: () => operationNotImplemented('refreshTransaction'),
    getBalance: () => operationNotImplemented('getBalance'),
    listTransactions: () => operationNotImplemented('listTransactions'),
    verifyWebhook: () => operationNotImplemented('verifyWebhook'),
    normalizeWebhookEvent: () => operationNotImplemented('normalizeWebhookEvent'),
    mapProviderStatus: () => operationNotImplemented('mapProviderStatus')
  };
}

module.exports = {
  createProviderAdapter
};
