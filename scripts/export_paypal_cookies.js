/**
 * Utility script to log in to PayPal sandbox via Playwright and export the session cookies.
 * The cookies are saved in Netscape cookie format which HTTrack can consume with the
 * `--cookies` option.
 *
 * WARNING: This script contains plaintext credentials for a sandbox account. It is intended
 * for temporary local use only and MUST NOT be committed to version control.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Credentials – replace with environment variables in a real workflow.
const PAYPAL_URL = 'https://sandbox.paypal.com';
const EMAIL = 'sb-service@business.paypal.com';
const PASSWORD = '>i5d.2ZO';

// Output cookie file (Netscape format) for HTTrack consumption.
const COOKIE_FILE = path.resolve(__dirname, '..', 'httrack_cookies.txt');

/** Convert Playwright cookies to Netscape format. */
function formatNetscape(cookies) {
  const lines = [];
  // Header line required by HTTrack
  lines.push('# Netscape HTTP Cookie File');
  // Domain, Include subdomains, Path, Secure, Expiration, Name, Value
  for (const c of cookies) {
    const domain = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
    const includeSubdomains = c.domain.startsWith('.') ? 'TRUE' : 'TRUE'; // always true for PayPal
    const path = c.path;
    const secure = c.secure ? 'TRUE' : 'FALSE';
    const expiration = Math.floor(c.expires / 1000) || 0;
    const name = c.name;
    const value = c.value;
    lines.push([domain, includeSubdomains, path, secure, expiration, name, value].join('\t'));
  }
  return lines.join('\n');
}

(async () => {
  // Launch Playwright's bundled Chromium. Control headless mode via the
  // PLAYWRIGHT_HEADLESS env var (default true). If you need a specific
  // executable (e.g., custom Chromium build), set PLAYWRIGHT_CHROMIUM_PATH.
  const launchOpts = {
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    // Spoof a common desktop user‑agent to avoid PayPal’s headless‑browser detection.
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  };
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔎 Navigating directly to PayPal sign‑in page...');
    // Using the explicit sign‑in URL makes the flow deterministic and avoids
    // the landing‑page “log in” button that sometimes changes.
    await page.goto(`${PAYPAL_URL}/signin`, { waitUntil: 'load' });

    // Selectors that cover the two historic attribute names PayPal has used.
    const emailSel = 'input#email, input[name="login_email"]';
    const pwdSel   = 'input#password, input[name="login_password"]';
    console.log('⏳ Waiting for email field (up to 45 s)…');
    await page.waitForSelector(emailSel, { timeout: 45000 });
    await page.fill(emailSel, EMAIL);
    console.log('✉️ Email entered');

    // Some PayPal flows show a “Next” button after the email is entered.
    const nextSel = 'button#btnNext, button[data-testid="btnNext"]';
    const nextBtn = await page.$(nextSel);
    if (nextBtn) {
      console.log('🔘 Clicking Next after email');
      await nextBtn.click();
    }

    console.log('⏳ Waiting for password field (up to 45 s)…');
    // The password input may be hidden by default (e.g., after a captcha).
    // Use force:true to fill even if it is not visible.
    await page.waitForSelector(pwdSel, { timeout: 45000 });
    await page.fill(pwdSel, PASSWORD, { force: true });
    console.log('🔑 Password entered');

    // -----------------------------------------------------------------
    // 3️⃣  Click the login button (or submit via Enter key)
    // -----------------------------------------------------------------
    const loginSel = 'button#btnLogin, button[data-testid="btnLogin"]';
    // Press Enter to submit the form – this works whether or not the login
    // button is visible.  No waiting for the button selector is needed.
    console.log('⌨️ Pressing Enter to submit login form');
    await page.keyboard.press('Enter');

    // Give PayPal a moment to set cookies after the POST.
    console.log('⏳ Waiting 8 seconds for cookies to be written...');
    await page.waitForTimeout(8000);
    // Click the login button; if the button is not immediately visible we wait
    // for it to appear.
    await page.waitForSelector(loginSel, { timeout: 15000 });
    await page.click(loginSel);

    // Give the server a moment to set cookies and possibly land on the dashboard.
    console.log('⏳ Waiting for post‑login navigation (up to 30 s)…');
    try {
      await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 });
    } catch (_) {
      console.warn('⚠️ Navigation timeout – continuing to collect cookies anyway');
    }

    // ---------------------------------------------------------------------
    // 4️⃣  Export the Netscape‑format cookie file (only the PayPal domain)
    // ---------------------------------------------------------------------
    const allCookies = await context.cookies();
    const netscape = formatNetscape(allCookies.filter(c => c.domain.includes('paypal.com')));
    fs.writeFileSync(COOKIE_FILE, netscape, { encoding: 'utf8' });
    console.log('✅ Cookies exported to', COOKIE_FILE);
  } catch (err) {
    console.error('❌ Error during login/cookie export:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
