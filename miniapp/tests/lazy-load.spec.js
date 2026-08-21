import { test, expect } from '@playwright/test';

// Basic E2E that asserts Suspense fallback is shown and a dynamic chunk is requested
test('lazy-load finance chunk and show loading fallback when navigating', async ({ page }) => {
  const loaded = [];
  page.on('response', (res) => {
    try {
      const url = res.url();
      if (/MiniAppFinanceSuite|ProviderWorkspaceFoundation|MiniAppPointsWallet|MiniAppReceiptStudio|MiniAppReceiptVault/.test(url)) {
        loaded.push(url);
      }
    } catch (e) { if (!process.env.CI) console.debug(e); }
  });

  await page.goto('/');

  const servicesLink = page.getByRole('link', { name: '10 Services', exact: true });
  await servicesLink.waitFor({ state: 'visible', timeout: 5000 });

  // hover to trigger prefetch intent
  await servicesLink.hover();

  // click to navigate
  await servicesLink.click();

  // expect loading fallback (role=status + aria-label)
  const loading = page.locator('[role="status"][aria-label="Loading Transferly content"]');
  await expect(loading).toBeVisible({ timeout: 5000 });

  // wait for at least one matching chunk request
  await page.waitForResponse((res) => /MiniAppFinanceSuite|ProviderWorkspaceFoundation|MiniAppPointsWallet/.test(res.url()), { timeout: 10000 });
  expect(loaded.length).toBeGreaterThan(0);
});
