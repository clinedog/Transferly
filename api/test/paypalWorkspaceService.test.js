const assert = require('node:assert/strict');
const { before, test } = require('node:test');

process.env.SQLITE_DATABASE_PATH ||= './data/paypal-workspace-service-test.sqlite';
process.env.REDIS_URL ||= 'redis://127.0.0.1:6379/15';
process.env.PAYPAL_ENVIRONMENT ||= 'sandbox';
process.env.PAYPAL_CLIENT_ID ||= 'paypal-client-id';
process.env.PAYPAL_CLIENT_SECRET ||= 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID ||= 'paypal-webhook-id';

const { migrate } = require('../db/migrate');
const { paypalWorkspaceService } = require('../services/paypalWorkspaceService');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => String(name || '').toLowerCase() === 'content-type' ? 'application/json' : null
    },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

async function withMockedFetch(handler, assertion) {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return handler(String(url), options, calls);
  };

  try {
    await assertion(calls);
  } finally {
    global.fetch = originalFetch;
  }
}

before(async () => {
  await migrate();
});

test('PayPal overview returns a sanitized Transferly workspace envelope', async () => {
  const payload = await paypalWorkspaceService.getPayPalWorkspaceResource({
    provider: 'paypal',
    resource: 'overview',
    requestId: 'paypal-overview-test',
    userId: 'user-paypal-workspace-test'
  });

  assert.equal(payload.provider, 'paypal');
  assert.equal(payload.operation, 'paypal.overview');
  assert.equal(payload.metadata.secret_values_exposed, false);
  assert.equal(payload.data.identity.slug, 'paypal');
  assert.ok(payload.data.resources.some((resource) => resource.resource === 'payments'));
  assert.ok(payload.data.resources.some((resource) => resource.resource === 'currency-exchange'));
  assert.equal(JSON.stringify(payload).includes('paypal-client-secret'), false);
});

test('prepared PayPal resources return setup guidance instead of raw provider errors', async () => {
  const payload = await paypalWorkspaceService.getPayPalWorkspaceResource({
    provider: 'paypal',
    resource: 'payments',
    requestId: 'paypal-payments-test'
  });

  assert.equal(payload.operation, 'paypal.payments.list');
  assert.equal(payload.data.setup_state, 'prepared');
  assert.equal(payload.data.unsupported_actions_return_setup_messages, true);
  assert.ok(payload.data.detail.capability_checks.includes('refunds'));
  assert.equal(payload.metadata.secret_values_exposed, false);
  assert.equal(JSON.stringify(payload).includes('paypal-client-secret'), false);
});

test('transaction search foundation preserves Transferly ledger source-of-truth wording', async () => {
  const payload = await paypalWorkspaceService.getPayPalWorkspaceResource({
    provider: 'paypal',
    resource: 'transactions',
    requestId: 'paypal-transactions-test',
    query: {
      limit: 5
    }
  });

  assert.equal(payload.operation, 'paypal.transactions.search');
  assert.equal(payload.data.detail.paypal_search_enabled, false);
  assert.match(payload.data.source_of_truth.transferly_ledger, /source of truth/i);
  assert.equal(payload.pagination.limit, 5);
});

test('PayPal transaction search returns sanitized provider-native records', async () => {
  await withMockedFetch((url) => {
    if (url.includes('/v1/oauth2/token')) {
      return jsonResponse({ access_token: 'paypal-test-access-token', expires_in: 3600 });
    }
    if (url.includes('/v1/reporting/transactions')) {
      assert.match(url, /start_date=/);
      assert.match(url, /end_date=/);
      assert.match(url, /fields=all/);
      return jsonResponse({
        page: 1,
        total_pages: 1,
        total_items: 1,
        transaction_details: [{
          transaction_info: {
            transaction_id: 'TXN-123',
            transaction_status: 'COMPLETED',
            transaction_event_code: 'T0006',
            transaction_amount: { value: '42.00', currency_code: 'USD' },
            fee_amount: { value: '1.20', currency_code: 'USD' },
            transaction_initiation_date: '2026-06-10T12:00:00Z',
            transaction_updated_date: '2026-06-10T12:05:00Z'
          },
          payer_info: {
            email_address: 'buyer@example.com',
            account_id: 'PAYER-123'
          },
          cart_info: {
            invoice_number: 'INV-123'
          }
        }]
      });
    }
    return jsonResponse({ name: 'UNEXPECTED_REQUEST' }, 500);
  }, async () => {
    const payload = await paypalWorkspaceService.getPayPalWorkspaceResource({
      provider: 'paypal',
      resource: 'transactions',
      requestId: 'paypal-live-transactions-test',
      query: {
        source: 'paypal',
        dateFrom: '2026-06-01T00:00:00Z',
        dateTo: '2026-06-30T23:59:59Z',
        limit: 2
      }
    });

    assert.equal(payload.operation, 'paypal.transactions.search');
    assert.equal(payload.status, 'live');
    assert.equal(payload.data.detail.paypal_search_enabled, true);
    assert.equal(payload.data.records[0].id, 'TXN-123');
    assert.equal(payload.data.records[0].status, 'settled');
    assert.equal(payload.data.records[0].source, 'paypal_transaction_search');
    assert.equal(payload.data.records[0].source_of_truth, 'provider-state-for-reconciliation-only');
    assert.equal(JSON.stringify(payload).includes('paypal-test-access-token'), false);
  });
});

test('PayPal transaction search rejects ranges over 31 days without calling provider search', async () => {
  await withMockedFetch((url) => {
    if (url.includes('/v1/reporting/transactions')) {
      throw new Error('transaction search should not be called for an invalid range');
    }
    return jsonResponse({ access_token: 'paypal-test-access-token', expires_in: 3600 });
  }, async () => {
    const payload = await paypalWorkspaceService.getPayPalWorkspaceResource({
      provider: 'paypal',
      resource: 'transactions',
      requestId: 'paypal-transactions-range-test',
      query: {
        source: 'paypal',
        dateFrom: '2026-06-01T00:00:00Z',
        dateTo: '2026-07-15T00:00:00Z'
      }
    });

    assert.equal(payload.data.detail.provider_error.code, 'PAYPAL_TRANSACTION_RANGE_TOO_LARGE');
    assert.equal(payload.data.detail.provider_error.raw_provider_error_exposed, false);
    assert.match(payload.next_actions[0].detail, /31-day/i);
  });
});

test('PayPal order lookup returns sanitized order detail without enabling capture', async () => {
  await withMockedFetch((url) => {
    if (url.includes('/v1/oauth2/token')) {
      return jsonResponse({ access_token: 'paypal-test-access-token', expires_in: 3600 });
    }
    if (url.includes('/v2/checkout/orders/ORDER-123')) {
      return jsonResponse({
        id: 'ORDER-123',
        status: 'COMPLETED',
        intent: 'CAPTURE',
        create_time: '2026-06-11T10:00:00Z',
        update_time: '2026-06-11T10:02:00Z',
        payer: {
          email_address: 'buyer@example.com',
          payer_id: 'PAYER-123',
          address: { country_code: 'US' }
        },
        purchase_units: [{
          invoice_id: 'INV-123',
          amount: { value: '42.00', currency_code: 'USD' }
        }],
        links: [{ rel: 'approve', href: 'https://www.paypal.com/checkoutnow?token=ORDER-123' }]
      });
    }
    return jsonResponse({ name: 'UNEXPECTED_REQUEST' }, 500);
  }, async () => {
    const payload = await paypalWorkspaceService.getPayPalWorkspaceResource({
      provider: 'paypal',
      resource: 'orders',
      requestId: 'paypal-order-lookup-test',
      query: {
        orderId: 'ORDER-123'
      }
    });

    assert.equal(payload.operation, 'paypal.orders.list');
    assert.equal(payload.status, 'live');
    assert.equal(payload.data.records[0].id, 'ORDER-123');
    assert.equal(payload.data.records[0].status, 'settled');
    assert.equal(payload.data.detail.order_lookup_enabled, true);
    assert.equal(payload.data.detail.capture_order_enabled, false);
    assert.equal(payload.data.records[0].raw_payload_exposed, false);
    assert.equal(JSON.stringify(payload).includes('paypal-test-access-token'), false);
  });
});

test('PayPal API failures return clean resource errors', async () => {
  await withMockedFetch((url) => {
    if (url.includes('/v1/reporting/transactions')) {
      return jsonResponse({ name: 'PERMISSION_DENIED', debug_id: 'debug-secret' }, 403);
    }
    return jsonResponse({ access_token: 'paypal-test-access-token', expires_in: 3600 });
  }, async () => {
    const payload = await paypalWorkspaceService.getPayPalWorkspaceResource({
      provider: 'paypal',
      resource: 'transactions',
      requestId: 'paypal-transactions-error-test',
      query: {
        source: 'paypal',
        dateFrom: '2026-06-01T00:00:00Z',
        dateTo: '2026-06-30T23:59:59Z'
      }
    });

    assert.equal(payload.data.detail.provider_error.raw_provider_error_exposed, false);
    assert.match(payload.data.detail.provider_error.message, /unavailable/i);
    assert.equal(JSON.stringify(payload).includes('debug-secret'), false);
  });
});

test('webhook and settings resources expose only readiness metadata', async () => {
  const webhooks = await paypalWorkspaceService.getPayPalWorkspaceResource({
    provider: 'paypal',
    resource: 'webhooks',
    requestId: 'paypal-webhooks-test'
  });
  const settings = await paypalWorkspaceService.getPayPalWorkspaceResource({
    provider: 'paypal',
    resource: 'settings',
    requestId: 'paypal-settings-test'
  });

  assert.equal(webhooks.data.raw_payloads_exposed, false);
  assert.equal(webhooks.data.configured_webhook_id_present, true);
  assert.ok(Array.isArray(webhooks.data.event_groups));
  assert.equal(settings.data.webhook_secret_status, 'not-exposed');
  assert.equal(settings.data.secret_values_exposed, false);
  assert.ok(settings.data.readiness_by_environment.some((entry) => entry.environment === 'sandbox'));
  assert.ok(settings.data.readiness_by_environment.some((entry) => entry.environment === 'live'));
  assert.equal(JSON.stringify(settings).includes('paypal-client-secret'), false);
});

test('PayPal disputes resource returns read-only operations metadata', async () => {
  const disputes = await paypalWorkspaceService.getPayPalWorkspaceResource({
    provider: 'paypal',
    resource: 'disputes',
    requestId: 'paypal-disputes-test'
  });

  assert.equal(disputes.operation, 'paypal.disputes.list');
  assert.equal(disputes.data.detail.read_only, true);
  assert.ok(disputes.data.detail.action_gates.includes('provide evidence'));
  assert.match(disputes.next_actions[0].detail, /read-only dispute status/i);
  assert.equal(JSON.stringify(disputes).includes('paypal-client-secret'), false);
});

test('PayPal workspace resources reject non-PayPal providers', async () => {
  await assert.rejects(
    () => paypalWorkspaceService.getPayPalWorkspaceResource({
      provider: 'stripe',
      resource: 'payments',
      requestId: 'paypal-provider-reject-test'
    }),
    /This provider resource is only available for PayPal/
  );
});
