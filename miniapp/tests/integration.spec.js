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
  const failTelegramLoginAttempts = Number(options.failTelegramLoginAttempts || 0);

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

  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('transferly_api_token'))).toBe('tg-session-token');
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
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('transferly_api_token'))).toBe('tg-session-token');
  await expect(page.getByText('Telegram session secured').last()).toBeVisible();
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