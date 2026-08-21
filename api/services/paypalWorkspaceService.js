const config = require('../config');
const { PROVIDER_CONTRACT_VERSION } = require('../constants/providerWorkspaceContract');
const { presentInvoice, presentPayout } = require('../presenters/paymentPresenter');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');
const { providerDashboardService } = require('./providerDashboardService');
const { providerHealthService } = require('./providerHealthService');
const { providerStatusService } = require('./providerStatusService');
const { PayPalClient } = require('../adapters/paypalClient');
const { AppError } = require('../utils/errors');
const {
  PAYPAL_RESOURCE_DEFINITIONS,
  buildPayPalResourceReadiness,
  listPayPalResourceReadiness
} = require('../providers/paypal/readiness');
const {
  paypalCurrencyExchangeQuerySchema,
  paypalOrderQuerySchema,
  paypalResourceQuerySchema,
  paypalTransactionSearchQuerySchema
} = require('../providers/paypal/schemas');
const { mapPayPalOrderStatus, mapPayPalPaymentStatus } = require('../providers/paypal/statusMapper');
const { sanitizePayPalWebhookEvent } = require('../providers/paypal/webhookMapper');

const paypalClient = new PayPalClient(
  config.PAYPAL_CLIENT_ID,
  config.PAYPAL_CLIENT_SECRET,
  config.PAYPAL_ENVIRONMENT
);

const RESOURCE_TO_OPERATION = Object.freeze({
  overview: 'paypal.overview',
  payments: 'paypal.payments.list',
  orders: 'paypal.orders.list',
  transactions: 'paypal.transactions.search',
  webhooks: 'paypal.webhooks.list',
  disputes: 'paypal.disputes.list',
  subscriptions: 'paypal.subscriptions.list',
  tokens: 'paypal.payment_method_tokens.list',
  'currency-exchange': 'paypal.currency_exchange.preview',
  developer: 'paypal.developer.status',
  settings: 'paypal.settings.status'
});

function assertPayPalProvider(provider) {
  const providerKey = String(provider || '').trim().toLowerCase();
  if (providerKey !== 'paypal') {
    throw new AppError(404, 'PAYPAL_WORKSPACE_RESOURCE_NOT_FOUND', 'This provider resource is only available for PayPal.', {
      provider: providerKey,
      available_provider: 'paypal'
    });
  }
}

function normalizeResource(resource) {
  const normalized = String(resource || '').trim().toLowerCase();
  return normalized === 'fx' ? 'currency-exchange' : normalized;
}

function assertResource(resource) {
  const normalized = normalizeResource(resource);
  if (!PAYPAL_RESOURCE_DEFINITIONS[normalized]) {
    throw new AppError(404, 'PAYPAL_WORKSPACE_RESOURCE_NOT_FOUND', 'PayPal workspace resource was not found.', {
      resource: normalized,
      available_resources: Object.keys(PAYPAL_RESOURCE_DEFINITIONS)
    });
  }
  return normalized;
}

function buildPagination(query = {}, records = []) {
  const limit = query.limit || records.length || 25;
  return {
    limit,
    cursor: query.cursor || null,
    returned: records.length,
    has_next_page: false
  };
}

function buildNextActions(readiness, customActions = []) {
  const actions = [];
  if (readiness.missing_env?.length) {
    actions.push({
      code: 'CONFIGURE_PAYPAL_ENV',
      label: 'Complete PayPal environment configuration.',
      detail: readiness.missing_env.join(', ')
    });
  }
  if (readiness.webhook_required && readiness.missing_env?.includes('PAYPAL_WEBHOOK_ID')) {
    actions.push({
      code: 'CONFIGURE_PAYPAL_WEBHOOK',
      label: 'Configure the PayPal webhook ID.',
      detail: 'Webhook readiness is required before relying on provider state changes.'
    });
  }
  actions.push(...customActions);
  if (!actions.length) {
    actions.push({
      code: 'MONITOR_PAYPAL_WORKSPACE',
      label: 'Monitor PayPal records from Transferly.',
      detail: 'Use request IDs, provider resource IDs, and audit logs for operational traceability.'
    });
  }
  return actions.slice(0, 6);
}

function buildQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, String(value));
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
}

function defaultTransactionDateRange() {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateRangeDays(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    return null;
  }
  return Math.abs(end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
}

function getErrorCode(error) {
  return error?.code || error?.details?.name || 'PAYPAL_RESOURCE_UNAVAILABLE';
}

function getCleanProviderError(error, fallbackMessage) {
  return {
    code: getErrorCode(error),
    status: error?.status || 503,
    message: fallbackMessage,
    raw_provider_error_exposed: false
  };
}

function readAmountValue(amount) {
  if (!amount) {
    return {
      amount: null,
      currency: null
    };
  }
  return {
    amount: amount.value ?? amount.amount ?? null,
    currency: amount.currency_code || amount.currency || null
  };
}

function normalizePayPalTransaction(transaction) {
  const info = transaction.transaction_info || transaction;
  const payer = transaction.payer_info || {};
  const cart = transaction.cart_info || {};
  const shipping = transaction.shipping_info || {};
  const amount = readAmountValue(info.transaction_amount);
  const fee = readAmountValue(info.fee_amount);
  const net = readAmountValue(info.transaction_amount?.value && info.fee_amount?.value ? {
    value: Number(info.transaction_amount.value) - Number(info.fee_amount.value),
    currency_code: info.transaction_amount.currency_code
  } : null);

  return {
    id: info.transaction_id || info.paypal_reference_id || null,
    provider: 'paypal',
    source: 'paypal_transaction_search',
    type: info.transaction_event_code || info.transaction_type || 'transaction',
    status: mapPayPalPaymentStatus(info.transaction_status),
    provider_status: info.transaction_status || null,
    amount: amount.amount,
    currency: amount.currency,
    fee_amount: fee.amount,
    net_amount: net.amount,
    payer: {
      email: payer.email_address || null,
      account_id: payer.account_id || null
    },
    counterparty: shipping.name || payer.payer_name?.alternate_full_name || null,
    invoice_number: cart.invoice_number || info.invoice_id || null,
    linked_resource: info.paypal_reference_id || cart.invoice_number ? 'paypal_provider_record' : 'unlinked_provider_record',
    created_at: info.transaction_initiation_date || null,
    updated_at: info.transaction_updated_date || null,
    source_of_truth: 'provider-state-for-reconciliation-only'
  };
}

function normalizePayPalOrder(order) {
  const purchaseUnit = order.purchase_units?.[0] || {};
  const amount = readAmountValue(purchaseUnit.amount);
  const approveLink = (order.links || []).find((link) => String(link.rel || '').toLowerCase() === 'approve');

  return {
    id: order.id || null,
    provider: 'paypal',
    source: 'paypal_orders_api',
    type: 'order',
    status: mapPayPalOrderStatus(order.status),
    provider_status: order.status || null,
    intent: order.intent || null,
    amount: amount.amount,
    currency: amount.currency,
    buyer: {
      email: order.payer?.email_address || null,
      payer_id: order.payer?.payer_id || null,
      country_code: order.payer?.address?.country_code || null
    },
    approve_url_available: Boolean(approveLink?.href),
    linked_resource: purchaseUnit.invoice_id ? 'paypal_invoice_reference' : 'paypal_order',
    invoice_id: purchaseUnit.invoice_id || null,
    custom_id: purchaseUnit.custom_id || null,
    created_at: order.create_time || null,
    updated_at: order.update_time || null,
    raw_payload_exposed: false
  };
}

function buildEnvelope({ resource, requestId, status, data, pagination = null, nextActions = [] }) {
  const readiness = buildPayPalResourceReadiness(resource);
  return {
    provider: 'paypal',
    contract_version: PROVIDER_CONTRACT_VERSION,
    requestId,
    environment: config.PAYPAL_ENVIRONMENT,
    operation: RESOURCE_TO_OPERATION[resource] || `paypal.${resource}`,
    status: status || readiness.status,
    readiness,
    data,
    pagination,
    next_actions: buildNextActions(readiness, nextActions),
    metadata: {
      request_id: requestId,
      provider_branding: 'secondary-provider-context',
      transferly_shell: true,
      data_classification: 'sanitized-no-secret-values',
      sandbox_record: config.PAYPAL_ENVIRONMENT === 'sandbox',
      secret_values_exposed: false
    }
  };
}

async function getRecentInvoices(userId, limit = 5) {
  const filters = { provider: 'paypal', pageSize: limit, limit };
  if (userId) {
    filters.userId = userId;
  }
  const invoices = await invoiceRepository.findMany(filters);
  return invoices.map(presentInvoice);
}

async function getRecentPayouts(userId, limit = 5) {
  const filters = { provider: 'paypal', pageSize: limit, limit };
  if (userId) {
    filters.userId = userId;
  }
  const payouts = await payoutRepository.findMany(filters);
  return payouts.map(presentPayout);
}

async function getSanitizedWebhooks(limit = 25) {
  const events = await webhookEventRepository.findMany({ provider: 'paypal', limit });
  return events.map(sanitizePayPalWebhookEvent);
}

async function getOverview({ userId, actorType, actorId, requestId }) {
  const [dashboard, status, health, invoices, payouts, webhooks] = await Promise.all([
    providerDashboardService.getProviderDashboard({ provider: 'paypal', userId, actorType, actorId, requestId }),
    providerStatusService.getProviderStatus('paypal'),
    providerHealthService.getProviderHealth('paypal'),
    getRecentInvoices(userId, 5),
    getRecentPayouts(userId, 5),
    getSanitizedWebhooks(5)
  ]);

  return buildEnvelope({
    resource: 'overview',
    requestId,
    data: {
      identity: dashboard.provider,
      connection_status: status.status,
      provider_health: health,
      readiness: status,
      capabilities: dashboard.operation_support || [],
      resources: listPayPalResourceReadiness(),
      recent_invoices: invoices,
      recent_payouts: payouts,
      recent_payments: [],
      recent_webhook_events: webhooks,
      failed_or_pending_actions: [
        ...(dashboard.risk_flags || []),
        ...(dashboard.webhook_status?.failed_webhooks ? [{
          code: 'FAILED_WEBHOOKS',
          label: 'Webhook failures need review.',
          count: dashboard.webhook_status.failed_webhooks
        }] : [])
      ],
      next_recommended_actions: dashboard.next_recommended_actions || dashboard.next_actions || []
    }
  });
}

function buildPreparedResource({ resource, requestId, query, records = [], detail, nextActions = [] }) {
  const readiness = buildPayPalResourceReadiness(resource);
  return buildEnvelope({
    resource,
    requestId,
    status: readiness.status,
    data: {
      records,
      detail,
      source_of_truth: {
        provider_state: 'PayPal resource state is useful for reconciliation and support.',
        transferly_ledger: 'Transferly internal ledger remains the source of truth for wallet balances and release decisions.'
      },
      setup_state: readiness.implemented ? 'available' : 'prepared',
      unsupported_actions_return_setup_messages: true
    },
    pagination: buildPagination(query, records),
    nextActions
  });
}

async function listTransactions({ requestId, query, userId }) {
  const parsed = paypalTransactionSearchQuerySchema.parse(query || {});
  if (parsed.source === 'paypal') {
    return searchPayPalTransactions({ requestId, query: parsed });
  }

  const [invoices, payouts] = await Promise.all([
    getRecentInvoices(userId, Math.min(parsed.limit, 10)),
    getRecentPayouts(userId, Math.min(parsed.limit, 10))
  ]);
  const records = [
    ...invoices.map((invoice) => ({
      id: invoice.invoice_id || invoice.id,
      type: 'invoice',
      status: invoice.status,
      amount: invoice.amount,
      currency: invoice.currency,
      linked_resource: 'transferly_invoice',
      created_at: invoice.created_at || invoice.createdAt || null
    })),
    ...payouts.map((payout) => ({
      id: payout.payout_id || payout.id,
      type: 'payout',
      status: payout.status,
      amount: payout.amount,
      currency: payout.currency,
      linked_resource: 'transferly_payout',
      created_at: payout.created_at || payout.createdAt || null
    }))
  ].slice(0, parsed.limit);

  return buildPreparedResource({
    resource: 'transactions',
    requestId,
    query: parsed,
    records,
    detail: {
      query: parsed,
      paypal_search_enabled: false,
      reconciliation_ready: true
    },
    nextActions: [{
      code: 'ENABLE_PAYPAL_TRANSACTION_SEARCH',
      label: 'Connect PayPal Transaction Search for provider-native history.',
      detail: 'Keep Transferly ledger as balance source of truth after provider transaction search is enabled.'
    }]
  });
}

async function searchPayPalTransactions({ requestId, query }) {
  const defaultRange = defaultTransactionDateRange();
  const startDate = query.dateFrom || defaultRange.startDate;
  const endDate = query.dateTo || defaultRange.endDate;
  const rangeDays = getDateRangeDays(startDate, endDate);

  if (rangeDays !== null && rangeDays > 31) {
    return buildPreparedResource({
      resource: 'transactions',
      requestId,
      query,
      detail: {
        query: {
          ...query,
          dateFrom: startDate,
          dateTo: endDate
        },
        paypal_search_enabled: true,
        reconciliation_ready: true,
        provider_latency_notice: 'PayPal Transaction Search records can appear several hours after provider activity occurs.',
        provider_error: {
          code: 'PAYPAL_TRANSACTION_RANGE_TOO_LARGE',
          status: 400,
          message: 'PayPal Transaction Search supports a maximum date range of 31 days. Narrow the search window before retrying.',
          raw_provider_error_exposed: false
        }
      },
      nextActions: [{
        code: 'NARROW_PAYPAL_TRANSACTION_SEARCH_RANGE',
        label: 'Narrow the PayPal transaction search range.',
        detail: 'Use a 31-day or smaller date range when searching provider-native PayPal records.'
      }]
    });
  }

  const page = Number.isFinite(Number(query.cursor)) ? Number(query.cursor) : 1;
  const requestQuery = {
    start_date: startDate,
    end_date: endDate,
    fields: 'all',
    page_size: Math.min(query.limit || 25, 100),
    page,
    transaction_id: query.transactionId,
    transaction_status: query.status,
    transaction_type: query.transactionType || query.type
  };

  try {
    const response = await paypalClient.request({
      method: 'GET',
      path: `/v1/reporting/transactions${buildQueryString(requestQuery)}`,
      requestId,
      headers: {
        'PayPal-Enforce-ISO8601-Format': 'true'
      }
    });
    const records = (response.transaction_details || []).map(normalizePayPalTransaction);
    const totalPages = Number(response.total_pages || 0);
    const currentPage = Number(response.page || page);

    return buildEnvelope({
      resource: 'transactions',
      requestId,
      status: 'live',
      data: {
        records,
        detail: {
          query: {
            ...query,
            dateFrom: startDate,
            dateTo: endDate
          },
          paypal_search_enabled: true,
          provider_latency_notice: 'PayPal Transaction Search records can appear up to three hours after provider activity occurs. Searches must use a date range of 31 days or less.',
          max_date_range_days: 31,
          reconciliation_ready: true
        },
        source_of_truth: {
          provider_state: 'PayPal Transaction Search is used for reconciliation, investigation, and support.',
          transferly_ledger: 'Transferly internal ledger remains the source of truth for wallet balances and release decisions.'
        }
      },
      pagination: {
        limit: requestQuery.page_size,
        cursor: currentPage,
        returned: records.length,
        has_next_page: totalPages ? currentPage < totalPages : false,
        total_items: response.total_items || null,
        total_pages: response.total_pages || null
      },
      nextActions: records.length ? [] : [{
        code: 'EXPAND_PAYPAL_TRANSACTION_SEARCH',
        label: 'Adjust the PayPal transaction search range.',
        detail: 'Use a date range and status/type filters when investigating provider activity.'
      }]
    });
  } catch (error) {
    return buildPreparedResource({
      resource: 'transactions',
      requestId,
      query,
      detail: {
        query,
        paypal_search_enabled: true,
        reconciliation_ready: true,
        provider_error: getCleanProviderError(
          error,
          'PayPal Transaction Search is unavailable. Check credentials, scopes, date filters, and provider availability before retrying.'
        )
      },
      nextActions: [{
        code: 'REVIEW_PAYPAL_TRANSACTION_SEARCH',
        label: 'Review PayPal Transaction Search setup.',
        detail: 'Confirm OAuth credentials, reporting access, date range, and provider status. Raw PayPal errors are not exposed.'
      }]
    });
  }
}

async function listOrders({ requestId, query }) {
  const parsed = paypalOrderQuerySchema.parse(query || {});
  if (!parsed.orderId) {
    return buildPreparedResource({
      resource: 'orders',
      requestId,
      query: parsed,
      detail: {
        query: parsed,
        order_lookup_enabled: true,
        create_order_enabled: false,
        capture_order_enabled: false,
        capability_checks: ['order detail lookup', 'order status mapping', 'buyer/payment summary', 'Transferly timeline readiness'],
        gated_actions: ['create order', 'capture order'],
        transferly_shell: 'Checkout/order workflows remain Transferly-branded and do not imitate provider dashboards.'
      },
      nextActions: [{
        code: 'LOOKUP_PAYPAL_ORDER',
        label: 'Look up a PayPal order by provider order ID.',
        detail: 'Create and capture actions remain gated until validation, audit logging, and user authorization are implemented.'
      }]
    });
  }

  try {
    const order = await paypalClient.request({
      method: 'GET',
      path: `/v2/checkout/orders/${encodeURIComponent(parsed.orderId)}`,
      requestId
    });
    const records = [normalizePayPalOrder(order)];

    return buildEnvelope({
      resource: 'orders',
      requestId,
      status: 'live',
      data: {
        records,
        detail: {
          query: parsed,
          order_lookup_enabled: true,
          create_order_enabled: false,
          capture_order_enabled: false,
          gated_actions: ['create order', 'capture order']
        },
        source_of_truth: {
          provider_state: 'PayPal Orders state is used for checkout support and reconciliation.',
          transferly_ledger: 'Transferly internal ledger remains the source of truth for balances and release decisions.'
        }
      },
      pagination: buildPagination(parsed, records),
      nextActions: [{
        code: 'CONNECT_PAYPAL_ORDER_ACTIVITY',
        label: 'Link this order to Transferly activity records.',
        detail: 'Use invoice, payment, webhook, and ledger references before allowing operator actions.'
      }]
    });
  } catch (error) {
    return buildPreparedResource({
      resource: 'orders',
      requestId,
      query: parsed,
      detail: {
        query: parsed,
        order_lookup_enabled: true,
        create_order_enabled: false,
        capture_order_enabled: false,
        provider_error: getCleanProviderError(
          error,
          'PayPal order lookup is unavailable. Check the order ID, credentials, permissions, and provider availability before retrying.'
        )
      },
      nextActions: [{
        code: 'REVIEW_PAYPAL_ORDER_LOOKUP',
        label: 'Review PayPal order lookup setup.',
        detail: 'Confirm OAuth credentials, order ID, and provider availability. Raw PayPal errors are not exposed.'
      }]
    });
  }
}

async function listWebhooks({ requestId, query }) {
  const parsed = paypalResourceQuerySchema.parse(query || {});
  const records = await getSanitizedWebhooks(parsed.limit);
  const failedCount = records.filter((event) => String(event.status || '').toLowerCase().includes('fail')).length;
  const eventGroups = records.reduce((groups, event) => {
    const eventType = event.event_type || event.type || 'paypal.webhook.event';
    const current = groups[eventType] || {
      event_type: eventType,
      count: 0,
      failed: 0,
      processed: 0,
      first_seen_at: event.received_at || event.created_at || null,
      last_seen_at: event.received_at || event.created_at || event.processed_at || null,
      linked_records: new Set()
    };
    const status = String(event.status || '').toLowerCase();
    current.count += 1;
    current.failed += status.includes('fail') ? 1 : 0;
    current.processed += status === 'processed' ? 1 : 0;
    const seenAt = event.received_at || event.created_at || event.processed_at || null;
    if (seenAt && (!current.first_seen_at || seenAt < current.first_seen_at)) {
      current.first_seen_at = seenAt;
    }
    if (seenAt && (!current.last_seen_at || seenAt > current.last_seen_at)) {
      current.last_seen_at = seenAt;
    }
    if (event.linked_resource) {
      current.linked_records.add(event.linked_resource);
    }
    groups[eventType] = current;
    return groups;
  }, {});

  return buildEnvelope({
    resource: 'webhooks',
    requestId,
    data: {
      configured_webhook_id_present: Boolean(config.PAYPAL_WEBHOOK_ID),
      endpoint_status: config.PAYPAL_WEBHOOK_ID ? 'configured' : 'needs-webhook',
      signature_verification_status: records.some((event) => event.signature_verification_status)
        ? 'recorded'
        : 'not-recorded',
      last_successful_webhook_at: records.find((event) => String(event.status).toLowerCase() === 'processed')?.processed_at || null,
      failed_attempts: failedCount,
      replay_supported_internally: true,
      raw_payloads_exposed: false,
      event_groups: Object.values(eventGroups).map((group) => ({
        ...group,
        linked_records: Array.from(group.linked_records)
      })),
      records
    },
    pagination: buildPagination(parsed, records),
    nextActions: failedCount ? [{
      code: 'REVIEW_FAILED_PAYPAL_WEBHOOKS',
      label: 'Review failed PayPal webhook attempts.',
      detail: 'Use command-center replay or ignore controls after confirming the sanitized metadata.'
    }] : []
  });
}

function listDisputes({ requestId, query }) {
  const parsed = paypalResourceQuerySchema.parse(query || {});
  return buildPreparedResource({
    resource: 'disputes',
    requestId,
    query: parsed,
    records: [],
    detail: {
      read_only: true,
      provider_dispute_search_enabled: false,
      action_gates: ['accept claim', 'provide evidence', 'make offer', 'appeal', 'settle externally'],
      capability_checks: ['list disputes', 'amount at risk', 'evidence deadline', 'linked payment/order', 'operator notes', 'audit trail'],
      table_columns: ['dispute id', 'lifecycle status', 'amount at risk', 'evidence deadline', 'linked record', 'operator next action'],
      operator_guidance: 'Dispute actions remain disabled until evidence workflows, policy checks, and audit trails are implemented.'
    },
    nextActions: [{
      code: 'CONNECT_PAYPAL_DISPUTES_READ_MODEL',
      label: 'Connect the PayPal disputes read model.',
      detail: 'Start with read-only dispute status, amount at risk, evidence deadlines, linked records, and operator notes before enabling actions.'
    }]
  });
}

function listCurrencyExchange({ requestId, query }) {
  const parsed = paypalCurrencyExchangeQuerySchema.parse(query || {});
  return buildPreparedResource({
    resource: 'currency-exchange',
    requestId,
    query: parsed,
    detail: {
      quote: null,
      source_currency: parsed.sourceCurrency,
      target_currency: parsed.targetCurrency,
      amount_cents: parsed.amountCents || null,
      provider_quote_enabled: false,
      disclaimer: 'Final PayPal provider settlement, fees, and exchange rate may differ from any preview shown by Transferly.'
    },
    nextActions: [{
      code: 'ENABLE_PAYPAL_FX_QUOTES',
      label: 'Connect PayPal pricing APIs before showing conversion estimates.',
      detail: 'Keep every quote timestamped and clearly marked as an estimate.'
    }]
  });
}

function listSettings({ requestId }) {
  const resources = listPayPalResourceReadiness();
  return buildEnvelope({
    resource: 'settings',
    requestId,
    data: {
      environment_mode: config.PAYPAL_ENVIRONMENT,
      required_environment_variables: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
      missing_configuration: [...new Set(resources.flatMap((resource) => resource.missing_env || []))],
      webhook_endpoint_status: config.PAYPAL_WEBHOOK_ID ? 'configured' : 'needs-webhook',
      webhook_secret_status: 'not-exposed',
      supported_currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
      enabled_actions: resources.filter((resource) => resource.implemented).flatMap((resource) => resource.supported_actions),
      payout_limits: {
        source: 'service-level-risk-checks',
        display: 'Validated by Transferly before payout submission.'
      },
      notification_preferences: {
        customer_notifications: 'managed-by-invoice-workflow',
        operator_alerts: 'managed-by-transferly-ops'
      },
      readiness_by_environment: [
        {
          environment: 'sandbox',
          status: config.PAYPAL_ENVIRONMENT === 'sandbox' ? 'active' : 'configured-reference',
          missing_configuration: resources
            .filter((resource) => resource.environment === 'sandbox' || config.PAYPAL_ENVIRONMENT === 'sandbox')
            .flatMap((resource) => resource.missing_env || []),
          webhook_configured: Boolean(config.PAYPAL_WEBHOOK_ID),
          secret_values_exposed: false
        },
        {
          environment: 'live',
          status: config.PAYPAL_ENVIRONMENT === 'live' ? 'active' : 'not-active',
          missing_configuration: config.PAYPAL_ENVIRONMENT === 'live'
            ? [...new Set(resources.flatMap((resource) => resource.missing_env || []))]
            : ['PAYPAL_ENVIRONMENT=live not active'],
          webhook_configured: config.PAYPAL_ENVIRONMENT === 'live' && Boolean(config.PAYPAL_WEBHOOK_ID),
          secret_values_exposed: false
        }
      ],
      docs_links: resources.map((resource) => ({
        label: resource.label,
        url: resource.docs_url
      })),
      secret_values_exposed: false
    }
  });
}

function listDeveloper({ requestId }) {
  return buildPreparedResource({
    resource: 'developer',
    requestId,
    detail: {
      request_ids: 'included in provider responses and logs',
      idempotency: 'required for PayPal payout creation',
      audit_logging: 'invoice creation, payout requests, approvals, rejection, webhook processing, and ledger changes',
      webhook_payload_policy: 'sanitized metadata only in UI responses',
      supported_internal_tools: ['webhook replay', 'webhook ignore', 'dead-letter recovery', 'provider health']
    }
  });
}

function listPreparedApiResource(resource, requestId, query) {
  const parsed = paypalResourceQuerySchema.parse(query || {});
  const resourceSpecific = {
    payments: {
      capability_checks: ['captures', 'authorizations', 'refunds', 'voids', 'payment detail lookup'],
      secure_display: 'No raw payment credentials, card data, or authorization secrets are exposed.'
    },
    orders: {
      capability_checks: ['create order', 'approve order readiness', 'capture order', 'buyer summary', 'order timeline'],
      transferly_shell: 'Checkout/order workflows remain Transferly-branded and do not imitate PayPal dashboards.'
    },
    disputes: {
      capability_checks: ['list disputes', 'amount at risk', 'evidence deadline', 'linked payment/order', 'admin notes'],
      operator_guidance: 'Dispute actions remain disabled until evidence workflows and audit trails are implemented.'
    },
    subscriptions: {
      capability_checks: ['plans', 'subscriptions', 'billing status', 'subscriber details', 'subscription webhook events'],
      separation: 'Subscription workflows stay separate from invoice and order actions.'
    },
    tokens: {
      capability_checks: ['vault readiness', 'saved payment method status', 'user permission checks', 'token lifecycle metadata'],
      secure_display: 'Raw payment tokens, cards, secrets, and sensitive payment details are never returned.'
    }
  };

  return buildPreparedResource({
    resource,
    requestId,
    query: parsed,
    detail: resourceSpecific[resource] || {},
    nextActions: [{
      code: `ENABLE_PAYPAL_${resource.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
      label: `Connect the ${PAYPAL_RESOURCE_DEFINITIONS[resource].label} backend module.`,
      detail: 'Add adapter calls, Zod validation, authorization checks, audit logs, and provider-specific tests before enabling live actions.'
    }]
  });
}

async function getPayPalWorkspaceResource({ provider, resource, requestId, query, userId, actorType, actorId }) {
  assertPayPalProvider(provider);
  const normalizedResource = assertResource(resource);

  if (normalizedResource === 'overview') {
    return getOverview({ userId, actorType, actorId, requestId });
  }
  if (normalizedResource === 'transactions') {
    return listTransactions({ requestId, query, userId });
  }
  if (normalizedResource === 'orders') {
    return listOrders({ requestId, query });
  }
  if (normalizedResource === 'webhooks') {
    return listWebhooks({ requestId, query });
  }
  if (normalizedResource === 'disputes') {
    return listDisputes({ requestId, query });
  }
  if (normalizedResource === 'currency-exchange') {
    return listCurrencyExchange({ requestId, query });
  }
  if (normalizedResource === 'settings') {
    return listSettings({ requestId });
  }
  if (normalizedResource === 'developer') {
    return listDeveloper({ requestId });
  }
  return listPreparedApiResource(normalizedResource, requestId, query);
}

module.exports = {
  paypalWorkspaceService: {
    getPayPalWorkspaceResource
  }
};
