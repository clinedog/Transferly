import { expect, test } from '@playwright/test';

const adminUser = {
  id: 'admin-user',
  email: 'admin@transferly.test',
  displayName: 'Admin Operator',
  isAdmin: true
};

const adminProfile = {
  id: 'admin-user',
  name: 'Admin Operator',
  is_admin: true,
  points: 5000,
  wallet: {
    currencyCode: 'USD',
    availableBalanceCents: 125000,
    pendingBalanceCents: 18000,
    frozenBalanceCents: 5000,
    paidOutBalanceCents: 74000
  }
};

const invoiceRecord = {
  internal_invoice_id: 'inv_internal_1001',
  invoice_id: 'PAYPAL-INV-1001',
  invoice_link: 'https://www.paypal.com/invoice/p/#PAYPAL-INV-1001',
  provider: 'paypal',
  status: 'SENT',
  summary: {
    invoice_number: 'INV-1001',
    recipient_email: 'buyer@example.com',
    amount: '150.00',
    currency: 'USD',
    issue_date: '2026-05-10',
    due_date: '2026-05-17',
    auto_reminders_cancelled_at: null
  },
  official_paypal: {
    last_synced_at: '2026-05-10T12:00:00.000Z',
    qr: {
      image_url_png: 'https://example.test/invoice-qr.png'
    }
  },
  metadata: {}
};

const stripeInvoiceRecord = {
  internal_invoice_id: 'stripe_invoice_1002',
  invoice_id: 'STRIPE-INV-1002',
  provider: 'stripe',
  status: 'PAID',
  summary: {
    invoice_number: 'INV-1002',
    recipient_email: 'stripe-buyer@example.com',
    amount: '321.50',
    currency: 'USD',
    issue_date: '2026-05-11',
    due_date: '2026-05-18'
  },
  metadata: {
    provider: 'stripe'
  }
};

const payoutRecord = {
  payout_id: 'payout_1001',
  provider: 'paypal',
  status: 'PENDING_APPROVAL',
  risk_decision: 'REVIEW',
  summary: {
    receiver: 'recipient@example.com',
    recipient_type: 'EMAIL',
    amount: '75.00',
    currency: 'USD',
    total_debit: '76.25'
  },
  pricing: {
    fee: '1.25'
  },
  tracking: {
    sender_batch_id: 'batch_1001',
    payout_batch_id: 'paypal_batch_1001',
    payout_item_id: 'paypal_item_1001'
  },
  official_paypal: {
    provider_item_status: 'PENDING',
    provider_batch_status: 'PROCESSING',
    last_synced_at: '2026-05-10T12:00:00.000Z',
    remediation: {
      reason: 'Manual review required before provider submission.'
    }
  },
  metadata: {}
};

const cryptoPayoutRecord = {
  payout_id: 'crypto_payout_1002',
  provider: 'crypto',
  status: 'COMPLETED',
  summary: {
    receiver: 'wallet@example.com',
    recipient_type: 'WALLET',
    amount: '42.00',
    currency: 'USD',
    total_debit: '42.00'
  },
  metadata: {
    provider: 'crypto'
  }
};

const stripePaymentIssue = {
  payment_issue_id: 'issue_stripe_1001',
  provider: 'stripe',
  entity_type: 'invoice',
  entity_id: 'stripe_invoice_1002',
  issue_type: 'webhook_delay',
  severity: 'high',
  status: 'open',
  summary: 'Stripe webhook delivery is delayed',
  metadata: {
    provider: 'stripe'
  },
  created_at: '2026-05-11T12:04:00.000Z',
  updated_at: '2026-05-11T12:05:00.000Z'
};

const webhookEvents = [
  {
    webhook_event_id: 'webhook_paypal_1001',
    provider: 'paypal',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    status: 'PROCESSED',
    linked_resource: 'PAYPAL-INV-1001',
    created_at: '2026-05-10T12:01:00.000Z',
    received_at: '2026-05-10T12:01:00.000Z',
    processed_at: '2026-05-10T12:01:20.000Z',
    signature_verification_status: 'verified'
  },
  {
    webhook_event_id: 'webhook_paypal_1002',
    provider: 'paypal',
    event_type: 'PAYMENT.CAPTURE.DENIED',
    status: 'FAILED',
    linked_resource: 'paypal_batch_1001',
    created_at: '2026-05-10T12:04:00.000Z',
    received_at: '2026-05-10T12:04:00.000Z',
    signature_verification_status: 'verified'
  },
  {
    webhook_event_id: 'webhook_stripe_1001',
    provider: 'stripe',
    event_type: 'stripe.invoice.paid',
    status: 'PROCESSED',
    created_at: '2026-05-11T12:01:00.000Z',
    processed_at: '2026-05-11T12:01:20.000Z'
  },
  {
    webhook_event_id: 'webhook_stripe_1002',
    provider: 'stripe',
    event_type: 'stripe.invoice.payment_failed',
    status: 'FAILED',
    last_error: 'Signature retry',
    created_at: '2026-05-11T12:02:00.000Z'
  }
];

const providerHealth = [
  {
    provider: 'paypal',
    display_name: 'PayPal',
    provider_status: 'ready',
    score: 96,
    status: 'healthy',
    failed_webhooks: 0,
    recent_webhooks: 1,
    unresolved_issues: 0,
    reasons: [],
    next_actions: []
  },
  {
    provider: 'stripe',
    display_name: 'Stripe',
    provider_status: 'degraded',
    score: 82,
    status: 'degraded',
    failed_webhooks: 1,
    recent_webhooks: 2,
    unresolved_issues: 1,
    reasons: ['1 failed or retrying webhook event'],
    next_actions: ['Replay or ignore failed Stripe webhooks']
  }
];

const deadLetterJobs = [
  {
    job_id: 'dead_letter_stripe_1001',
    name: 'process-approved-payout-dead-letter',
    source_queue: 'payout-process',
    source_job_id: 'payout_stripe_1001',
    failed_reason: 'Provider queue exhausted retries',
    data: {
      sourceQueue: 'payout-process',
      sourceJobId: 'payout_stripe_1001',
      payload: {
        provider: 'stripe',
        payout_id: 'payout_stripe_1001'
      }
    },
    recovery: null
  }
];

function buildWebhookDetail(event, overrides = {}) {
  const source = event || webhookEvents[0];
  const isProcessed = source.status === 'PROCESSED';

  return {
    ...source,
    event_id: source.event_id || `stripe:${source.webhook_event_id}`,
    resource_type: 'invoice',
    processing_attempts: source.processing_attempts ?? (isProcessed ? 1 : 2),
    can_replay: source.status !== 'REJECTED',
    can_ignore: !['IGNORED', 'PROCESSED'].includes(source.status),
    sanitized_payload: {
      has_payload: true,
      id: source.webhook_event_id === 'webhook_stripe_1002' ? 'evt_stripe_1002' : 'evt_stripe_1001',
      type: source.event_type,
      provider: source.provider,
      resource_id: source.webhook_event_id === 'webhook_stripe_1002' ? 'stripe_invoice_1002' : 'stripe_invoice_1001',
      resource_type: 'invoice',
      top_level_keys: ['id', 'type', 'provider', 'data']
    },
    verification: {
      has_verification_payload: true,
      verification_status: 'verified',
      signature_header_present: true,
      transmission_id_present: false
    },
    ...overrides
  };
}

const receiptRecord = {
  id: 'receipt_existing_1001',
  type: 'bank',
  title: 'Bank Transfer Slip - Ada Lovelace',
  summary: {
    text: 'Project milestone payment'
  },
  data: {
    details: {
      senderName: 'Ada Lovelace',
      senderAccount: '1002003004',
      senderBank: 'Transferly Wallet',
      receiverName: 'Grace Hopper',
      receiverAccount: '4003002001',
      receiverBank: 'Opay',
      amount: '25000',
      transactionDate: '2026-05-28',
      transactionTime: '10:00',
      transactionRef: 'TRXEXISTING1001',
      narration: 'Project milestone payment',
      sessionId: 'SESSION1',
      status: 'Successful'
    }
  },
  created_at: '2026-05-28T10:00:00.000Z'
};

const providerDisplayNames = {
  paypal: 'PayPal',
  stripe: 'Stripe',
  crypto: 'Crypto Commerce',
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
  wise: 'Wise'
};

const providerSlugs = Object.keys(providerDisplayNames);

function getMockProviderOperations(provider) {
  return {
    invoices: {
      status: ['paypal', 'stripe', 'paystack', 'flutterwave', 'crypto'].includes(provider) ? 'live' : 'setup',
      implemented: ['paypal', 'stripe', 'paystack', 'flutterwave', 'crypto'].includes(provider)
    },
    payouts: {
      status: ['paypal', 'crypto'].includes(provider) ? 'live' : 'setup',
      implemented: ['paypal', 'crypto'].includes(provider)
    },
    balance: {
      status: ['paypal', 'stripe', 'crypto'].includes(provider) ? 'live' : 'setup',
      implemented: ['paypal', 'stripe', 'crypto'].includes(provider)
    },
    activity: {
      status: 'live',
      implemented: true
    }
  };
}

function getMockProviderLanes(provider) {
  const laneSeeds = [
    ['overview', 'Overview', 'overview'],
    ['invoices', 'Collections', 'collect'],
    ['payouts', 'Sending', 'send'],
    ['balances', 'Balances', 'balance'],
    ['activity', 'Activity', 'activity']
  ];

  return laneSeeds.map(([id, label, intent]) => ({
    id,
    label,
    intent,
    bot_action: `provider:${provider}:${id}`
  }));
}

function buildProviderCapability(provider) {
  return {
    slug: provider,
    display_name: providerDisplayNames[provider] || provider,
    operations: getMockProviderOperations(provider),
    lanes: getMockProviderLanes(provider)
  };
}

function buildProviderReadiness(provider) {
  const operations = getMockProviderOperations(provider);

  return {
    provider,
    display_name: providerDisplayNames[provider] || provider,
    ready: Object.values(operations).some((operation) => operation.implemented),
    operations: Object.entries(operations).map(([operation, value]) => ({ operation, ...value })),
    lanes: getMockProviderLanes(provider),
    recommended_next_steps: []
  };
}

function buildProviderHealth(provider) {
  return providerHealth.find((item) => item.provider === provider) || {
    provider,
    display_name: providerDisplayNames[provider] || provider,
    provider_status: provider === 'wise' ? 'setup' : 'ready',
    score: provider === 'wise' ? 58 : 90,
    status: provider === 'wise' ? 'setup' : 'healthy',
    failed_webhooks: 0,
    recent_webhooks: 0,
    unresolved_issues: 0,
    reasons: [],
    next_actions: []
  };
}

function buildProviderStatus(provider) {
  const health = buildProviderHealth(provider);
  const readiness = buildProviderReadiness(provider);

  return {
    provider,
    display_name: providerDisplayNames[provider] || provider,
    status: readiness.ready ? 'ready' : 'setup',
    ready: readiness.ready,
    provider_status: health.provider_status,
    health_status: health.status,
    health_score: health.score,
    operations: readiness.operations,
    lanes: readiness.lanes,
    warnings: health.reasons || [],
    next_actions: health.next_actions || []
  };
}

function buildPayPalWorkspaceEnvelope(resource = 'overview') {
  const readiness = {
    resource,
    label: resource === 'transactions' ? 'Transaction Search API' : resource,
    api_resource: `PayPal ${resource}`,
    status: 'sandbox-ready',
    implemented: true,
    environment: 'sandbox',
    required_env: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    missing_env: [],
    supported_actions: ['readiness', 'health', 'recent activity', 'next actions'],
    webhook_required: true
  };
  const records = resource === 'transactions'
    ? [
        { id: 'PAYPAL-TXN-1001', type: 'invoice', amount: '150.00', currency: 'USD', status: 'COMPLETED', linked_resource: 'transferly_invoice', source: 'paypal_transaction_search', created_at: '2026-05-10T12:00:00.000Z' },
        { id: 'PAYPAL-PAYOUT-TXN-1002', type: 'payout', amount: '75.00', currency: 'USD', status: 'PENDING', linked_resource: 'transferly_payout', source: 'provider_activity', created_at: '2026-05-11T12:00:00.000Z' }
      ]
    : resource === 'disputes'
      ? [
          {
            dispute_id: 'PP-DISPUTE-1001',
            status: 'WAITING_FOR_SELLER_RESPONSE',
            lifecycle_status: 'UNDER_REVIEW',
            amount_at_risk: '150.00',
            currency: 'USD',
            evidence_deadline: '2026-05-20T12:00:00.000Z',
            linked_resource: 'PAYPAL-INV-1001',
            next_action: 'Review evidence deadline'
          }
        ]
    : [];
  const paypalWebhookEvents = webhookEvents.filter((event) => event.provider === 'paypal').slice(0, 5);
  const eventGroups = Object.values(paypalWebhookEvents.reduce((groups, event) => {
    const group = groups[event.event_type] || {
      event_type: event.event_type,
      count: 0,
      processed: 0,
      failed: 0,
      first_seen_at: event.received_at,
      last_seen_at: event.received_at,
      linked_records: []
    };
    group.count += 1;
    group.processed += event.status === 'PROCESSED' ? 1 : 0;
    group.failed += event.status === 'FAILED' ? 1 : 0;
    group.linked_records.push(event.linked_resource);
    groups[event.event_type] = group;
    return groups;
  }, {}));
  return {
    provider: 'paypal',
    environment: 'sandbox',
    status: 'sandbox-ready',
    readiness,
    data: {
      identity: { slug: 'paypal', display_name: 'PayPal', status: 'live', environment: 'sandbox' },
      readiness,
      resources: [readiness],
      records,
      recent_invoices: [invoiceRecord],
      recent_payouts: [payoutRecord],
      recent_activity: {
        status: 'live',
        items: [
          {
            id: 'PAYPAL-ACTIVITY-1001',
            type: 'invoice',
            label: 'Sandbox consulting invoice',
            status: 'SENT',
            amount: '150.00',
            currency: 'USD',
            created_at: '2026-05-10T12:00:00.000Z'
          }
        ],
        pagination: { page_size: 25, has_next_page: false }
      },
      recent_payments: records,
      recent_webhook_events: paypalWebhookEvents.slice(0, 2),
      failed_or_pending_actions: [],
      next_recommended_actions: [{
        code: 'REVIEW_FAILED_PAYPAL_WEBHOOKS',
        label: 'Review failed PayPal webhook attempts.',
        detail: 'Use command-center replay or ignore controls after confirming sanitized metadata.',
        severity: 'high',
        resource: 'webhooks',
        owner: 'ops'
      }],
      provider_health: buildProviderHealth('paypal'),
      detail: {
        paypal_search_enabled: resource === 'transactions',
        provider_latency_notice: 'PayPal Transaction Search records can appear up to three hours after provider activity occurs.',
        read_only: resource === 'disputes',
        action_gates: resource === 'disputes' ? ['accept claim', 'provide evidence', 'make offer'] : [],
        table_columns: resource === 'disputes' ? ['dispute id', 'lifecycle status', 'amount at risk', 'evidence deadline', 'linked record', 'operator next action'] : [],
        operator_guidance: resource === 'disputes' ? 'Dispute actions remain disabled until evidence workflows and audit trails are implemented.' : undefined
      },
      source_of_truth: { transferly_ledger: 'Transferly internal ledger remains the source of truth for wallet balances and release decisions.' },
      environment_mode: 'sandbox',
      configured_webhook_id_present: true,
      endpoint_status: 'configured',
      signature_verification_status: 'recorded',
      failed_attempts: 0,
      event_groups: eventGroups,
      last_successful_webhook_at: '2026-05-10T12:00:00.000Z',
      webhook_endpoint_status: 'configured',
      webhook_secret_status: 'not-exposed',
      supported_currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
      enabled_actions: ['Open Hosted Invoice', 'Request Payout', 'View Transactions'],
      docs_links: [{ label: 'PayPal developer docs', url: 'https://developer.paypal.com/docs/' }],
      readiness_by_environment: [
        { environment: 'sandbox', status: 'active', webhook_configured: true, missing_configuration: [], secret_values_exposed: false },
        { environment: 'live', status: 'not-active', webhook_configured: false, missing_configuration: ['PAYPAL_ENVIRONMENT=live not active'], secret_values_exposed: false }
      ],
      secret_values_exposed: false
    },
    pagination: { cursor: 1, page: 1, total_pages: resource === 'transactions' ? 2 : 1, limit: 25, returned: records.length, has_next_page: resource === 'transactions' },
    metadata: { secret_values_exposed: false }
  };
}

function buildProviderPreflight(provider, operation) {
  const providerOperations = getMockProviderOperations(provider);
  const operationState = providerOperations[operation] || { status: 'setup', implemented: false };
  const allowed = Boolean(operationState.implemented && operationState.status === 'live');

  return {
    allowed,
    provider,
    operation,
    label: operation.charAt(0).toUpperCase() + operation.slice(1),
    status: operationState.status,
    reason: allowed ? 'Action ready.' : 'Provider operation is gated until setup completes.',
    code: allowed ? 'PROVIDER_ACTION_READY' : 'PROVIDER_OPERATION_NOT_AVAILABLE',
    supported_providers: ['paypal', 'stripe', 'crypto'],
    warnings: [],
    next_actions: []
  };
}

function buildProviderBalance(provider) {
  const balances = {
    paypal: { available: '1250.00', currency: 'USD' },
    stripe: { available: '3210.50', currency: 'USD' },
    crypto: { available: '84.00', currency: 'USD' }
  };

  return balances[provider] || { available: '0.00', currency: 'USD' };
}

function buildProviderActivity(provider) {
  return [
    {
      id: `${provider}_activity_1001`,
      type: 'invoice',
      provider,
      label: `${providerDisplayNames[provider] || provider} invoice sync`,
      status: 'processed'
    }
  ];
}

async function mockTransferlyApi(page, options = {}) {
  const {
    seedTokens = true,
    onTelegramMiniAppLogin,
    providerFailures = {},
    onApiRequest
  } = options;

  if (seedTokens) {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('transferly_api_session', 'test-user-token');
    });
  }

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const requestHeaders = route.request().headers();
    const requestId = requestHeaders['x-request-id'] || 'req-miniapp-test';
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, X-Request-Id, X-Transferly-Client',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    };
    const responseHeaders = { ...corsHeaders, 'x-request-id': requestId };

    onApiRequest?.({ path, method, headers: requestHeaders });

    const json = (payload, status = 200, headers = {}) => {
      const body =
        payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.requestId
          ? { ...payload, requestId }
          : payload;

      return route.fulfill({
        status,
        contentType: 'application/json',
        headers: { ...responseHeaders, ...headers },
        body: JSON.stringify(body)
      });
    };

    const failJson = (failure = {}) =>
      route.fulfill({
        status: failure.status || 503,
        contentType: 'application/json',
        headers: {
          ...responseHeaders,
          ...(failure.retryAfter ? { 'retry-after': String(failure.retryAfter) } : {}),
          ...(failure.headers || {}),
          'x-request-id': failure.requestId || requestId
        },
        body: JSON.stringify({
          error: {
            message: failure.message || 'Provider API unavailable.',
            code: failure.code || 'API_ERROR',
            retryAfter: failure.retryAfter
          },
          retryAfter: failure.retryAfter,
          requestId: failure.requestId || requestId
        })
      });

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: responseHeaders,
        body: ''
      });
      return;
    }

    const failure = providerFailures[`${method} ${path}`] || providerFailures[path];
    if (failure) {
      await failJson(failure);
      return;
    }

    if (path === '/api/health/client') {
      await json({
        ok: true,
        status: 'healthy',
        contractVersion: '2026-07-client-health-v1',
        environment: 'test',
        api: {
          available: true,
          mode: 'test'
        },
        auth: {
          telegramMiniApp: {
            enabled: true,
            launchUrlConfigured: true,
            expiresInSeconds: 86400
          }
        },
        cors: {
          allowedOriginCount: 1
        },
        deployment: {
          frontendOriginConfigured: true,
          miniAppOriginConfigured: true
        },
        featureFlags: {
          telegramMiniApp: true,
          providerWorkspace: true
        },
        degraded: false,
        nextActions: []
      });
      return;
    }

    if (path === '/api/bootstrap') {
      await json({
        platform: {
          platform_name: 'Transferly',
          brand_color: '#2aabee',
          bank_slip_cost: 10,
          email_receipt_cost: 5,
          default_service_point_charge: 250,
          points_value_note: '1 Transferly Point = ₦1'
        },
        economy: { points_to_naira_rate: 1, default_service_point_charge: 250, value_note: '1 Transferly Point = ₦1' },
        faqs: [],
        testimonials: []
      });
      return;
    }

    if (path === '/api/me') {
      await json({
        user: adminUser,
        profile: adminProfile,
        points: { balance: 5000 },
        referrals: {},
        receipts: [receiptRecord],
        topUpOrders: [],
        pointsFundingRequests: [],
        invoices: {
          data: [invoiceRecord, stripeInvoiceRecord],
          pagination: { page: 1, page_size: 50, total: 2, has_next_page: false }
        },
        payouts: {
          data: [payoutRecord],
          pagination: { page: 1, page_size: 50, total: 1, has_next_page: false }
        }
      });
      return;
    }

    if (path === '/api/auth/telegram-mini-app') {
      onTelegramMiniAppLogin?.(route.request().postDataJSON());
      await json({
        token: 'telegram-user-token',
        user: adminUser
      });
      return;
    }

    if (path === '/api/providers') {
      await json({
        data: providerSlugs.map(buildProviderCapability),
        contract_version: '2026-06-provider-v1'
      });
      return;
    }

    if (path === '/api/providers/readiness') {
      await json({
        data: providerSlugs.map(buildProviderReadiness),
        contract_version: '2026-06-provider-v1'
      });
      return;
    }

    const providerRouteMatch = path.match(/^\/api\/providers\/([^/]+)(?:\/(.*))?$/);
    if (providerRouteMatch) {
      const provider = decodeURIComponent(providerRouteMatch[1]);
      const rest = providerRouteMatch[2] || '';

      if (!providerSlugs.includes(provider)) {
        await json({
          error: {
            message: 'Provider not found.',
            code: 'PROVIDER_NOT_FOUND'
          }
        }, 404);
        return;
      }

      if (!rest) {
        await json({
          data: buildProviderCapability(provider),
          provider,
          contract_version: '2026-06-provider-v1'
        });
        return;
      }

      if (rest === 'readiness') {
        await json({
          data: buildProviderReadiness(provider),
          provider,
          contract_version: '2026-06-provider-v1'
        });
        return;
      }

      if (rest === 'health') {
        await json({
          data: buildProviderHealth(provider),
          provider,
          contract_version: '2026-06-provider-v1'
        });
        return;
      }

      if (rest === 'status') {
        await json({
          data: buildProviderStatus(provider),
          provider,
          contract_version: '2026-06-provider-v1'
        });
        return;
      }

      if (provider === 'paypal' && ['dashboard', 'overview', 'transactions', 'webhooks', 'settings', 'developer', 'invoices', 'payouts', 'disputes'].includes(rest)) {
        const payload = buildPayPalWorkspaceEnvelope(rest === 'dashboard' ? 'overview' : rest);
        await json(rest === 'dashboard' ? { data: payload.data, provider, contract_version: '2026-06-provider-v1' } : payload);
        return;
      }

      if (rest === 'lanes') {
        await json({
          data: getMockProviderLanes(provider),
          provider,
          contract_version: '2026-06-provider-v1'
        });
        return;
      }

      const preflightMatch = rest.match(/^actions\/([^/]+)\/preflight$/);
      if (preflightMatch) {
        const operation = decodeURIComponent(preflightMatch[1]);
        await json({
          data: buildProviderPreflight(provider, operation),
          provider,
          contract_version: '2026-06-provider-v1'
        });
        return;
      }

      if (rest === 'balance') {
        await json({
          balance: buildProviderBalance(provider),
          provider,
          contract_version: '2026-06-provider-v1'
        });
        return;
      }

      if (rest === 'activity') {
        const cursor = url.searchParams.get('cursor');
        await json({
          data: buildProviderActivity(provider).map((entry) => ({
            ...entry,
            id: cursor ? `${entry.id}_next` : entry.id,
            label: cursor ? `${providerDisplayNames[provider] || provider} invoice sync, page 2` : entry.label
          })),
          pagination: {
            cursor,
            next_cursor: cursor ? null : 'activity-page-2',
            has_next_page: !cursor,
            returned: 1
          },
          provider,
          contract_version: '2026-06-provider-v1'
        });
        return;
      }

      if (rest === 'invoices') {
        await json({
          data: [invoiceRecord, stripeInvoiceRecord].filter((invoice) => invoice.provider === provider),
          provider,
          pagination: { page: 1, page_size: 50, total: 1, has_next_page: false },
          contract_version: '2026-06-provider-v1'
        });
        return;
      }

      if (rest === 'payouts') {
        await json({
          data: [payoutRecord, cryptoPayoutRecord].filter((payout) => payout.provider === provider),
          provider,
          pagination: { page: 1, page_size: 50, total: 1, has_next_page: false },
          contract_version: '2026-06-provider-v1'
        });
        return;
      }
    }

    if (path === '/api/receipt/generate') {
      await json({
        receipt: {
          id: 'receipt_generated_1001',
          type: 'bank',
          title: 'Bank Transfer Slip - Ada Lovelace',
          summary: {
            text: 'Project milestone payment'
          },
          data: receiptRecord.data,
          created_at: '2026-05-28T10:00:00.000Z'
        },
        summary: {
          remaining_points: 4990
        }
      });
      return;
    }

    if (path === '/api/user/me/top-up-orders' && method === 'POST') {
      const body = route.request().postDataJSON();
      await json({
        order: {
          order_id: 'order_miniapp_1001',
          points: body.points,
          amount_label: body.amountLabel,
          method_id: body.methodId,
          method_title: body.methodTitle,
          service_intent: body.serviceIntent,
          vendor_url: body.vendorUrl,
          instructions: body.instructions,
          status: 'pending',
          created_at: '2026-05-28T11:00:00.000Z'
        }
      });
      return;
    }

    if (path === '/api/user/me/points/funding/config') {
      await json({
        packages: [
          { id: 'points_pkg_1000_ngn', name: '1,000 Points', points: 1000, price_minor: 100000, currency: 'NGN', bonus_points: 0, active: true, display_price: '₦1,000' },
          { id: 'points_pkg_5000_ngn', name: '5,000 Points', points: 5000, price_minor: 500000, currency: 'NGN', bonus_points: 0, active: true, display_price: '₦5,000' }
        ],
        payment_destination: {
          id: 'manual_ngn_destination_default',
          provider: 'Opay',
          account_name: 'TRANSFERLY TEST SERVICES',
          account_number: '1234567890',
          account_number_masked: '******7890',
          currency: 'NGN',
          instructions: 'Transfer exactly the amount shown.'
        },
        evidence_policy: { allowed_mime_types: ['image/png'], max_size_bytes: 8388608 },
        economy: { points_to_naira_rate: 1, default_service_point_charge: 250, value_note: '1 Transferly Point = ₦1' }
      });
      return;
    }

    if (path === '/api/user/me/points/funding/requests' && method === 'GET') {
      await json({ data: [] });
      return;
    }

    if (path === '/api/user/me/points/funding/requests' && method === 'POST') {
      const body = route.request().postDataJSON();
      await json({
        funding_request: {
          id: 'funding_miniapp_1001',
          public_reference: 'TP-20260809-A7F42C',
          package_id: body.packageId,
          requested_points: 5000,
          expected_amount_minor: 500000,
          display_amount: '₦5,000',
          currency: 'NGN',
          payment_method: 'MANUAL_BANK_TRANSFER',
          payment_reference: 'TP-20260809-A7F42C',
          destination_snapshot: {
            provider: 'Opay',
            account_name: 'TRANSFERLY TEST SERVICES',
            account_number: '1234567890',
            account_number_masked: '******7890',
            currency: 'NGN'
          },
          status: 'PAYMENT_INSTRUCTIONS',
          risk_status: 'NORMAL',
          possible_duplicate: false,
          created_at: '2026-08-09T11:00:00.000Z'
        },
        payment_destination: {
          id: 'manual_ngn_destination_default',
          provider: 'Opay',
          account_name: 'TRANSFERLY TEST SERVICES',
          account_number: '1234567890',
          account_number_masked: '******7890',
          currency: 'NGN'
        }
      }, 201);
      return;
    }

    if (path === '/api/admin/users') {
      await json({ data: [adminUser] });
      return;
    }

    if (path === '/api/admin/audit-logs') {
      await json({
        data: [
          {
            id: 'audit-admin-1001',
            actorType: 'admin',
            actorId: 'admin-user',
            action: 'points_funding.approved',
            entityType: 'points_funding_request',
            entityId: 'funding-admin-1001',
            metadata: {
              reason: 'Payment verified',
              request_id: 'req-audit-1001',
              access_token: 'redacted'
            },
            createdAt: '2026-08-09T11:30:00.000Z'
          }
        ]
      });
      return;
    }

    if (path === '/api/admin/finance/overview') {
      await json({
        overview: {
          total_points_in_circulation: 1250500,
          total_points_issued: 1500000,
          total_points_consumed: 249500,
          total_points_refunded: 2500,
          total_adjustment_points: 0,
          total_funding_minor: 125050000,
          funding_today_minor: 18500000,
          funding_month_minor: 64000000,
          pending_funding: 17,
          needs_review: 9,
          rejected_funding: 3,
          suspicious_transactions: 2,
          reconciliation_issues: 0,
          reconciliation_status: 'HEALTHY'
        }
      });
      return;
    }

    if (path === '/api/admin/risk/overview') {
      await json({
        overview: {
          open_cases: 12,
          high_risk_users: 4,
          critical_alerts: 1,
          active_restrictions: 7,
          manual_reviews: 18,
          false_positives: 3
        }
      });
      return;
    }

    if (path === '/api/admin/risk/cases') {
      await json({
        data: [
          {
            id: 'risk-case-1',
            case_number: 'RC-82931',
            user_id: 'demo-user',
            domain: 'PAYMENT_RISK',
            risk_level: 'HIGH',
            status: 'OPEN',
            title: 'PAYMENT_RISK requires review',
            summary: 'RAPID_FUNDING, REPEATED_REJECTED_PAYMENTS',
            assigned_to: 'finance-admin',
            signal_ids: ['signal-1'],
            related_resources: [{ type: 'points_funding_request', id: 'funding-admin-1001' }],
            created_at: '2026-08-09T11:25:00.000Z',
            updated_at: '2026-08-09T11:25:00.000Z'
          }
        ]
      });
      return;
    }

    if (path === '/api/admin/risk/signals') {
      await json({
        data: [
          {
            id: 'signal-1',
            signal_type: 'RAPID_FUNDING',
            domain: 'VELOCITY_RISK',
            severity: 'HIGH',
            source: 'risk-engine',
            user_id: 'demo-user',
            resource_type: 'points_funding_request',
            resource_id: 'funding-admin-1001',
            correlation_id: 'funding:funding-admin-1001',
            reason: 'Funding attempt velocity exceeded configured threshold.',
            created_at: '2026-08-09T11:25:00.000Z'
          }
        ]
      });
      return;
    }

    if (path === '/api/admin/points-funding' && method === 'GET') {
      await json({
        data: [
          {
            id: 'funding-admin-1001',
            public_reference: 'TP-20260809-A7F42C',
            user_id: 'demo-user',
            user_name: 'Demo User',
            user_email: 'demo@transferly.test',
            requested_points: 5000,
            expected_amount_minor: 500000,
            display_amount: '₦5,000',
            currency: 'NGN',
            payment_method: 'MANUAL_BANK_TRANSFER',
            payment_reference: 'TP-20260809-A7F42C',
            destination_snapshot: {
              provider: 'Opay',
              account_name: 'TRANSFERLY TEST SERVICES',
              account_number_masked: '******7890',
              currency: 'NGN'
            },
            status: 'PAYMENT_REPORTED',
            risk_status: 'NORMAL',
            possible_duplicate: false,
            assigned_to: null,
            created_at: '2026-08-09T11:00:00.000Z',
            submitted_at: '2026-08-09T11:04:00.000Z'
          }
        ]
      });
      return;
    }

    if (path === '/api/admin/points-funding/funding-admin-1001') {
      await json({
        funding_request: {
          id: 'funding-admin-1001',
          public_reference: 'TP-20260809-A7F42C',
          user_id: 'demo-user',
          user_name: 'Demo User',
          user_email: 'demo@transferly.test',
          requested_points: 5000,
          expected_amount_minor: 500000,
          display_amount: '₦5,000',
          currency: 'NGN',
          payment_reference: 'TP-20260809-A7F42C',
          destination_snapshot: {
            provider: 'Opay',
            account_name: 'TRANSFERLY TEST SERVICES',
            account_number_masked: '******7890',
            currency: 'NGN'
          },
          evidence: {
            file_id: 'evidence-1',
            metadata: { mime_type: 'image/png', size_bytes: 1024 }
          },
          status: 'PAYMENT_REPORTED',
          risk_status: 'NORMAL',
          possible_duplicate: false,
          created_at: '2026-08-09T11:00:00.000Z',
          submitted_at: '2026-08-09T11:04:00.000Z'
        }
      });
      return;
    }

    if (path === '/api/admin/finance/transactions') {
      await json({
        data: [
          {
            id: 'ptx-1',
            type: 'PURCHASE_CREDIT',
            direction: 'CREDIT',
            points: 5000,
            signed_points: 5000,
            reference_type: 'POINTS_FUNDING_REQUEST',
            reference_id: 'funding-admin-1001',
            balance_after: 12500,
            created_at: '2026-08-09T11:10:00.000Z'
          }
        ]
      });
      return;
    }

    if (path === '/api/admin/finance/reconciliation-alerts') {
      await json({ data: [] });
      return;
    }

    if (path === '/api/admin/payments/unmatched') {
      await json({
        data: [
          {
            id: 'payment-unmatched-1',
            provider: 'opay',
            provider_transaction_id: 'OPAY-TX-404',
            provider_reference: 'UNKNOWN-REF',
            amount_minor: 250000,
            currency: 'NGN',
            status: 'SUCCESS',
            match_status: 'NO_MATCH',
            risk_level: 'MEDIUM',
            created_at: '2026-08-09T11:20:00.000Z'
          }
        ]
      });
      return;
    }

    if (path === '/api/admin/invoices' || path === '/api/invoices') {
      await json({
        data: [invoiceRecord, stripeInvoiceRecord],
        pagination: { page: 1, page_size: 50, total: 2, has_next_page: false }
      });
      return;
    }

    if (path === '/api/payouts' && method === 'POST') {
      const body = route.request().postDataJSON();
      await json({
        payout_id: 'payout_miniapp_1001',
        provider: 'paypal',
        status: 'PENDING_APPROVAL',
        summary: {
          receiver: body.receiver,
          recipient_type: body.recipientType,
          amount: body.amount,
          currency: body.currency || 'USD',
          total_debit: body.amount
        },
        metadata: {
          note: body.note
        },
        created_at: '2026-05-28T11:30:00.000Z'
      });
      return;
    }

    if (path === '/api/admin/payouts' || path === '/api/payouts') {
      await json({
        data: [payoutRecord, cryptoPayoutRecord],
        pagination: { page: 1, page_size: 50, total: 2, has_next_page: false }
      });
      return;
    }

    if (path === '/api/admin/invoice-reminders') {
      await json({ data: [] });
      return;
    }

    if (path === '/api/admin/invoice-templates') {
      await json({
        data: [
          {
            id: 'template_1001',
            name: 'Standard Service Invoice',
            currency_code: 'USD',
            default_due_days: 7,
            is_active: true,
            line_items: [{ name: 'Service', quantity: 1, unitAmount: 150 }]
          }
        ]
      });
      return;
    }

    if (path === '/api/admin/payment-issues') {
      const provider = url.searchParams.get('provider');
      const issues = provider
        ? [stripePaymentIssue].filter((issue) => issue.provider === provider)
        : [stripePaymentIssue];
      await json({ data: issues });
      return;
    }

    if (path === '/api/admin/dead-letters/dead_letter_stripe_1001/recover' && method === 'POST') {
      await json({
        dead_letter: {
          ...deadLetterJobs[0],
          recovery: {
            recovered_at: '2026-05-11T12:10:00.000Z',
            recovery_job_id: 'recovered_stripe_1001',
            recovery_job_name: 'process-approved-payout'
          }
        },
        recovery: {
          recovered_at: '2026-05-11T12:10:00.000Z',
          recovery_job_id: 'recovered_stripe_1001',
          recovery_job_name: 'process-approved-payout'
        }
      });
      return;
    }

    if (path === '/api/admin/dead-letters') {
      await json({ data: deadLetterJobs });
      return;
    }

    if (path === '/api/admin/top-up-orders') {
      await json({ data: [] });
      return;
    }

    if (path.startsWith('/api/admin/payment-providers/') && path.endsWith('/balance')) {
      const segments = path.split('/');
      const provider = segments[segments.length - 2];
      const balances = {
        paypal: { available_balance_cents: 125000, currency: 'USD' },
        stripe: { available_balance_cents: 321050, currency: 'USD' },
        crypto: { available_balance_cents: 8400, currency: 'USD' },
        paystack: { available_balance_cents: 0, currency: 'USD' },
        flutterwave: { available_balance_cents: 0, currency: 'USD' },
        wise: { available_balance_cents: 0, currency: 'USD' }
      };
      await json({ balance: balances[provider] || balances.paypal });
      return;
    }

    if (path === '/api/admin/payment-providers/health') {
      await json({ data: providerHealth, generated_at: '2026-05-11T12:10:00.000Z' });
      return;
    }

    if (path === '/api/admin/payment-providers') {
      await json({
        data: [
          { key: 'paypal', label: 'PayPal', status: 'ready', capabilities: ['invoices', 'payouts', 'webhooks'] },
          { key: 'stripe', label: 'Stripe', status: 'degraded', capabilities: ['invoices', 'connect', 'webhooks'] },
          { key: 'crypto', label: 'Crypto', status: 'ready', capabilities: ['charges', 'webhooks'] }
        ]
      });
      return;
    }

    if (path === '/api/admin/payment-providers/invoice-features') {
      await json({ data: [] });
      return;
    }

    if (path.startsWith('/api/admin/webhooks/')) {
      const segments = path.split('/').filter(Boolean);
      const webhookEventId = decodeURIComponent(segments[3] || '');
      const action = segments[4] || '';
      const event = webhookEvents.find((item) => item.webhook_event_id === webhookEventId || item.event_id === webhookEventId);

      if (action === 'replay') {
        await json({
          event: buildWebhookDetail(event, {
            status: 'IGNORED',
            last_error: null,
            processing_attempts: 3,
            can_ignore: false
          })
        });
        return;
      }

      if (action === 'ignore') {
        await json({
          event: buildWebhookDetail(event, {
            status: 'IGNORED',
            last_error: null,
            can_ignore: false
          })
        });
        return;
      }

      await json({ event: buildWebhookDetail(event) });
      return;
    }

    if (path === '/api/admin/webhooks') {
      const provider = url.searchParams.get('provider');
      const events = provider
        ? webhookEvents.filter((event) => event.provider === provider)
        : webhookEvents;
      await json({ data: events });
      return;
    }

    await json({ data: [] });
  });
}

async function primeMiniAppUi(page, options = {}) {
  const { theme = 'dark' } = options;

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem('transferly_telegram_modal_dismissed', 'true');
    window.localStorage.setItem('transferly_miniapp_theme', selectedTheme);
  }, theme);
}

async function expectProviderWorkspace(page, providerName) {
  await expect(page.getByText('Transferly provider workspace', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { level: 1, name: providerName })).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });

  expect(hasOverflow).toBe(false);
}

test('root route opens the Telegram mini app workspace', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/');

  await expect(page).toHaveTitle(/Transferly/i);
  await expect(page).toHaveURL(/\/miniapp$/);
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy Points/i }).first()).toBeVisible();
});

test('legacy auth routes redirect into the Telegram mini app', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  for (const path of ['/login', '/register', '/forgot-password']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/miniapp$/);
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Buy Points/i }).first()).toBeVisible();
  }
});

test('mini app command center renders with mocked account data', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp');

  await expect(page.getByText('Welcome back,')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByTestId('miniapp-workspace-status')).toBeVisible();
  await expect(page.getByTestId('miniapp-workspace-status')).toContainText(/Runtime|Viewport|Session|Alerts/);
  await expect(page.getByLabel('Mini app session health')).toContainText('Session health');
  await expect(page.getByText(/Telegram session detected|Browser preview mode/).last()).toBeVisible();
  await expect(page.getByRole('link', { name: /AO Admin Operator/ })).toBeVisible();
  await expect(page.getByText('5,000 pts').last()).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy Points/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  await expect(page.getByText('Provider workspaces', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Support AI Reply/i }).first()).toBeVisible();
});

test('mini app command search filters actions and navigates', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp');

  await page.getByRole('button', { name: 'Open Transferly command search' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Search Transferly' });
  await expect(dialog).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search Transferly actions' }).fill('vault');
  await expect(page.getByRole('button', { name: 'Open Receipt vault' })).toBeVisible();

  await page.getByRole('button', { name: 'Open Receipt vault' }).click();
  await expect(page).toHaveURL(/\/miniapp\/vault$/);
  await expect(dialog).toBeHidden();
});

test('mini app universal search groups financial records and services', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp');

  await page.getByRole('button', { name: 'Open Transferly command search' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Search Transferly' });
  await page.getByRole('searchbox', { name: 'Search Transferly actions' }).fill('invoice');

  await expect(dialog.getByRole('heading', { name: 'Records and services' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Invoice/i }).last()).toBeVisible();
});

test('mini app activity exposes transaction center filters', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/activity');

  await expect(page.getByRole('heading', { name: /Every meaningful state change/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refunds' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Transfers' })).toBeVisible();
  await expect(page.getByLabel('Provider')).toBeVisible();
  await expect(page.getByLabel('Status')).toBeVisible();
  await expect(page.getByLabel('Currency')).toBeVisible();
  await expect(page.getByLabel('From date')).toBeVisible();
  await expect(page.getByLabel('To date')).toBeVisible();
  await expect(page.getByLabel('Maximum amount')).toBeVisible();
  await expect(page.getByLabel('Sort activity')).toBeVisible();
  await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Reconciliation', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Sort activity').selectOption('oldest');
  await expect(page.getByLabel('Sort activity')).toHaveValue('oldest');
  await page.getByRole('button', { name: 'Refunds' }).click();
  await expect(page.getByRole('main')).toContainText(/No activity yet|Refund/i);
});

test('mini app activity opens transaction detail metadata', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/activity');

  const timeline = page.locator('main').getByRole('button', { name: /^Invoice / }).first();
  await timeline.click();
  await expect(page.getByRole('region', { name: 'Transaction detail' })).toBeVisible();
  await expect(page.getByText('Transferly transaction ID')).toBeVisible();
  await expect(page.getByText(/No unresolved reconciliation signal|Reconciliation required/)).toBeVisible();
  await page.getByRole('link', { name: 'Report an issue' }).click();
  await expect(page).toHaveURL(/\/miniapp\/support\?from=activity/);
  await expect(page.getByText('Reported transaction:')).toBeVisible();
});

test('mini app services exposes normalized discovery filters', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/services');

  await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
  await expect(page.getByLabel('Filter services by provider')).toBeVisible();
  await expect(page.getByLabel('Filter services by operation')).toBeVisible();
  await expect(page.getByLabel('Filter services by availability')).toBeVisible();
});

test('mini app checks client health without blocking workspace startup', async ({ page }) => {
  const apiPaths = [];

  await primeMiniAppUi(page);
  await mockTransferlyApi(page, {
    onApiRequest: ({ path }) => {
      apiPaths.push(path);
    }
  });
  await page.goto('/miniapp');

  await expect(page.getByText('Welcome back,')).toBeVisible();
  await expect.poll(() => apiPaths.includes('/api/health/client')).toBe(true);
});

test('mini app keeps the Telegram dark-blue wallet theme across core routes', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to fetch|NETWORK_ERROR|Transferly API/i.test(message.text())) {
      pageErrors.push(message.text());
    }
  });

  await primeMiniAppUi(page, { theme: 'dark' });
  await mockTransferlyApi(page);

  const routes = [
    '/miniapp',
    '/miniapp/services',
    '/miniapp/wallet',
    '/miniapp/profile',
    '/miniapp/services/paypal/overview',
    '/miniapp/services/stripe/overview'
  ];

  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('.transferly-miniapp-skin').first()).toBeVisible();
      await expect(page.locator('main, section').first()).toBeVisible();

      const theme = await page.evaluate(() => {
        const root = document.querySelector('.transferly-miniapp-skin') || document.documentElement;
        const rootStyle = window.getComputedStyle(root);
        const bodyStyle = window.getComputedStyle(document.body);
        const documentRoot = document.documentElement;

        return {
          tgBg: rootStyle.getPropertyValue('--tg-bg-color').trim(),
          tgButton: rootStyle.getPropertyValue('--tg-button-color').trim(),
          bodyBg: bodyStyle.backgroundColor,
          hasHorizontalOverflow: documentRoot.scrollWidth > documentRoot.clientWidth + 1
        };
      });

      expect(theme.tgBg, `${route} at ${width}px`).toBe('#0b1524');
      expect(theme.tgButton, `${route} at ${width}px`).toBe('#2aabee');
      expect(theme.bodyBg, `${route} at ${width}px`).toBe('rgb(11, 21, 36)');
      expect(theme.hasHorizontalOverflow, `${route} at ${width}px`).toBe(false);
    }
  }

  expect(pageErrors).toEqual([]);
});

test('mini app shows Telegram launch guidance without a session', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page, { seedTokens: false });
  await page.goto('/miniapp/wallet');

  await expect(page.getByRole('heading', { name: 'Open Transferly from Telegram' })).toBeVisible();
  await expect(page.getByText('Telegram required')).toBeVisible();
  await expect(page.getByRole('link', { name: /Open in Telegram/i })).toHaveAttribute(
    'href',
    'https://t.me/TransferlyBot'
  );
});

test('mini app service catalog routes tiles into native service detail screens', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/services');

  await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Transaction Records' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sandbox Tools' })).toBeVisible();
  await expect(page.getByText('Flash Emails', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Bank Slips', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Opay', { exact: true })).toHaveCount(0);

  await page.goto('/miniapp/services/opay');
  await expect(page.getByRole('heading', { name: 'Opay' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Coming Soon' })).toBeDisabled();
  await expect(page.locator('a[href*="dashboard/generate"]')).toHaveCount(0);

  await page.goto('/miniapp/services');
  await page.getByRole('link', { name: /PayPal Open workspace/i }).first().click();

  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/overview$/);
  await expectProviderWorkspace(page, 'PayPal');
  await expect(page.getByText('Sandbox operations', { exact: true })).toHaveCount(0);
});

test('legacy PayPal replica routes fail closed into the provider workspace', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  for (const legacyLane of ['payment-links', 'mail']) {
    await page.goto(`/miniapp/services/paypal/${legacyLane}`);

    await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/overview$/);
    await expectProviderWorkspace(page, 'PayPal');
    await expect(page.getByText('Sandbox / test money only')).toHaveCount(0);
    await expect(page.getByText('Create a Payment Link')).toHaveCount(0);
  }

  await page.goto('/miniapp/services/paypal/settings');

  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/settings$/);
  await expectProviderWorkspace(page, 'PayPal');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true }).first()).toBeVisible();
});

test('mini app service detail handles missing service slugs', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/services/not-real');

  await expect(page.getByText('Missing service')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Services' })).toHaveAttribute('href', '/miniapp/services');
});

test('mini app route audit stays nonblank and responsive across core screens', async ({ page }) => {
  // The route matrix checks every core screen across phone, tablet, and desktop viewports.
  test.setTimeout(240000);

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text());
    }
  });
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  const routes = [
    '/miniapp',
    '/miniapp/services',
    '/miniapp/services/paypal',
    '/miniapp/services/paypal/overview',
    '/miniapp/services/paypal/invoices',
    '/miniapp/services/paypal/payouts',
    '/miniapp/services/paypal/activity',
    '/miniapp/services/paypal/developer',
    '/miniapp/services/stripe/overview',
    '/miniapp/services/stripe/payments',
    '/miniapp/services/stripe/connect',
    '/miniapp/services/wise/receive',
    '/miniapp/services/paystack/collections',
    '/miniapp/services/flutterwave/transfers',
    '/miniapp/services/crypto/send',
    '/miniapp/services/paypal/payment-links',
    '/miniapp/services/paypal/mail?mode=custom-mail',
    '/miniapp/services/paypal/mail?mode=deposit-mail',
    '/miniapp/services/paypal/settings',
    '/miniapp/studio',
    '/miniapp/invoices',
    '/miniapp/payouts',
    '/miniapp/activity',
    '/miniapp/analytics',
    '/miniapp/notifications',
    '/miniapp/clients',
    '/miniapp/risk',
    '/miniapp/security',
    '/miniapp/vault',
    '/miniapp/orders',
    '/miniapp/wallet',
    '/miniapp/ops',
    '/miniapp/support?from=wallet',
    '/miniapp/profile',
    '/miniapp/settings'
  ];

  const viewports = [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 820, height: 1180 },
    { width: 1024, height: 1366 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const route of routes) {
      pageErrors.length = 0;
      await page.goto(route, { waitUntil: 'commit', timeout: 30000 });

      const main = page.locator('main:visible').first();
      const auditTarget = `${route} at ${viewport.width}px`;
      await expect(main, auditTarget).toBeVisible({ timeout: 15000 });
      await expect.poll(
        async () => (await main.innerText()).trim().length,
        { message: auditTarget, timeout: 15000 }
      ).toBeGreaterThan(80);
      await expectNoHorizontalOverflow(page);
      expect(pageErrors, auditTarget).toEqual([]);
    }
  }
});

test.describe('mini app visual regression', () => {
  test('PayPal provider workspace desktop baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await primeMiniAppUi(page);
    await mockTransferlyApi(page);
    await page.goto('/miniapp/activity');

    await expectProviderWorkspace(page, 'PayPal');
    await expect(page.getByText('Transferly shell stays primary')).toBeVisible();
    await expect(page).toHaveScreenshot('miniapp-service-paypal-desktop.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.08
    });
  });

  test('wallet mobile baseline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await primeMiniAppUi(page);
    await mockTransferlyApi(page);
    await page.goto('/miniapp/wallet?service=paypal');

    await expect(page.getByText('points ready to spend')).toBeVisible();
    await expect(page).toHaveScreenshot('miniapp-wallet-mobile.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.08
    });
  });
});

test('mini app provider command center scopes provider operations', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/ops?provider=paypal');

  await expect(page.getByRole('heading', { name: 'Provider Command Center' })).toBeVisible();
  await expect(page.getByRole('button', { name: /PayPal/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Stripe/i })).toBeVisible();

  await page.getByRole('button', { name: /Stripe/i }).click();

  await expect(page.getByText('Stripe webhook delivery is delayed')).toBeVisible();
  await expect(
    page
      .locator('section')
      .filter({ hasText: 'Provider invoices' })
      .getByRole('article')
      .filter({ hasText: 'stripe_invoice_1002' })
  ).toBeVisible();
  await expect(page.getByText('$3,210.50')).toBeVisible();
  await expect(page.getByText('82/100').first()).toBeVisible();
  await expect(page.getByText('Webhook health', { exact: true })).toBeVisible();
  await expect(page.getByText('Dead-letter recovery', { exact: true })).toBeVisible();
  await expect(page.getByText('payout-process')).toBeVisible();

  const failedWebhook = page
    .getByRole('article')
    .filter({ hasText: 'stripe.invoice.payment_failed' })
    .first();
  await failedWebhook.getByRole('button', { name: /Details/i }).click();
  const webhookDetail = page.getByRole('article').filter({ hasText: 'Webhook detail' });
  await expect(webhookDetail).toBeVisible();
  await expect(webhookDetail.getByText('evt_stripe_1002')).toBeVisible();
  await expect(webhookDetail.getByText('Signature retry')).toBeVisible();

  await webhookDetail.getByRole('button', { name: /Replay/i }).click();
  await expect(page.getByText('Webhook replay queued')).toBeVisible();

  const deadLetterLane = page.locator('section').filter({ hasText: 'Dead-letter recovery' });
  await deadLetterLane.getByRole('button', { name: /^Recover$/ }).click();
  await expect(page.getByText('Dead-letter job recovered')).toBeVisible();
});

test('mini app sends provider API correlation headers', async ({ page }) => {
  const providerRequests = [];

  await primeMiniAppUi(page);
  await mockTransferlyApi(page, {
    onApiRequest: (entry) => {
      if (entry.method !== 'OPTIONS' && entry.path.startsWith('/api/providers')) {
        providerRequests.push(entry);
      }
    }
  });

  await page.goto('/miniapp/services/stripe/overview');
  await expectProviderWorkspace(page, 'Stripe');

  expect(providerRequests.length).toBeGreaterThan(0);
  for (const request of providerRequests) {
    expect(request.headers['x-request-id'], request.path).toBeTruthy();
    expect(request.headers['x-transferly-client'], request.path).toBe('telegram-miniapp');
  }
});

test('mini app displays provider API error codes and request IDs', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page, {
    providerFailures: {
      'GET /api/providers/stripe/dashboard': {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Provider API rate limit reached.',
        retryAfter: '2',
        requestId: 'req-provider-rate-limit'
      }
    }
  });

  await page.goto('/miniapp/services/stripe/overview');

  await expect(page.getByText('Provider API rate limit reached.')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Status 429')).toBeVisible();
  await expect(page.getByText('RATE_LIMITED')).toBeVisible();
  await expect(page.getByText('Request req-provider-rate-limit')).toBeVisible();
  await expect(page.getByText('Retry after 2s')).toBeVisible();
});

for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440]) {
  test(`mini app provider command center remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await primeMiniAppUi(page);
    await mockTransferlyApi(page);
    await page.goto('/miniapp/ops');

    await expect(page.getByRole('heading', { name: 'Provider Command', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Stripe/i })).toBeVisible();

    await page.getByRole('button', { name: /Stripe/i }).click();

    await expect(page.getByText('Stripe webhook delivery is delayed')).toBeVisible();
    await expect(page.getByText('$3,210.50')).toBeVisible();
    await expect(page.getByText('82/100').first()).toBeVisible();
    await expect(page.getByText('Webhook health', { exact: true })).toBeVisible();
    await expect(page.getByText('Dead-letter recovery', { exact: true })).toBeVisible();
  });
}

test('mini app bottom navigation remains fixed while scrolling on small screens', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/miniapp/services/paypal/activity', { waitUntil: 'commit', timeout: 15000 });

    await expect(page.locator('main:visible').first()).toBeVisible({ timeout: 15000 });
    const nav = page.locator('[data-testid="miniapp-bottom-navigation"]:visible');
    const panel = page.locator('.miniapp-bottom-nav-panel').first();
    await expect(nav, `bottom nav is visible at ${width}px`).toBeVisible();
    const navStyle = await nav.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return { position: styles.position, zIndex: styles.zIndex };
    });
    expect(navStyle.position, `bottom nav is fixed at ${width}px`).toBe('fixed');
    expect(navStyle.zIndex, `bottom nav is above content at ${width}px`).toBe('80');
    await expect(nav).toHaveAttribute('data-miniapp-mode', /browser|compact|expanded|fullscreen/);
    await expect(panel).toBeVisible();

    const contentPadding = await page.evaluate(() => {
      const shell = document.querySelector('.miniapp-shell-main');
      return Number.parseFloat(window.getComputedStyle(shell).paddingBottom);
    });
    expect(contentPadding, `content reserves bottom nav space at ${width}px`).toBeGreaterThanOrEqual(90);

    const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 160);
    if (!scrollable) {
      await page.evaluate(() => document.querySelector('.miniapp-shell-main')?.style.setProperty('min-height', '1200px'));
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 160),
      `test route is scrollable at ${width}px`
    ).toBe(true);

    const before = await nav.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    expect(before.width, `bottom nav has width before scroll at ${width}px`).toBeGreaterThan(0);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(60);

    const afterScroll = await nav.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    expect(Math.abs(afterScroll.y - before.y), `bottom nav y-position is stable at ${width}px`).toBeLessThanOrEqual(1);
    expect(afterScroll.x, `bottom nav does not overflow left at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(afterScroll.x + afterScroll.width, `bottom nav does not overflow right at ${width}px`).toBeLessThanOrEqual(width);
    expect(afterScroll.y + afterScroll.height, `bottom nav stays within viewport at ${width}px`).toBeLessThanOrEqual(844);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(60);

    const afterReturn = await nav.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    expect(Math.abs(afterReturn.y - before.y), `bottom nav y-position is stable after return at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test('mini app tracks Telegram viewport modes and fullscreen transitions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await primeMiniAppUi(page);
  await mockTransferlyApi(page, { seedTokens: false });
  await page.route('**/telegram-web-app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        const handlers = {};
        const webApp = {
          version: '8.0',
          platform: 'ios',
          isExpanded: true,
          isFullscreen: false,
          viewportHeight: 720,
          viewportStableHeight: 760,
          safeAreaInset: { top: 6, right: 0, bottom: 12, left: 0 },
          contentSafeAreaInset: { top: 10, right: 0, bottom: 24, left: 0 },
          initData: 'query_id=fullscreen-client&user=%7B%22id%22%3A9003%2C%22first_name%22%3A%22Full%22%2C%22last_name%22%3A%22Screen%22%7D&auth_date=1770000000&hash=test-signature',
          initDataUnsafe: {
            start_param: 'dashboard',
            user: {
              id: 9003,
              first_name: 'Full',
              last_name: 'Screen'
            }
          },
          themeParams: {},
          isVersionAtLeast(version) {
            const requested = String(version).split('.').map(Number);
            const current = this.version.split('.').map(Number);
            return current[0] > requested[0] || (current[0] === requested[0] && current[1] >= requested[1]);
          },
          ready() {},
          expand() {
            this.isExpanded = true;
          },
          requestFullscreen() {
            this.isFullscreen = true;
            this.viewportHeight = 844;
            this.viewportStableHeight = 844;
            handlers.fullscreenChanged?.();
            handlers.viewportChanged?.();
          },
          exitFullscreen() {
            this.isFullscreen = false;
            this.viewportHeight = 720;
            this.viewportStableHeight = 760;
            handlers.fullscreenChanged?.();
            handlers.viewportChanged?.();
          },
          onEvent(event, callback) {
            handlers[event] = callback;
          },
          offEvent(event, callback) {
            if (handlers[event] === callback) {
              delete handlers[event];
            }
          },
          setHeaderColor() {},
          setBackgroundColor() {},
          BackButton: {
            show() {},
            hide() {},
            onClick() {},
            offClick() {}
          },
          SettingsButton: {
            show() {},
            hide() {},
            onClick() {},
            offClick() {}
          },
          MainButton: {
            setText() {},
            enable() {},
            show() {},
            hide() {},
            onClick() {},
            offClick() {},
            hideProgress() {}
          },
          HapticFeedback: {
            impactOccurred() {},
            notificationOccurred() {}
          }
        };
        window.Telegram = { WebApp: webApp };
      `
    });
  });

  await page.goto('/miniapp#tgWebAppStartParam=dashboard');

  const root = page.locator('.miniapp-shell-root').first();
  await expect(root).toHaveAttribute('data-miniapp-mode', 'expanded');
  await expect(root).toHaveAttribute('data-miniapp-platform', 'ios');
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.getComputedStyle(document.documentElement).getPropertyValue('--tg-content-safe-area-bottom').trim()
      )
    )
    .toBe('24px');

  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect(root).toHaveAttribute('data-miniapp-mode', 'fullscreen');
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.getComputedStyle(document.documentElement).getPropertyValue('--tg-viewport-stable-height').trim()
      )
    )
    .toBe('844px');

  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(root).toHaveAttribute('data-miniapp-mode', 'expanded');
});

test('mini app exchanges Telegram init data for a Transferly session on launch', async ({ page }) => {
  let telegramLoginBody = null;

  await mockTransferlyApi(page, {
    seedTokens: false,
    onTelegramMiniAppLogin: (body) => {
      telegramLoginBody = body;
    }
  });

  await page.route('https://telegram.org/js/telegram-web-app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        const initData = 'query_id=telegram-test&user=%7B%22id%22%3A9001%2C%22first_name%22%3A%22Mini%22%2C%22last_name%22%3A%22User%22%7D&auth_date=1770000000&hash=test-signature';
        window.Telegram = {
          WebApp: {
            version: '7.0',
            isVersionAtLeast(version) {
              const [major, minor] = String(version).split('.').map(Number);
              return major < 7 || (major === 7 && minor <= 0);
            },
            initData,
            initDataUnsafe: {
              start_param: 'wallet',
              user: {
                id: 9001,
                first_name: 'Mini',
                last_name: 'User',
                username: 'mini_user'
              }
            },
            themeParams: {},
            ready() {},
            expand() {},
            setHeaderColor() {},
            setBackgroundColor() {},
            BackButton: {
              show() {},
              hide() {},
              onClick() {},
              offClick() {}
            },
            SettingsButton: {
              show() {},
              hide() {},
              onClick() {},
              offClick() {}
            },
            MainButton: {
              setText() {},
              enable() {},
              show() {},
              hide() {},
              onClick() {},
              offClick() {},
              hideProgress() {}
            },
            HapticFeedback: {
              impactOccurred() {},
              notificationOccurred() {}
            }
          }
        };
      `
    });
  });

  await page.goto('/miniapp#tgWebAppStartParam=wallet');

  await expect.poll(() => Boolean(telegramLoginBody?.initData?.includes('query_id=telegram-test'))).toBe(true);
  expect(telegramLoginBody.startParam).toBe('wallet');
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('transferly_api_session'))).toBe('telegram-user-token');
  await expect(page.getByText('Telegram session secured').last()).toBeVisible();
  await expect(page.getByRole('link', { name: /MU Mini User/ })).toBeVisible();
});

test('mini app keeps the workspace usable when Telegram launch requests are temporarily unavailable', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockTransferlyApi(page, {
    seedTokens: false,
    providerFailures: {
      '/api/health/client': {
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Transferly health check is temporarily unavailable.'
      },
      '/api/bootstrap': {
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Transferly bootstrap is temporarily unavailable.'
      },
      '/api/auth/telegram-mini-app': {
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Telegram session exchange is temporarily unavailable.'
      }
    }
  });

  await page.route('https://telegram.org/js/telegram-web-app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.Telegram = {
          WebApp: {
            version: '7.0',
            isVersionAtLeast() {
              return true;
            },
            initData: 'query_id=telegram-admin&user=%7B%22id%22%3A9001%2C%22first_name%22%3A%22Admin%22%2C%22last_name%22%3A%22Owner%22%7D&auth_date=1770000000&hash=test-signature',
            initDataUnsafe: {
              start_param: 'dashboard',
              user: {
                id: 9001,
                first_name: 'Admin',
                last_name: 'Owner',
                username: 'admin_owner'
              }
            },
            themeParams: {},
            ready() {},
            expand() {},
            setHeaderColor() {},
            setBackgroundColor() {},
            BackButton: {
              show() {},
              hide() {},
              onClick() {},
              offClick() {}
            },
            SettingsButton: {
              show() {},
              hide() {},
              onClick() {},
              offClick() {}
            },
            MainButton: {
              setText() {},
              enable() {},
              show() {},
              hide() {},
              onClick() {},
              offClick() {},
              hideProgress() {}
            },
            HapticFeedback: {
              impactOccurred() {},
              notificationOccurred() {}
            }
          }
        };
      `
    });
  });

  await page.goto('/miniapp#tgWebAppStartParam=dashboard');

  await expect(page.getByRole('navigation', { name: 'Transferly navigation' })).toBeVisible({
    timeout: 10000
  });
  await expect(page.getByText('Transferly is temporarily unavailable')).not.toBeVisible();
  await expect(page.getByText('Unable to reach Transferly. Please check your connection.')).not.toBeVisible();
  await expect(page.getByText('Guest preview mode')).not.toBeVisible();
  await expect(page.getByText(/Telegram session needs a retry|Transferly connection needs a retry/)).toHaveCount(1);
});

test('mini app recovers Telegram auth when WebApp data arrives after app boot', async ({ page }) => {
  let telegramLoginBody = null;

  await mockTransferlyApi(page, {
    seedTokens: false,
    onTelegramMiniAppLogin: (body) => {
      telegramLoginBody = body;
    }
  });

  await page.route('https://telegram.org/js/telegram-web-app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        const initData = 'query_id=telegram-delayed&user=%7B%22id%22%3A9002%2C%22first_name%22%3A%22Delayed%22%2C%22last_name%22%3A%22User%22%7D&auth_date=1770000000&hash=test-signature';
        window.setTimeout(() => {
          window.Telegram = {
            WebApp: {
              version: '7.0',
              isVersionAtLeast(version) {
                const [major, minor] = String(version).split('.').map(Number);
                return major < 7 || (major === 7 && minor <= 0);
              },
              initData,
              initDataUnsafe: {
                start_param: 'dashboard',
                user: {
                  id: 9002,
                  first_name: 'Delayed',
                  last_name: 'User',
                  username: 'delayed_user'
                }
              },
              themeParams: {},
              ready() {},
              expand() {},
              setHeaderColor() {},
              setBackgroundColor() {},
              BackButton: {
                show() {},
                hide() {},
                onClick() {},
                offClick() {}
              },
              SettingsButton: {
                show() {},
                hide() {},
                onClick() {},
                offClick() {}
              },
              MainButton: {
                setText() {},
                enable() {},
                show() {},
                hide() {},
                onClick() {},
                offClick() {},
                hideProgress() {}
              },
              HapticFeedback: {
                impactOccurred() {},
                notificationOccurred() {}
              }
            }
          };
        }, 1000);
      `
    });
  });

  await page.goto('/miniapp#tgWebAppStartParam=dashboard');

  await expect.poll(() => Boolean(telegramLoginBody?.initData?.includes('query_id=telegram-delayed'))).toBe(true);
  expect(telegramLoginBody.startParam).toBe('dashboard');
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('transferly_api_session'))).toBe('telegram-user-token');
  await expect(page.getByText('Telegram session secured').last()).toBeVisible();
  await expect(page.getByRole('link', { name: /DU Delayed User/ })).toBeVisible();
});

test('mini app avoids unsupported Telegram methods on older clients', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text());
    }
  });

  await mockTransferlyApi(page, { seedTokens: false });
  await page.route('https://telegram.org/js/telegram-web-app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.Telegram = {
          WebApp: {
            version: '6.0',
            isVersionAtLeast() {
              return false;
            },
            initData: 'query_id=old-client',
            initDataUnsafe: {
              user: {
                id: 9002,
                first_name: 'Old',
                username: 'old_client'
              }
            },
            themeParams: {},
            ready() {},
            expand() {},
            setHeaderColor() {
              throw new Error('setHeaderColor should be version-gated');
            },
            setBackgroundColor() {
              throw new Error('setBackgroundColor should be version-gated');
            },
            BackButton: {
              show() {
                throw new Error('BackButton show should be version-gated');
              },
              hide() {
                throw new Error('BackButton hide should be version-gated');
              },
              onClick() {
                throw new Error('BackButton onClick should be version-gated');
              },
              offClick() {}
            },
            SettingsButton: {
              show() {
                throw new Error('SettingsButton show should be version-gated');
              },
              hide() {},
              onClick() {},
              offClick() {}
            },
            MainButton: {
              setText() {},
              enable() {},
              show() {},
              hide() {},
              onClick() {},
              offClick() {},
              hideProgress() {}
            },
            HapticFeedback: {
              impactOccurred() {},
              notificationOccurred() {}
            }
          }
        };
      `
    });
  });

  await page.goto('/miniapp');

  await expect(page.getByText('Telegram session secured').last()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('mini app honors Telegram launch hash parameters', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp#tgWebAppStartParam=wallet');

  await expect(page.getByText('points ready to spend')).toBeVisible();
  await expect(page.getByRole('button', { name: /Create point order/i })).toBeVisible();
});

test('mini app support desk renders attached handoff context', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/support?from=wallet');

  await expect(page.locator('p').filter({ hasText: /^Support desk$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guided help with context' })).toBeVisible();
  await expect(page.getByText('Ready for support handoff')).toBeVisible();
  await expect(page.getByText('Screen: wallet')).toBeVisible();
  await expect(page.getByText('Transferly user: admin@transferly.test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy support context' })).toBeVisible();
  await expect(page.getByLabel('Support issue category')).toHaveValue('transaction review');
  await page.getByLabel('Support issue category').selectOption('bug report');
  await page.getByLabel('Support issue details').fill('The activity detail needs a follow-up.');
  await expect(page.getByText('Issue category: bug report')).toBeVisible();
  await expect(page.getByText('Issue details: The activity detail needs a follow-up.')).toBeVisible();
});

test('mini app exposes Telegram settings and saves local preferences', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.route('https://telegram.org/js/telegram-web-app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.__telegramSettings = { shown: false, click: null };
        window.Telegram = {
          WebApp: {
            version: '7.0',
            isVersionAtLeast(version) {
              const [major, minor] = String(version).split('.').map(Number);
              return major < 7 || (major === 7 && minor <= 0);
            },
            initData: 'query_id=test',
            initDataUnsafe: {
              user: {
                id: 1001,
                first_name: 'Admin',
                username: 'admin_operator'
              }
            },
            themeParams: {},
            ready() {},
            expand() {},
            SettingsButton: {
              show() {
                window.__telegramSettings.shown = true;
              },
              hide() {
                window.__telegramSettings.shown = false;
              },
              onClick(callback) {
                window.__telegramSettings.click = callback;
              },
              offClick(callback) {
                if (window.__telegramSettings.click === callback) {
                  window.__telegramSettings.click = null;
                }
              }
            },
            MainButton: {
              setText() {},
              enable() {},
              show() {},
              hide() {},
              onClick() {},
              offClick() {},
              hideProgress() {}
            },
            HapticFeedback: {
              impactOccurred() {},
              notificationOccurred() {}
            }
          }
        };
      `
    });
  });

  await page.goto('/miniapp');
  await expect.poll(() => page.evaluate(() => window.__telegramSettings.shown)).toBe(true);
  await expect.poll(() => page.evaluate(() => typeof window.__telegramSettings.click)).toBe('function');

  await page.evaluate(() => window.__telegramSettings.click());
  await expect(page).toHaveURL(/\/miniapp\/settings/);
  await expect(page.getByText('Mini App settings')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Telegram-native preferences' })).toBeVisible();

  const hapticsSwitch = page.getByRole('switch', { name: 'Telegram haptics' });
  await expect(hapticsSwitch).toHaveAttribute('aria-checked', 'true');
  await hapticsSwitch.click();
  await expect(hapticsSwitch).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('transferly_miniapp_haptics_enabled'))).toBe('false');

  const fundingSwitch = page.getByRole('switch', { name: /Funding and points/ });
  await expect(fundingSwitch).toHaveAttribute('aria-checked', 'true');
  await fundingSwitch.click();
  await expect(fundingSwitch).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('transferly_miniapp_notification_preferences')).funding)).toBe(false);

  await page.locator('section').filter({ hasText: 'Default screen' }).getByRole('button', { name: 'Wallet' }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('transferly_miniapp_default_screen'))).toBe('wallet');
});

test('mini app receipt studio generates from the native wizard', async ({ page }) => {
  let generationPayload = null;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/receipt/generate') {
      generationPayload = request.postDataJSON();
    }
  });

  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/miniapp/studio?service=faker-data');

  await expect(page.getByRole('main').getByRole('heading', { name: 'Receipt Studio' })).toBeVisible();
  await expect(page.getByText('SANDBOX / TEST', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('TEST DATA ONLY', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('NOT PROOF OF PAYMENT', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /Continue/i }).click();

  await page.getByLabel('Sender name').fill('Ada Lovelace');
  await page.getByLabel('Receiver name').fill('Grace Hopper');
  await page.getByLabel('Amount').fill('25000');
  await page.getByLabel('Narration').fill('Project milestone payment');
  await page.getByRole('button', { name: /Continue/i }).click();

  await expect(page.getByText('100%')).toBeVisible();
  await page.getByRole('button', { name: /Generate test data/i }).click();
  await expect(page.getByText('Sandbox record saved to vault')).toBeVisible();
  await expect.poll(() => generationPayload?.serviceSlug).toBe('faker-data');
});

test('mini app receipt vault searches and duplicates a receipt', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/vault');

  await expect(page.getByRole('heading', { name: 'Your transactions' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ada Lovelace to Grace Hopper/i })).toBeVisible();

  await page.getByLabel('Search transactions').fill('Grace');
  await expect(page.getByRole('button', { name: /Ada Lovelace to Grace Hopper/i })).toBeVisible();

  await page.getByRole('button', { name: /Duplicate as template/i }).click();
  await expect(page.getByText('Receipt duplicated')).toBeVisible();
});

test('mini app points wallet creates a backend funding request', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/wallet');

  await expect(page.getByText('points ready to spend')).toBeVisible();
  await expect(page.getByLabel('Point order readiness')).toContainText('Account linked');

  await page.getByRole('button', { name: /5,000 Points/i }).click();
  await page.getByRole('button', { name: /Create funding request/i }).click();

  await expect(page.getByRole('main').getByText('Payment instructions ready')).toBeVisible();
  const request = page.getByRole('article').filter({ hasText: 'TP-20260809-A7F42C' });
  await expect(request).toBeVisible();
  await expect(request.getByText('5,000 pts')).toBeVisible();
  await expect(request.getByText('Payment instructions')).toBeVisible();
  await expect(page.getByText('TRANSFERLY TEST SERVICES')).toBeVisible();
  await expect(page.getByText('1 Transferly Point = ₦1').first()).toBeVisible();
});

test('mini app payout request requires readiness confirmation', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/payouts');

  await expect(page.getByLabel('Payout readiness')).toContainText('Review queue');

  await page.getByRole('button', { name: /Request payout/i }).click();
  const composer = page.locator('section').filter({ hasText: 'Submit for review' });
  await composer.getByLabel('Receiver email').fill('recipient@example.com');
  await composer.getByLabel('Amount').fill('125');

  const requestButton = composer.getByRole('button', { name: /^Request payout$/ });
  await expect(requestButton).toBeDisabled();

  await composer.getByLabel(/I confirm this payout request is ready for review/i).check();
  await expect(requestButton).toBeEnabled();
  await requestButton.click();

  await expect(page.getByText('Payout requested')).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'payout_miniapp_1001' })).toBeVisible();
});

test('admin payments workspace loads and opens an invoice detail drawer', async ({ page }) => {
  await mockTransferlyApi(page);
  await page.goto('/admin?tab=payments&section=invoices');

  await expect(page.getByRole('heading', { name: 'PayPal Operations' })).toBeVisible();
  await expect(page.getByText('INV-1001', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Details' }).first().click();

  await expect(page.getByText('Invoice Detail')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'INV-1001' })).toBeVisible();
});

test('admin roadmap surfaces expose analytics, payment links, and automation controls', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  await page.goto('/admin?tab=analytics');
  await expect(page.getByRole('heading', { name: 'Authoritative analytics' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download CSV' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();

  await page.goto('/admin?tab=payment-links');
  await expect(page.getByRole('heading', { name: 'Provider-backed checkout links' })).toBeVisible();

  await page.goto('/admin?tab=automations');
  await expect(page.getByText('Automation builder', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create safe rule' })).toBeVisible();
});

test('admin analytics supports an explicit custom date range', async ({ page }) => {
  await primeMiniAppUi(page);
  const requests = [];
  await mockTransferlyApi(page, {
    onApiRequest: ({ path, method }) => {
      if (method === 'GET' && path === '/api/admin/finance/analytics') requests.push(path);
    }
  });
  await page.goto('/admin?tab=analytics');

  await page.getByLabel('Analytics period').selectOption('custom');
  await expect(page.getByLabel('Analytics from')).toBeVisible();
  await expect(page.getByLabel('Analytics to')).toBeVisible();
  await page.getByLabel('Analytics from').fill('2026-09-01T00:00');
  await page.getByLabel('Analytics to').fill('2026-09-15T23:59');
  await expect.poll(() => requests.length).toBeGreaterThan(0);
});

test('admin roadmap surfaces remain usable without horizontal overflow on phone and desktop', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ['/admin?tab=analytics', '/admin?tab=payment-links', '/admin?tab=automations']) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }
});

test('admin finance center loads funding queue and opens funding review', async ({ page }) => {
  await mockTransferlyApi(page);
  await page.goto('/admin?tab=finance');

  await expect(page.getByRole('heading', { name: 'Admin Finance Center' })).toBeVisible();
  await expect(page.getByText('Points in circulation')).toBeVisible();
  await expect(page.getByText('TP-20260809-A7F42C')).toBeVisible();
  await expect(page.getByText('OPAY-TX-404')).toBeVisible();
  await page.getByRole('button', { name: /Review/i }).click();

  await expect(page.getByRole('dialog').getByText('Funding Review')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('₦5,000 = 5,000 pts')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('1 Point = ₦1')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('TRANSFERLY TEST SERVICES')).toBeVisible();
});

test('admin transaction center loads ledger and exception records', async ({ page }) => {
  await mockTransferlyApi(page);
  await page.goto('/admin?tab=transactions');

  await expect(page.getByRole('heading', { name: 'Transaction center' })).toBeVisible();
  await expect(page.getByRole('combobox')).toBeVisible();
  await expect(page.getByRole('combobox').locator('option[value="ledger"]')).toHaveCount(1);
  await expect(page.getByRole('combobox').locator('option[value="issue"]')).toHaveCount(1);
  await expect(page.getByText('Records', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  await expect(page.getByText(/^Updated \d/)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^transferly-transaction-center-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('admin audit log shows immutable events without sensitive metadata', async ({ page }) => {
  await mockTransferlyApi(page);
  await page.goto('/admin?tab=audit');

  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  await expect(page.getByText('points_funding.approved')).toBeVisible();
  await expect(page.getByText('Payment verified')).toBeVisible();
  await expect(page.getByText('access_token')).toHaveCount(0);
});

test('admin overview prioritizes operational exceptions and provider health', async ({ page }) => {
  await mockTransferlyApi(page);
  await page.goto('/admin?tab=overview');

  await expect(page.getByRole('heading', { name: 'Exception-first overview' })).toBeVisible();
  await expect(page.getByText('Funding reviews', { exact: true })).toBeVisible();
  await expect(page.getByText('Risk cases', { exact: true })).toBeVisible();
  await expect(page.getByText('Reconciliation', { exact: true })).toBeVisible();
  await expect(page.getByText('Provider health', { exact: true })).toBeVisible();
  await expect(page.getByText('Attention queue', { exact: true })).toBeVisible();
});

test('admin risk center loads cases and signals without exposing rule thresholds', async ({ page }) => {
  await mockTransferlyApi(page);
  await page.goto('/admin?tab=risk');

  await expect(page.getByRole('heading', { name: 'Admin Risk Center' })).toBeVisible();
  await expect(page.getByText('Open Cases')).toBeVisible();
  await expect(page.getByText('RC-82931')).toBeVisible();
  await expect(page.getByText('RAPID_FUNDING').first()).toBeVisible();
  await expect(page.getByText(/Users never see rule names/i)).toBeVisible();
});

test('provider-first routes and legacy redirects land in provider workspaces', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  await page.goto('/miniapp/services/paypal');
  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/overview$/);
  await expectProviderWorkspace(page, 'PayPal');
  await expect(page.getByText('Sandbox operations', { exact: true })).toHaveCount(0);

  await page.goto('/services/paypal?view=invoices&status=sent');
  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/invoices\?status=sent$/);
  await expect(page.locator('section').filter({ hasText: 'Collections for provider-backed invoices, hosted payment links, reminders, QR generation, and status refresh.' }).getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible({ timeout: 10000 });

  await page.goto('/miniapp/services/paypal/payouts');
  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/payouts$/);
  await expect(page.locator('section').filter({ hasText: 'PayPal payout batch creation, preview, retry-safe submission, batch tracking, and status review.' }).getByRole('heading', { name: 'Payouts', exact: true })).toBeVisible({ timeout: 10000 });

  await page.goto('/miniapp/invoices?provider=stripe&status=paid');
  await expect(page).toHaveURL(/\/miniapp\/services\/stripe\/payments\?status=paid$/);
  await expectProviderWorkspace(page, 'Stripe Connect');

  await page.goto('/miniapp/payouts?provider=crypto');
  await expect(page).toHaveURL(/\/miniapp\/services\/crypto\/send$/);
  await expectProviderWorkspace(page, 'Crypto Commerce');
});

test('PayPal provider workspace exposes a safe retry state when the API fails', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page, {
    providerFailures: {
      'GET /api/providers/paypal/dashboard': {
        status: 503,
        message: 'PayPal sandbox dashboard is temporarily unavailable.',
        code: 'PAYPAL_DASHBOARD_UNAVAILABLE'
      }
    }
  });

  await page.goto('/miniapp/services/paypal/overview');

  await expect(page.getByRole('alert')).toContainText('PayPal sandbox dashboard is temporarily unavailable.');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByText('PAYPAL_DASHBOARD_UNAVAILABLE')).toHaveCount(0);
});

test('PayPal provider workspace remains usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  await page.goto('/miniapp/services/paypal/overview');

  await expectProviderWorkspace(page, 'PayPal');
  await expect(page.getByText('Transferly provider workspace')).toBeVisible();
  await page.getByRole('link', { name: 'Invoices' }).first().click();
  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/invoices$/);
  await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('PayPal collections exposes the payment-link simulator boundary', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  await page.goto('/miniapp/services/paypal/invoices');

  await expect(page.getByRole('heading', { name: 'Payment Links & Buttons', exact: true })).toBeVisible();
  await expect(page.getByText('Use hosted links generated from Transferly invoice records. This simulator never creates an official PayPal-branded checkout page.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Open invoice builder/i })).toHaveAttribute('href', /\/miniapp\/services\/paypal\/invoices$/);
  await expect(page.getByText('Transferly’s internal ledger remains authoritative.')).toBeVisible();
});

test('PayPal console overview uses hosted-console sections and copy', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  await page.goto('/miniapp/services/paypal/overview');

  await expect(page.locator('section').filter({ hasText: 'Environment, webhook readiness, supported operations, and support resources.' }).getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByText('PayPal-compatible workflows inside Transferly')).toBeVisible();
  await expect(page.getByText('Synthetic test data only. No live PayPal account, credentials, or funds are accessed from this simulator.')).toBeVisible();
  await expect(page.getByText('Business tools')).toBeVisible();
  await expect(page.getByText('Create, send, refresh, and track hosted PayPal invoices.')).toBeVisible();
  await expect(page.getByText('Submit payout batches, track status, and review payout readiness.')).toBeVisible();
  const quickActions = page.locator('#paypal-quick-actions');
  await expect(quickActions.getByRole('link', { name: /Open Hosted Invoice/i })).toBeVisible();
  await expect(quickActions.getByRole('link', { name: /Request Payout/i })).toBeVisible();
  await quickActions.getByRole('button', { name: /Send Reminder/i }).click();
  await expect(page.getByRole('dialog', { name: 'Send PayPal invoice reminder?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('The hosted invoice link comes from PayPal’s invoice resource.')).toBeVisible();
  await expect(page.getByText('Webhook signatures must be verified before any state mutation.')).toBeVisible();
  await expect(page.getByText('Transferly ledger remains the source of truth for internal balances.')).toBeVisible();
  await expect(page.getByText('Reconciliation workbench')).toBeVisible();
  await expect(page.getByText('Prioritized next actions')).toBeVisible();

  await page.goto('/miniapp/services/paypal/transactions');
  await expect(page.locator('section').filter({ hasText: 'Search invoices, payouts, and provider transactions in one PayPal workspace view.' }).getByRole('heading', { name: 'Transactions' })).toBeVisible();
  await expect(page.getByPlaceholder('Search PayPal transactions...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export sanitized JSON' })).toBeVisible();
  await page.getByText('View sanitized transaction details').first().click();
  await expect(page.getByText('Transaction ID').first()).toBeVisible();
  await expect(page.getByText('PayPal Transaction Search records can appear up to three hours after provider activity occurs.')).toBeVisible();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.locator('input[type="datetime-local"]').nth(0).fill('2026-05-01T00:00');
  await page.locator('input[type="datetime-local"]').nth(1).fill('2026-06-15T00:00');
  await expect(page.getByText('PayPal Transaction Search supports a maximum 31-day range. Narrow the dates before searching.')).toBeVisible();

  await page.goto('/miniapp/services/paypal/webhooks');
  await expect(page.getByText('Event health by type')).toBeVisible();
  await expect(page.getByText('PAYMENT.CAPTURE.COMPLETED')).toBeVisible();

  await page.goto('/miniapp/services/paypal/disputes');
  await expect(page.getByRole('heading', { name: 'Disputes', exact: true })).toBeVisible();
  await expect(page.getByText('Action gates')).toBeVisible();
  await expect(page.getByText('PP-DISPUTE-1001')).toBeVisible();

  await page.goto('/miniapp/services/paypal/settings');
  await expect(page.getByText('Sandbox vs live readiness')).toBeVisible();
  await expect(page.getByText('PAYPAL_ENVIRONMENT=live not active')).toBeVisible();
});

test('legacy PayPal invoice launcher opens the PayPal provider invoice lane', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/services/paypal?view=invoices');

  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/invoices/);
  await expect(page.locator('section').filter({ hasText: 'Collections for provider-backed invoices, hosted payment links, reminders, QR generation, and status refresh.' }).getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Available invoice actions')).toBeVisible();
  await expect(page.getByText('INV-1001', { exact: true })).toBeVisible();
});

test('legacy PayPal payout launcher opens the PayPal provider payout lane', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/services/paypal?view=payouts');

  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/payouts/);
  await expect(page.locator('section').filter({ hasText: 'PayPal payout batch creation, preview, retry-safe submission, batch tracking, and status review.' }).getByRole('heading', { name: 'Payouts', exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Available payout actions')).toBeVisible();
  await expect(page.getByText('Review', { exact: true })).toBeVisible();
});
