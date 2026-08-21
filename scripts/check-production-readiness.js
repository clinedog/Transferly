const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const checks = [];

function addCheck(name, pass, detail, level = 'fail') {
  checks.push({ name, pass, detail, level });
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
}

function readPackage(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function hasScript(packageJson, name) {
  return Boolean(packageJson.scripts?.[name]);
}

function envExampleHas(relativePath, key) {
  const text = readText(relativePath);
  return new RegExp(`^${key}=`, 'm').test(text);
}

function ecosystemAppNames(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  // PM2 ecosystem files are local project config, so requiring them is enough for a static shape check.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const ecosystem = require(absolutePath);
  return Array.isArray(ecosystem.apps) ? ecosystem.apps.map((app) => app.name).filter(Boolean) : [];
}

function loadProviderContract() {
  const relativePath = 'shared/providerWorkspaceContract.js';
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  try {
    // Static release checks load the shared CommonJS contract without contacting provider APIs.
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(absolutePath);
  } catch (error) {
    return { error };
  }
}

const rootPackage = readPackage('package.json');
const apiPackage = readPackage('api/package.json');
const botPackage = readPackage('bot/package.json');
const miniappPackage = readPackage('miniapp/package.json');
const apiApps = ecosystemAppNames('api/ecosystem.config.js');
const botApps = ecosystemAppNames('bot/ecosystem.config.js');
const providerContract = loadProviderContract();
const providerWorkspaces = providerContract?.listProviderWorkspaces?.() || [];
const expectedProviders = ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto'];
const allowedProviderStatuses = ['live', 'preview', 'setup', 'unsupported', 'disabled', 'needs-env', 'needs-webhook', 'sandbox-ready'];

addCheck('api ecosystem config exists', fileExists('api/ecosystem.config.js'));
addCheck('bot ecosystem config exists', fileExists('bot/ecosystem.config.js'));
addCheck('api ecosystem includes API process', apiApps.includes('transferly-api'));
addCheck('api ecosystem includes worker process', apiApps.includes('transferly-api-worker'));
addCheck('bot ecosystem includes bot process', botApps.includes('transferly-bot'));
addCheck('api env example exists', fileExists('api/.env.example'));
addCheck('bot env example exists', fileExists('bot/.env.example'));
addCheck('miniapp env example exists', fileExists('miniapp/.env.example'));
[
  'APP_BASE_URL',
  'FRONTEND_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ADMIN_API_TOKEN',
  'BOT_API_HMAC_SECRET',
  'BOT_API_HMAC_REPLAY_STORE',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_MINI_APP_URL',
  'GENERATED_ASSET_DOWNLOAD_TTL_SECONDS',
  'CORS_ALLOWED_ORIGINS'
].forEach((key) => {
  addCheck(`api env example documents ${key}`, envExampleHas('api/.env.example', key));
});
[
  'ADMIN_TELEGRAM_ID',
  'ADMIN_TELEGRAM_USERNAME',
  'BOT_TOKEN',
  'API_URL',
  'MINI_APP_URL',
  'ADMIN_API_TOKEN',
  'API_HMAC_SECRET',
  'BOT_UPDATE_MODE',
  'BOT_WEBHOOK_URL',
  'BOT_WEBHOOK_SECRET',
  'BOT_PORT'
].forEach((key) => {
  addCheck(`bot env example documents ${key}`, envExampleHas('bot/.env.example', key));
});
addCheck('miniapp build script exists', hasScript(miniappPackage, 'build'));
addCheck('miniapp env example documents VITE_API_BASE_URL', envExampleHas('miniapp/.env.example', 'VITE_API_BASE_URL'));
addCheck('api test script exists', hasScript(apiPackage, 'test'));
addCheck('bot test script exists', hasScript(botPackage, 'test'));
addCheck('workspace verify script exists', hasScript(rootPackage, 'verify'));
addCheck('workspace production check script exists', hasScript(rootPackage, 'check:production'));
addCheck('workspace release verification script exists', hasScript(rootPackage, 'verify:release'));
addCheck('workspace staging verification script exists', hasScript(rootPackage, 'verify:staging'));
addCheck('workspace Mini App bundle budget script exists', hasScript(rootPackage, 'check:miniapp:bundle'));
addCheck('workspace secret scan script exists', hasScript(rootPackage, 'scan:secrets'));
addCheck('staging verification script exists', fileExists('scripts/verify-staging.js'));
addCheck('Mini App bundle budget script exists', fileExists('scripts/check-miniapp-bundle-budget.js'));
addCheck('secret scan script exists', fileExists('scripts/scan-secrets.js'));
addCheck(
  'release verification includes production readiness',
  rootPackage.scripts?.['verify:release']?.includes('npm run check:production'),
  'verify:release should keep the production readiness gate.'
);
addCheck(
  'release verification includes staging readiness',
  rootPackage.scripts?.['verify:release']?.includes('npm run verify:staging'),
  'verify:release should keep staging configuration checks visible.'
);
addCheck(
  'release verification includes Mini App bundle budget',
  rootPackage.scripts?.['verify:release']?.includes('npm run check:miniapp:bundle'),
  'verify:release should fail when production bundles drift beyond budget.'
);
addCheck(
  'release verification includes secret scan',
  rootPackage.scripts?.['verify:release']?.includes('npm run scan:secrets'),
  'verify:release should scan for high-confidence committed secrets.'
);
addCheck('api client health route exists', readText('api/start/kernel.js').includes('/api/health/client'));
addCheck('miniapp client health helper exists', readText('miniapp/src/lib/api.js').includes('getClientHealth'));
addCheck('miniapp runtime diagnostics exist', readText('miniapp/src/context/MiniAppRuntimeContext.jsx').includes('diagnostics'));
addCheck('shared provider workspace contract exists', fileExists('shared/providerWorkspaceContract.js'));
addCheck('bot provider workspace compatibility module exists', fileExists('bot/utils/providerWorkspaces.js'));
addCheck('bot provider miniapp parity test exists', fileExists('bot/tests/providerMiniappParity.test.js'));
addCheck('miniapp provider manifest exists', fileExists('miniapp/src/lib/providerManifests.js'));
addCheck('miniapp provider workspace shell exists', fileExists('miniapp/src/components/ProviderWorkspaceShell.jsx'));
addCheck('miniapp provider workspace foundation exists', fileExists('miniapp/src/components/ProviderWorkspaceFoundation.jsx'));
addCheck(
  'provider workspace contract loads',
  Boolean(providerContract && !providerContract.error),
  providerContract?.error?.message
);
addCheck(
  'provider workspace contract includes expected providers',
  expectedProviders.every((slug) => providerWorkspaces.some((workspace) => workspace.slug === slug)),
  `Expected: ${expectedProviders.join(', ')}`
);
addCheck(
  'provider workspace lanes define mini app routes',
  providerWorkspaces.every((workspace) => (
    Array.isArray(workspace.lanes) &&
    workspace.lanes.every((lane) => String(lane.miniAppSection || '').startsWith(`services/${workspace.slug}/`))
  )),
  'Every provider lane should deep link into /miniapp/services/:slug/:lane'
);
addCheck(
  'provider workspace statuses use explicit release labels',
  providerWorkspaces.every((workspace) => (
    allowedProviderStatuses.includes(workspace.status) &&
    Array.isArray(workspace.lanes) &&
    workspace.lanes.every((lane) => allowedProviderStatuses.includes(lane.status))
  )),
  `Allowed statuses: ${allowedProviderStatuses.join(', ')}`
);
addCheck(
  'provider workspace live lanes expose an action or route',
  providerWorkspaces.every((workspace) => (
    Array.isArray(workspace.lanes) &&
    workspace.lanes.every((lane) => lane.status !== 'live' || lane.botAction || lane.miniAppSection)
  )),
  'Live lanes should have a bot action, Mini App route, or both.'
);

if (process.env.NODE_ENV === 'production') {
  [
    'APP_BASE_URL',
    'FRONTEND_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'ADMIN_API_TOKEN',
    'BOT_API_HMAC_SECRET',
    'TELEGRAM_WEBHOOK_SECRET',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_MINI_APP_URL',
    'CORS_ALLOWED_ORIGINS'
  ].forEach((key) => {
    addCheck(`production env ${key}`, Boolean(process.env[key]), `${key} must be set before deployment`);
  });

  addCheck(
    'production bot API HMAC is required',
    process.env.BOT_API_HMAC_REQUIRED === 'true',
    'Set BOT_API_HMAC_REQUIRED=true so bot/admin service requests require HMAC signatures.'
  );

  addCheck(
    'production bot API HMAC replay store uses Redis',
    (process.env.BOT_API_HMAC_REPLAY_STORE || 'redis') === 'redis',
    'Set BOT_API_HMAC_REPLAY_STORE=redis so bot-to-API request signatures cannot be replayed across API instances.'
  );

  addCheck(
    'production inline queue mode disabled',
    process.env.INLINE_QUEUE_MODE !== 'true',
    'INLINE_QUEUE_MODE must not be enabled for production workers.'
  );

  addCheck(
    'production PayPal environment',
    process.env.PAYPAL_ENVIRONMENT === 'production',
    'Set PAYPAL_ENVIRONMENT=production before real-money usage.'
  );

  addCheck(
    'production miniapp API URL',
    Boolean(process.env.VITE_API_BASE_URL),
    'VITE_API_BASE_URL must be set in the Mini App hosting environment before building.'
  );
  if (process.env.VITE_API_BASE_URL) {
    addCheck(
      'production miniapp API URL uses TLS',
      /^https:\/\//.test(process.env.VITE_API_BASE_URL),
      'Use an HTTPS API URL for Telegram Mini App production builds.'
    );
  }

  [
    'ADMIN_TELEGRAM_ID',
    'ADMIN_TELEGRAM_USERNAME',
    'API_URL',
    'BOT_TOKEN',
    'ADMIN_API_TOKEN',
    'API_HMAC_SECRET'
  ].forEach((key) => {
    addCheck(`production bot env ${key}`, Boolean(process.env[key]), `${key} must be set before bot deployment`);
  });

  const botUpdateMode = String(process.env.BOT_UPDATE_MODE || 'polling').toLowerCase();
  addCheck(
    'production bot update mode is explicit',
    Boolean(process.env.BOT_UPDATE_MODE),
    'Set BOT_UPDATE_MODE=webhook for EC2/webhook deployment or polling for a single controlled worker.',
    'warn'
  );
  addCheck(
    'production bot webhook mode enabled',
    botUpdateMode === 'webhook',
    'Webhook mode is recommended for production reliability; polling should only run as one controlled process.',
    'warn'
  );
  if (botUpdateMode === 'webhook') {
    addCheck('production bot webhook URL', Boolean(process.env.BOT_WEBHOOK_URL), 'BOT_WEBHOOK_URL is required in webhook mode');
    addCheck(
      'production bot webhook secret',
      Boolean(process.env.BOT_WEBHOOK_SECRET),
      'BOT_WEBHOOK_SECRET should be set so Telegram webhook requests are authenticated'
    );
    addCheck('production bot port', Boolean(process.env.BOT_PORT || process.env.PORT), 'BOT_PORT or PORT is required in webhook mode');
  }

  if (process.env.API_URL) {
    addCheck(
      'production API_URL uses TLS or local loopback',
      /^https:\/\//.test(process.env.API_URL) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(process.env.API_URL),
      'Use HTTPS for remote API_URL values; local loopback is acceptable behind a reverse proxy.',
      'warn'
    );
  }
} else {
  addCheck('production env validation mode', true, 'Set NODE_ENV=production to validate required deployment variables.');
}

const failed = checks.filter((check) => !check.pass && check.level !== 'warn');
const warnings = checks.filter((check) => !check.pass && check.level === 'warn');

checks.forEach((check) => {
  const marker = check.pass ? 'OK' : check.level === 'warn' ? 'WARN' : 'FAIL';
  const detail = check.detail ? ` - ${check.detail}` : '';
  console.log(`${marker} ${check.name}${detail}`);
});

if (warnings.length > 0) {
  console.error(`Production readiness warnings: ${warnings.length} check(s) should be reviewed.`);
}

if (failed.length > 0) {
  console.error(`Production readiness failed: ${failed.length} check(s) did not pass.`);
  process.exitCode = 1;
}
