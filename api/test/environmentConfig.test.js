const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  buildAllowedOrigins,
  collectProductionConfigErrors,
  deriveEnvironmentConfig,
  isUnsafeSecretValue,
  parseTelegramUserIds,
  parseUserApiTokens,
  splitCsv,
  toOrigin
} = require('../core/config/environment');

function createParsed(overrides = {}) {
  return {
    NODE_ENV: 'development',
    APP_BASE_URL: 'https://api.transferly.test/app',
    FRONTEND_URL: 'https://app.transferly.test/dashboard',
    SQLITE_DATABASE_PATH: './data/transferly.sqlite',
    CORS_ALLOWED_ORIGINS: 'https://admin.transferly.test/, https://*.transferly.test/',
    TELEGRAM_MINI_APP_URL: '',
    MINI_APP_URL: 'https://mini.transferly.test/start',
    JOB_WAIT_MS: undefined,
    WEBHOOK_QUEUE_WAIT_MS: 45000,
    ADMIN_API_TOKEN: 'admin-token',
    BOT_API_HMAC_SECRET: '',
    API_HMAC_SECRET: 'shared-hmac-fixture',
    BOT_API_HMAC_REQUIRED: true,
    BOT_API_HMAC_REPLAY_STORE: undefined,
    JWT_SECRET: 'jwt-secret-value',
    INLINE_QUEUE_MODE: false,
    PAYPAL_CLIENT_ID: 'paypal-client-id',
    PAYPAL_CLIENT_SECRET: 'paypal-client-secret-value',
    PAYPAL_ENVIRONMENT: 'sandbox',
    PAYPAL_WEBHOOK_ID: 'paypal-webhook-id',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_WEBHOOK_SECRET: '',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    PAYSTACK_SECRET_KEY: '',
    PAYSTACK_WEBHOOK_SECRET: '',
    FLUTTERWAVE_SECRET_KEY: '',
    FLUTTERWAVE_WEBHOOK_SECRET: '',
    CRYPTO_COMMERCE_API_KEY: '',
    CRYPTO_COMMERCE_WEBHOOK_SECRET: '',
    WISE_API_TOKEN: '',
    WISE_PROFILE_ID: '',
    WISE_WEBHOOK_PUBLIC_KEY: '',
    ADMIN_API_ACTOR_ID: '',
    SEED_ADMIN_ACTOR_ID: 'seed-admin',
    USER_API_TOKENS: 'demo-user:demo-token, secondary-user:secondary-token',
    TRANSFERLY_OWNER_TELEGRAM_USER_IDS: '9001003, 9001005',
    TRANSFERLY_ADMIN_TELEGRAM_USER_IDS: '9001004',
    SERVICE_FEATURE_FLAGS: 'orders, receipts',
    PAYMENT_PROVIDER_FEATURE_FLAGS: 'PayPal, STRIPE',
    API_REQUEST_TIMEOUT_MS: 30000,
    POINTS_TO_NAIRA_RATE: 1,
    DEFAULT_SERVICE_POINT_CHARGE: 250,
    POINTS_FUNDING_DESTINATION_ACTIVE: true,
    POINTS_FUNDING_BANK_PROVIDER: 'Opay',
    POINTS_FUNDING_ACCOUNT_NAME: 'Transferly Services Ltd',
    POINTS_FUNDING_ACCOUNT_NUMBER: '9876543210',
    POINTS_FUNDING_PAYMENT_NOTE: 'Use your Transferly payment reference.',
    POINTS_FUNDING_INSTRUCTIONS: 'Transfer exactly the shown amount. 1 point = ₦1.',
    HIGH_RISK_COUNTRIES: 'ng, br',
    HIGH_RISK_CURRENCIES: 'ngn, brl',
    SUSPICIOUS_INVOICE_KEYWORDS: 'Crypto, Gift Card',
    ...overrides
  };
}

test('splitCsv trims entries, drops blanks, and applies transforms', () => {
  assert.deepEqual(splitCsv(' alpha, , beta ', (entry) => entry.toUpperCase()), ['ALPHA', 'BETA']);
});

test('isUnsafeSecretValue rejects placeholders and short secrets', () => {
  assert.equal(isUnsafeSecretValue('replace-with-a-long-random-secret'), true);
  assert.equal(isUnsafeSecretValue('short'), true);
  assert.equal(isUnsafeSecretValue('prod_' + 'a'.repeat(40)), false);
});

test('collectProductionConfigErrors rejects unsafe production defaults and token overlap', () => {
  const parsed = createParsed({
    NODE_ENV: 'production',
    INLINE_QUEUE_MODE: true,
    JWT_SECRET: 'replace-with-a-long-random-secret',
    ADMIN_API_TOKEN: 'admin-secret-token',
    BOT_API_HMAC_SECRET: '',
    API_HMAC_SECRET: 'replace-with-a-long-random-secret',
    BOT_API_HMAC_REQUIRED: false,
    PAYPAL_CLIENT_SECRET: 'your-paypal-secret',
    PAYPAL_ENVIRONMENT: 'sandbox',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_WEBHOOK_SECRET: '',
    USER_API_TOKENS: 'demo-user:admin-secret-token',
    PAYMENT_PROVIDER_FEATURE_FLAGS: 'paypal',
    POINTS_FUNDING_DESTINATION_ACTIVE: false,
    POINTS_FUNDING_BANK_PROVIDER: 'Configured Bank',
    POINTS_FUNDING_ACCOUNT_NAME: 'TRANSFERLY CONFIG REQUIRED',
    POINTS_FUNDING_ACCOUNT_NUMBER: '0000000000',
    POINTS_TO_NAIRA_RATE: 2,
    DEFAULT_SERVICE_POINT_CHARGE: 100
  });
  const derived = deriveEnvironmentConfig(parsed, { resolvePath: (value) => value });
  const errors = collectProductionConfigErrors(parsed, derived);

  assert.ok(errors.some((error) => error.includes('JWT_SECRET')));
  assert.ok(errors.some((error) => error.includes('ADMIN_API_TOKEN must not also be listed')));
  assert.ok(errors.some((error) => error.includes('PAYPAL_ENVIRONMENT')));
  assert.ok(errors.some((error) => error.includes('INLINE_QUEUE_MODE')));
  assert.ok(errors.some((error) => error.includes('BOT_API_HMAC_REQUIRED')));
  assert.ok(errors.some((error) => error.includes('POINTS_FUNDING_DESTINATION_ACTIVE')));
  assert.ok(errors.some((error) => error.includes('POINTS_TO_NAIRA_RATE')));
  assert.ok(errors.some((error) => error.includes('DEFAULT_SERVICE_POINT_CHARGE')));
  assert.ok(errors.some((error) => error.includes('POINTS_FUNDING_ACCOUNT_NUMBER')));
});

test('collectProductionConfigErrors accepts strongly configured core production PayPal setup', () => {
  const strong = (prefix) => `${prefix}_${'a'.repeat(48)}`;
  const productionTokenLiteral = `1234567890:${'b'.repeat(32)}`;
  const parsed = createParsed({
    NODE_ENV: 'production',
    JWT_SECRET: strong('jwt'),
    ADMIN_API_TOKEN: strong('admin'),
    BOT_API_HMAC_SECRET: strong('hmac'),
    API_HMAC_SECRET: '',
    BOT_API_HMAC_REQUIRED: true,
    BOT_API_HMAC_REPLAY_STORE: 'redis',
    PAYPAL_CLIENT_ID: 'paypal-live-client-id',
    PAYPAL_CLIENT_SECRET: strong('paypal'),
    PAYPAL_ENVIRONMENT: 'production',
    PAYPAL_WEBHOOK_ID: 'paypal-live-webhook-id',
    TELEGRAM_BOT_TOKEN: productionTokenLiteral,
    TELEGRAM_WEBHOOK_SECRET: strong('telegram'),
    USER_API_TOKENS: 'demo-user:' + strong('user'),
    PAYMENT_PROVIDER_FEATURE_FLAGS: 'paypal'
  });
  const derived = deriveEnvironmentConfig(parsed, { resolvePath: (value) => value });

  assert.deepEqual(collectProductionConfigErrors(parsed, derived), []);
});

test('parseUserApiTokens maps bearer tokens to user ids', () => {
  assert.deepEqual(parseUserApiTokens(' demo-user:demo-token , user-2:token:with-colon '), {
    'demo-token': 'demo-user',
    'token:with-colon': 'user-2'
  });
});

test('parseUserApiTokens rejects malformed entries', () => {
  assert.throws(
    () => parseUserApiTokens('missing-token:'),
    /Invalid USER_API_TOKENS entry "missing-token:"\. Expected userId:token\./
  );
  assert.throws(
    () => parseUserApiTokens(':missing-user'),
    /Invalid USER_API_TOKENS entry ":missing-user"\. Expected userId:token\./
  );
});

test('toOrigin extracts valid URL origins and ignores invalid URLs', () => {
  assert.equal(toOrigin('https://app.transferly.test/path?token=secret'), 'https://app.transferly.test');
  assert.equal(toOrigin('not-a-url'), null);
});

test('buildAllowedOrigins preserves wildcard entries and derives app origins', () => {
  const parsed = createParsed();
  assert.deepEqual(buildAllowedOrigins({ parsed, telegramMiniAppUrl: parsed.MINI_APP_URL }), [
    'https://admin.transferly.test',
    'https://*.transferly.test',
    'https://api.transferly.test',
    'https://app.transferly.test',
    'https://mini.transferly.test'
  ]);
});

test('parseTelegramUserIds returns normalized positive id strings', () => {
  assert.deepEqual([...parseTelegramUserIds(' 123,456 ')], ['123', '456']);
  assert.throws(() => parseTelegramUserIds('0'), /Invalid Telegram user ID: 0/);
  assert.throws(() => parseTelegramUserIds('abc'), /Invalid Telegram user ID: abc/);
});

test('deriveEnvironmentConfig preserves derived runtime configuration contract', () => {
  const derived = deriveEnvironmentConfig(createParsed(), {
    resolvePath: (value) => `/resolved/${value}`
  });

  assert.equal(derived.SQLITE_DATABASE_PATH, '/resolved/./data/transferly.sqlite');
  assert.equal(derived.JOB_WAIT_MS, 45000);
  assert.equal(derived.WEBHOOK_QUEUE_WAIT_MS, 45000);
  assert.equal(derived.TELEGRAM_MINI_APP_URL, 'https://mini.transferly.test/start');
  assert.equal(derived.ADMIN_AUTH_ENABLED, true);
  assert.equal(derived.BOT_API_HMAC_SECRET, 'shared-hmac-fixture');
  assert.equal(derived.BOT_API_HMAC_ENABLED, true);
  assert.equal(derived.BOT_API_HMAC_REQUIRED, true);
  assert.equal(derived.BOT_API_HMAC_REPLAY_STORE, 'memory');
  assert.equal(derived.JWT_AUTH_ENABLED, true);
  assert.equal(derived.DEFAULT_ADMIN_ACTOR_ID, 'seed-admin');
  assert.deepEqual(derived.USER_API_TOKEN_MAP, {
    'demo-token': 'demo-user',
    'secondary-token': 'secondary-user'
  });
  assert.deepEqual([...derived.OWNER_TELEGRAM_USER_IDS], ['9001003', '9001005']);
  assert.deepEqual([...derived.ADMIN_TELEGRAM_USER_IDS], ['9001004']);
  assert.deepEqual([...derived.ENABLED_SERVICE_FEATURE_FLAGS], ['orders', 'receipts']);
  assert.deepEqual([...derived.ENABLED_PAYMENT_PROVIDERS], ['paypal', 'stripe']);
  assert.deepEqual(derived.HIGH_RISK_COUNTRIES, ['NG', 'BR']);
  assert.deepEqual(derived.HIGH_RISK_CURRENCIES, ['NGN', 'BRL']);
  assert.deepEqual(derived.SUSPICIOUS_INVOICE_KEYWORDS, ['crypto', 'gift card']);
  assert.deepEqual(derived.POINTS_ECONOMY, {
    pointsToNairaRate: 1,
    defaultServicePointCharge: 250,
    valueNote: '1 Transferly Point = ₦1'
  });
  assert.deepEqual(derived.POINTS_FUNDING_DESTINATION, {
    active: true,
    provider: 'Opay',
    accountName: 'Transferly Services Ltd',
    accountNumber: '9876543210',
    paymentNote: 'Use your Transferly payment reference.',
    instructions: 'Transfer exactly the shown amount. 1 point = ₦1.',
    currency: 'NGN'
  });
});

test('deriveEnvironmentConfig uses explicit admin actor, Telegram URL, and production replay store when configured', () => {
  const derived = deriveEnvironmentConfig(
    createParsed({
      NODE_ENV: 'production',
      TELEGRAM_MINI_APP_URL: 'https://telegram.transferly.test/app',
      ADMIN_API_ACTOR_ID: 'explicit-admin',
      BOT_API_HMAC_SECRET: 'bot-hmac-fixture',
      API_HMAC_SECRET: 'fallback-hmac',
      JOB_WAIT_MS: 12000,
      WEBHOOK_QUEUE_WAIT_MS: 45000,
      BOT_API_HMAC_REPLAY_STORE: undefined
    }),
    { resolvePath: (value) => value }
  );

  assert.equal(derived.TELEGRAM_MINI_APP_URL, 'https://telegram.transferly.test/app');
  assert.equal(derived.DEFAULT_ADMIN_ACTOR_ID, 'explicit-admin');
  assert.equal(derived.BOT_API_HMAC_SECRET, 'bot-hmac-fixture');
  assert.equal(derived.JOB_WAIT_MS, 12000);
  assert.equal(derived.WEBHOOK_QUEUE_WAIT_MS, 12000);
  assert.equal(derived.BOT_API_HMAC_REPLAY_STORE, 'redis');
});