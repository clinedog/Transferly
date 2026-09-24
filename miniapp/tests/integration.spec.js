import { expect, test } from '@playwright/test';

const routes = [
  { path: '/', name: 'root' },
  { path: '/workspace', name: 'workspace' },
  { path: '/wallet', name: 'wallet' },
  { path: '/provider/paypal', name: 'paypal' }
];

const user = {
  id: 'telegram-user',
  email: 'telegram-user@transferly.test',
  displayName: 'Telegram User',
  isAdmin: false
};

const profile = {
  id: 'telegram-user',
  name: 'Telegram User',
  is_admin: false,
  points: 750,
  wallet: {
    currencyCode: 'USD',
    availableBalanceCents: 2500,
    pendingBalanceCents: 0,
    frozenBalanceCents: 0,
    paidOutBalanceCents: 0
  }
};

const fundingPackage = {
  id: 'starter-5000',
  name: 'Starter 5,000',
  points: 5000,
  price_minor: 500000,
  currency: 'NGN',
  active: true,
  display_price: '₦5,000',
  points_value_note: '1 Transferly Point = ₦1'
};

const fundingDestination = {
  id: 'bank-primary',
  provider: 'Transferly Test Bank',
  account_name: 'TRANSFERLY CONFIGURED TEST',
  account_number: '1234567890',
  account_number_masked: '******7890',
  currency: 'NGN',
  instructions: 'Transfer exactly the amount shown and include your funding reference.',
  payment_note: 'Include your Transferly payment reference in the bank transfer narration.',
  points_value_note: '1 Transferly Point = ₦1',
  active: true,
  is_primary: true
};

const fundingRequest = {
  id: 'funding-request-1001',
  public_reference: 'TP-20260829-ABC123',
  requested_points: 5000,
  expected_amount_minor: 500000,
  currency: 'NGN',
  payment_method: 'MANUAL_BANK_TRANSFER',
  payment_reference: 'TP-20260829-ABC123',
  destination_snapshot: fundingDestination,
  status: 'PAYMENT_INSTRUCTIONS',
  risk_status: 'NORMAL',
  possible_duplicate: false,
  display_amount: '₦5,000',
  created_at: '2026-08-29T02:30:00.000Z',
  updated_at: '2026-08-29T02:30:00.000Z'
};

function telegramScript({ initData, startParam = 'dashboard' }) {
  return `
    window.Telegram = {
      WebApp: {
        version: '7.0',
        isVersionAtLeast() { return true; },
        initData: ${JSON.stringify(initData)},
        initDataUnsafe: {
          start_param: ${JSON.stringify(startParam)},
          user: { id: 9101, first_name: 'Telegram', last_name: 'User', username: 'tg_user' }
        },
        themeParams: {},
        ready() {},
        expand() {},
        setHeaderColor() {},
        setBackgroundColor() {},
        BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
        SettingsButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
        MainButton: { setText() {}, enable() {}, show() {}, hide() {}, onClick() {}, offClick() {}, hideProgress() {} },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {} }
      }
    };
  `;
}

async function installTelegramRuntime(page, options = {}) {
  const initData = options.initData || 'query_id=telegram-contract&user=%7B%22id%22%3A9101%2C%22first_name%22%3A%22Telegram%22%2C%22last_name%22%3A%22User%22%7D&auth_date=1770000000&hash=test-signature';
  await page.route('https://telegram.org/js/telegram-web-app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: telegramScript({ initData, startParam: options.startParam })
    });
  });
  return initData;
}

async function mockMiniAppApi(page, options = {}) {
  const requests = [];
  let telegramLoginAttempts = 0;
  let notificationAttempts = 0;
  let currentFundingRequest = { ...fundingRequest };
  let supportTickets = [];
  let notificationPreferences = {
    channels: { in_app: true, telegram: true, email: false, webhook: false },
    categories: { funding: true, operations: true, security: true }
  };
  const failTelegramLoginAttempts = Number(options.failTelegramLoginAttempts || 0);
  const failNotificationAttempts = Number(options.failNotificationAttempts || 0);

  await page.route(/\/api(\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const headers = request.headers();
    const requestId = headers['x-request-id'] || 'req-miniapp-integration';
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, X-Request-Id, X-Transferly-Client',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    };
    const responseHeaders = { ...corsHeaders, 'x-request-id': requestId };

    requests.push({
      path,
      method,
      headers,
      body: ['POST', 'PATCH', 'PUT'].includes(method) ? request.postDataJSON() : null
    });

    const json = (payload, status = 200, extraHeaders = {}) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { ...responseHeaders, ...extraHeaders },
      body: JSON.stringify(payload && typeof payload === 'object' && !Array.isArray(payload)
        ? { ...payload, requestId }
        : payload)
    });

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: responseHeaders, body: '' });
      return;
    }

    if (path === '/api/health/client') {
      await json({
        ok: true,
        status: 'healthy',
        contractVersion: '2026-08-client-health-v2',
        signals: { live: true, ready: true, degraded: false, unavailable: false },
        api: { available: true, mode: 'test' },
        reliability: { queueMode: 'inline', jobWaitMs: 30000, degradedReasons: [] },
        auth: { telegramMiniApp: { enabled: true, launchUrlConfigured: true, expiresInSeconds: 3600 } },
        cors: { allowedOriginCount: 1 },
        deployment: { frontendOriginConfigured: true, miniAppOriginConfigured: true },
        featureFlags: { telegramMiniApp: true, providerWorkspace: true },
        degraded: false,
        nextActions: []
      });
      return;
    }

    if (path === '/api/bootstrap') {
      await json({ platform: { platform_name: 'Transferly', brand_color: '#2aabee' }, faqs: [], testimonials: [] });
      return;
    }

    if (path === '/api/auth/telegram-mini-app') {
      telegramLoginAttempts += 1;
      if (telegramLoginAttempts <= failTelegramLoginAttempts) {
        await json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Telegram session exchange is temporarily unavailable.',
            classification: 'provider_failure',
            recovery: { action: 'retry_with_backoff', retryable: true }
          },
          classification: 'provider_failure',
          retryable: true,
          recovery: { action: 'retry_with_backoff', retryable: true }
        }, 503, { 'retry-after': '1' });
        return;
      }

      await json({ token: 'tg-session-token', user });
      return;
    }

    if (path === '/api/me') {
      await json({ user, profile, points: { balance: profile.points }, referrals: {}, receipts: [], topUpOrders: [] });
      return;
    }

    if (path === '/api/me/command-center') {
      await json({ data: { sections: [], actions: [] } });
      return;
    }

    if (path === '/api/user/me/points/funding/config') {
      await json({
        packages: [fundingPackage],
        payment_destination: fundingDestination,
        evidence_policy: {
          allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
          max_bytes: 8388608
        },
        economy: {
          points_to_naira_rate: 1,
          value_note: '1 Transferly Point = ₦1'
        }
      });
      return;
    }

    if (path === '/api/user/me/points/funding/requests') {
      await json({ data: [currentFundingRequest] });
      return;
    }

    if (path === '/api/user/me/notifications') {
      notificationAttempts += 1;
      if (notificationAttempts <= failNotificationAttempts) {
        await json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Notifications are temporarily unavailable.'
          }
        }, 503);
        return;
      }
      await json({ data: [] });
      return;
    }

    if (path === '/api/user/me/notification-preferences' && method === 'GET') {
      await json({ preferences: notificationPreferences });
      return;
    }

    if (path === '/api/user/me/notification-preferences' && method === 'PATCH') {
      notificationPreferences = {
        ...notificationPreferences,
        ...(request.postDataJSON() || {}),
        categories: {
          ...notificationPreferences.categories,
          ...(request.postDataJSON()?.categories || {})
        }
      };
      await json({ preferences: notificationPreferences });
      return;
    }

    if (path === '/api/user/me/transaction-activity') {
      await json({
        data: [{
          id: currentFundingRequest.id,
          kind: 'funding',
          reference: currentFundingRequest.public_reference,
          provider: currentFundingRequest.payment_method,
          operation: 'points funding',
          status: currentFundingRequest.status,
          amountMinor: currentFundingRequest.expected_amount_minor,
          points: currentFundingRequest.requested_points,
          currency: currentFundingRequest.currency,
          createdAt: currentFundingRequest.created_at,
          reconciliationState: 'NOT_APPLICABLE'
        }]
      });
      return;
    }

    if (path === '/api/user/me/support-tickets' && method === 'GET') {
      await json({ data: supportTickets });
      return;
    }

    if (path === '/api/user/me/support-tickets' && method === 'POST') {
      const payload = request.postDataJSON();
      const ticket = {
        id: `support-${supportTickets.length + 1}`,
        subject: payload.subject,
        category: payload.category,
        details: payload.details,
        transactionReference: payload.transactionReference,
        provider: payload.provider,
        operation: payload.operation,
        context: payload.context,
        status: 'OPEN',
        createdAt: '2026-08-29T02:30:00.000Z'
      };
      supportTickets = [ticket, ...supportTickets];
      await json({ ticket }, 201);
      return;
    }

    if (path === `/api/user/me/points/funding/requests/${fundingRequest.id}/evidence/upload` && method === 'POST') {
      currentFundingRequest = {
        ...currentFundingRequest,
        status: 'PAYMENT_REPORTED',
        submitted_at: '2026-08-29T02:35:00.000Z',
        evidence: {
          file_id: 'uploaded-evidence-hash',
          download_url: `/api/user/me/points/funding/requests/${fundingRequest.id}/evidence`,
          metadata: {
            original_name: request.postDataJSON()?.fileName || 'payment-proof.png',
            mime_type: request.postDataJSON()?.mimeType || 'image/png',
            size_bytes: 16,
            sha256: 'b'.repeat(64)
          }
        }
      };
      await json({ funding_request: currentFundingRequest });
      return;
    }

    await json({ data: [] });
  });

  return { requests };
}

test('telegram auth exchanges init data without global raw init-data headers or role claims', async ({ page }) => {
  const initData = await installTelegramRuntime(page, { startParam: 'wallet' });
  const api = await mockMiniAppApi(page);

  await page.goto('/miniapp#tgWebAppStartParam=wallet');

  await expect.poll(() => api.requests.some((entry) => entry.path === '/api/auth/telegram-mini-app')).toBe(true);
  const login = api.requests.find((entry) => entry.path === '/api/auth/telegram-mini-app');
  expect(login.body).toEqual({ initData, startParam: 'wallet' });
  expect(login.body).not.toHaveProperty('userId');
  expect(login.body).not.toHaveProperty('role');
  expect(login.body).not.toHaveProperty('isAdmin');
  expect(login.body).not.toHaveProperty('permissions');

  for (const request of api.requests.filter((entry) => entry.method !== 'OPTIONS')) {
    expect(request.headers['x-request-id'], request.path).toBeTruthy();
    expect(request.headers['x-transferly-client'], request.path).toBe('telegram-miniapp');
    expect(request.headers['x-telegram-init-data'], request.path).toBeUndefined();
    expect(request.headers['x-telegram-start-param'], request.path).toBeUndefined();
  }

  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('transferly_api_session'))).toBe('tg-session-token');
  const meRequest = api.requests.find((entry) => entry.path === '/api/me');
  expect(meRequest.headers.authorization).toBe('Bearer tg-session-token');
  await expect(page.getByText('Telegram session secured').last()).toBeVisible();
});

test('telegram auth recovery retries temporary failures and deduplicates recovery UI', async ({ page }) => {
  await installTelegramRuntime(page, { startParam: 'dashboard' });
  const api = await mockMiniAppApi(page, { failTelegramLoginAttempts: 1 });

  await page.goto('/miniapp#tgWebAppStartParam=dashboard');

  await expect(page.getByText(/Telegram session needs a retry|Transferly connection needs a retry/)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
  await page.getByRole('button', { name: 'Try Again' }).click();

  await expect.poll(() => api.requests.filter((entry) => entry.path === '/api/auth/telegram-mini-app').length).toBeGreaterThan(1);
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('transferly_api_session'))).toBe('tg-session-token');
  await expect(page.getByText('Telegram session secured').last()).toBeVisible();
});

test('notifications show an actionable unavailable state and retry instead of a false empty inbox', async ({ page }) => {
  await installTelegramRuntime(page, { startParam: 'notifications' });
  // App bootstrap preloads notifications before the workspace mounts; fail both
  // that request and the first workspace request so the retry UI is exercised.
  const api = await mockMiniAppApi(page, { failNotificationAttempts: 2 });

  await page.goto('/miniapp/notifications#tgWebAppStartParam=notifications');

  await expect(page.getByRole('heading', { name: 'Notifications are unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => api.requests.filter((entry) => entry.path === '/api/user/me/notifications').length).toBeGreaterThan(1);
  await expect(page.getByRole('heading', { name: 'Notifications are unavailable' })).toHaveCount(0);
  await expect(page.getByText('No notifications yet')).toBeVisible();
});

test('support submits a persisted ticket with transaction context', async ({ page }) => {
  await installTelegramRuntime(page, { startParam: 'support' });
  const api = await mockMiniAppApi(page);

  await page.goto('/miniapp/support?from=vault&transaction=TRX-1001&provider=transferly&operation=wallet%20record&status=PROCESSING#tgWebAppStartParam=support');

  await page.getByLabel('Support issue details').fill('Please verify this pending wallet record.');
  await page.getByRole('button', { name: 'Submit support request' }).click();

  await expect.poll(() => api.requests.find((entry) => entry.path === '/api/user/me/support-tickets' && entry.method === 'POST')?.body).toMatchObject({
    category: 'transaction_review',
    transactionReference: 'TRX-1001',
    provider: 'transferly',
    operation: 'wallet record',
    context: { source: 'vault', status: 'PROCESSING' }
  });
  await expect(page.getByText('Support request submitted')).toBeVisible();
  await expect(page.getByText(/Reference: TRX-1001/)).toBeVisible();
});

test('settings persist account notification category preferences', async ({ page }) => {
  await installTelegramRuntime(page, { startParam: 'settings' });
  const api = await mockMiniAppApi(page);

  await page.goto('/miniapp/settings#tgWebAppStartParam=settings');
  const fundingToggle = page.getByRole('switch', { name: 'Funding and points' });
  await expect(fundingToggle).toBeVisible();
  await fundingToggle.click();

  await expect.poll(() => api.requests.find((entry) => entry.path === '/api/user/me/notification-preferences' && entry.method === 'PATCH')?.body).toMatchObject({
    categories: { funding: false }
  });
});

test('mini app wallet shows backend-backed funding status center and safe evidence copy', async ({ page }) => {
  await installTelegramRuntime(page, { startParam: 'wallet' });
  const api = await mockMiniAppApi(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/miniapp/wallet#tgWebAppStartParam=wallet');

  await expect.poll(() => api.requests.some((entry) => entry.path === '/api/user/me/points/funding/config')).toBe(true);
  await expect.poll(() => api.requests.some((entry) => entry.path === '/api/user/me/points/funding/requests')).toBe(true);

  await expect(page.getByRole('heading', { name: 'Track verification' })).toBeVisible();
  await expect(page.getByText('Screenshot submission alone never changes your balance.')).toBeVisible();
  await expect(page.getByText('Evidence policy')).toBeVisible();
  await expect(page.getByText('JPEG, PNG, WEBP, PDF up to 8MB')).toBeVisible();
  await expect(page.getByText('TP-20260829-ABC123', { exact: true })).toBeVisible();
  await expect(page.getByText('₦5,000').first()).toBeVisible();
  await expect(page.getByText('Payment instructions')).toBeVisible();
  await expect(page.getByText('Request created')).toBeVisible();
  await expect(page.getByRole('button', { name: /copy reference/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /support handoff/i })).toHaveAttribute('href', '/miniapp/support');
  await expect(page.getByRole('button', { name: /upload evidence/i })).toBeDisabled();

  const bottomNavigation = page.getByTestId('miniapp-bottom-navigation');
  await expect(bottomNavigation.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/miniapp');
  await expect(bottomNavigation.getByRole('link', { name: /services/i })).toHaveAttribute('href', '/miniapp/services');
  await expect(bottomNavigation.getByRole('link', { name: /orders/i })).toHaveAttribute('href', '/miniapp/orders');
  await expect(bottomNavigation.getByRole('link', { name: /wallet/i })).toHaveAttribute('href', '/miniapp/wallet');
  await expect(bottomNavigation.getByRole('link', { name: /account/i })).toHaveAttribute('href', '/miniapp/profile');
});

test('non-PayPal providers remain informational Coming Soon entries', async ({ page }) => {
  await installTelegramRuntime(page, { startParam: 'services' });
  const api = await mockMiniAppApi(page);

  await page.goto('/miniapp/services/stripe/overview#tgWebAppStartParam=services');

  await expect(page.getByText('Coming Soon').first()).toBeVisible();
  await expect(page.getByText(/cannot call provider APIs, create orders, or charge points/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Coming Soon' })).toBeDisabled();
  await expect.poll(() => api.requests.some((entry) => entry.path.startsWith('/api/providers/stripe'))).toBe(false);
});

for (const { path, name } of routes) {
  test(`a11y: fix color-contrast (${name})`, async ({ page, baseURL }) => {
    const url = (baseURL || 'http://localhost:3000') + path;
    await page.goto(url, { waitUntil: 'networkidle' });

    let AxeBuilder;
    try {
      const mod = await import('@axe-core/playwright');
      AxeBuilder = mod.default || mod;
    } catch {
      console.warn('Accessibility helper @axe-core/playwright not available; skipping deep a11y analysis.');
      return;
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag21aa'])
      .analyze();

    const contrastViolations = results.violations.filter((violation) => violation.id === 'color-contrast');
    expect(contrastViolations.length).toBe(0);
  });
}
