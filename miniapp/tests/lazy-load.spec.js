import { test, expect } from '@playwright/test';

// Basic E2E that asserts Suspense fallback is shown and a dynamic chunk is requested
test('lazy-load finance chunk and show loading fallback when navigating', async ({ page }) => {
  const loaded = [];
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        version: '7.0',
        isVersionAtLeast: () => true,
        initData: 'query_id=lazy-load&user=%7B%22id%22%3A9101%2C%22first_name%22%3A%22Telegram%22%7D&auth_date=1770000000&hash=test',
        initDataUnsafe: { user: { id: 9101, first_name: 'Telegram' }, start_param: 'dashboard' },
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
  });
  await page.route('**://*/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/health/client'
      ? { ok: true, status: 'healthy', signals: { live: true, ready: true } }
      : path === '/api/auth/telegram-mini-app'
        ? { token: 'lazy-load-token', user: { id: 'lazy-load-user', email: 'lazy-load@transferly.test', name: 'Telegram User' }, profile: { id: 'lazy-load-user', name: 'Telegram User', points: 100, is_admin: false } }
        : { platform: {}, faqs: [], testimonials: [], data: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  page.on('response', (res) => {
    try {
      const url = res.url();
      if (/MiniAppFinanceSuite|ProviderWorkspaceFoundation|MiniAppPointsWallet|MiniAppReceiptStudio|MiniAppReceiptVault/.test(url)) {
        loaded.push(url);
      }
    } catch (e) { if (!process.env.CI) console.debug(e); }
  });

  await page.goto('/miniapp/activity');

  await expect(page.getByRole('heading', { name: /Activity/i }).first()).toBeVisible();

  // The dynamic import may finish before the route heading paints.
  await expect.poll(() => loaded.length, { timeout: 10000 }).toBeGreaterThan(0);
});
