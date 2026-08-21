const config = require('../../config');

const PAYPAL_RESOURCE_DEFINITIONS = Object.freeze({
  overview: {
    lane: 'overview',
    label: 'Overview',
    api_resource: 'Transferly PayPal workspace',
    docs_url: 'https://developer.paypal.com/docs/api/overview/',
    status: 'live',
    implemented: true,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    supported_actions: ['readiness', 'health', 'recent activity', 'next actions']
  },
  invoices: {
    lane: 'invoices',
    label: 'Invoicing API',
    api_resource: 'PayPal Invoicing API',
    docs_url: 'https://developer.paypal.com/docs/api/invoicing/v2/',
    status: 'live',
    implemented: true,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    supported_actions: ['preview invoice', 'create invoice', 'send invoice', 'list invoices', 'refresh status', 'cancel invoice', 'remind customer']
  },
  payouts: {
    lane: 'payouts',
    label: 'Payouts API',
    api_resource: 'PayPal Payouts API',
    docs_url: 'https://developer.paypal.com/docs/api/payments.payouts-batch/v1/',
    status: 'live',
    implemented: true,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    supported_actions: ['preview payout', 'create payout', 'approval flow', 'rejection flow', 'batch tracking', 'item tracking', 'status refresh']
  },
  payments: {
    lane: 'payments',
    label: 'Payments API',
    api_resource: 'PayPal Payments API',
    docs_url: 'https://developer.paypal.com/docs/api/payments/v2/',
    status: 'preview',
    implemented: false,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    supported_actions: ['capture lookup', 'authorization lookup', 'refund readiness', 'void readiness', 'payment timeline']
  },
  orders: {
    lane: 'orders',
    label: 'Orders API',
    api_resource: 'PayPal Orders API',
    docs_url: 'https://developer.paypal.com/docs/api/orders/v2/',
    status: 'live',
    implemented: true,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    supported_actions: ['order detail lookup', 'order status mapping', 'buyer summary', 'create order readiness', 'capture order readiness']
  },
  transactions: {
    lane: 'transactions',
    label: 'Transaction Search API',
    api_resource: 'PayPal Transaction Search API',
    docs_url: 'https://developer.paypal.com/docs/api/transaction-search/v1/',
    status: 'live',
    implemented: true,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    supported_actions: ['date range search', 'status filtering', 'type filtering', 'transaction detail mapping', 'reconciliation mapping']
  },
  webhooks: {
    lane: 'webhooks',
    label: 'Webhooks Management API',
    api_resource: 'PayPal Webhooks API',
    docs_url: 'https://developer.paypal.com/docs/api/webhooks/v1/',
    status: 'live',
    implemented: true,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    supported_actions: ['signature verification status', 'event list', 'sanitized metadata', 'internal replay readiness']
  },
  disputes: {
    lane: 'disputes',
    label: 'Disputes API',
    api_resource: 'PayPal Customer Disputes API',
    docs_url: 'https://developer.paypal.com/docs/api/customer-disputes/v1/',
    status: 'preview',
    implemented: false,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    supported_actions: ['dispute list readiness', 'amount at risk', 'evidence deadline', 'audit notes']
  },
  subscriptions: {
    lane: 'subscriptions',
    label: 'Subscriptions API',
    api_resource: 'PayPal Subscriptions API',
    docs_url: 'https://developer.paypal.com/docs/api/subscriptions/v1/',
    status: 'preview',
    implemented: false,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    supported_actions: ['plan readiness', 'subscription lifecycle', 'billing status', 'subscription webhook events']
  },
  tokens: {
    lane: 'tokens',
    label: 'Payment Method Tokens API',
    api_resource: 'PayPal Payment Method Tokens API',
    docs_url: 'https://developer.paypal.com/docs/api/payment-tokens/v3/',
    status: 'preview',
    implemented: false,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    supported_actions: ['vault readiness', 'saved payment method status', 'secure token metadata']
  },
  'currency-exchange': {
    lane: 'fx',
    label: 'Currency Exchange API',
    api_resource: 'PayPal Pricing / Currency Exchange API',
    docs_url: 'https://developer.paypal.com/docs/api/pricing/v2/',
    status: 'preview',
    implemented: false,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    supported_actions: ['currency support', 'conversion estimate readiness', 'timestamped quote metadata']
  },
  developer: {
    lane: 'developer',
    label: 'Developer Operations',
    api_resource: 'Transferly developer controls',
    docs_url: 'https://developer.paypal.com/docs/api/overview/',
    status: 'preview',
    implemented: true,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    supported_actions: ['request IDs', 'idempotency guidance', 'audit logging', 'webhook traceability']
  },
  settings: {
    lane: 'settings',
    label: 'Settings',
    api_resource: 'Transferly PayPal settings',
    docs_url: 'https://developer.paypal.com/docs/api/overview/',
    status: 'live',
    implemented: true,
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    supported_actions: ['environment mode', 'secret readiness', 'webhook readiness', 'supported currencies', 'limits summary']
  }
});

function hasConfiguredValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function readConfigValue(name) {
  return config[name] ?? process.env[name] ?? '';
}

function getMissingEnv(requiredEnv = []) {
  return requiredEnv.filter((name) => !hasConfiguredValue(readConfigValue(name)));
}

function resolvePayPalResourceStatus(definition) {
  const missingEnv = getMissingEnv(definition.required_env);
  if (missingEnv.includes('PAYPAL_CLIENT_ID') || missingEnv.includes('PAYPAL_CLIENT_SECRET')) {
    return 'needs-env';
  }
  if (missingEnv.includes('PAYPAL_WEBHOOK_ID')) {
    return 'needs-webhook';
  }
  if (config.PAYPAL_ENVIRONMENT === 'sandbox' && definition.status === 'live') {
    return 'sandbox-ready';
  }
  return definition.status;
}

function buildPayPalResourceReadiness(resource) {
  const definition = PAYPAL_RESOURCE_DEFINITIONS[resource];
  if (!definition) {
    return null;
  }

  const missingEnv = getMissingEnv(definition.required_env);
  return {
    resource,
    lane: definition.lane,
    label: definition.label,
    api_resource: definition.api_resource,
    status: resolvePayPalResourceStatus(definition),
    implementation_status: definition.status,
    implemented: Boolean(definition.implemented),
    environment: config.PAYPAL_ENVIRONMENT,
    required_env: definition.required_env,
    missing_env: missingEnv,
    webhook_required: definition.required_env.includes('PAYPAL_WEBHOOK_ID'),
    docs_url: definition.docs_url,
    supported_actions: definition.supported_actions,
    secret_values_exposed: false
  };
}

function listPayPalResourceReadiness() {
  return Object.keys(PAYPAL_RESOURCE_DEFINITIONS).map(buildPayPalResourceReadiness);
}

module.exports = {
  PAYPAL_RESOURCE_DEFINITIONS,
  buildPayPalResourceReadiness,
  listPayPalResourceReadiness,
  resolvePayPalResourceStatus
};
