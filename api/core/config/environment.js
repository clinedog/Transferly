const path = require('node:path');

function splitCsv(value, transform) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (transform ? transform(entry) : entry));
}

function parseUserApiTokens(value) {
  const tokens = {};

  for (const entry of splitCsv(value)) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
      throw new Error(`Invalid USER_API_TOKENS entry "${entry}". Expected userId:token.`);
    }

    const userId = entry.slice(0, separatorIndex).trim();
    const token = entry.slice(separatorIndex + 1).trim();

    if (!userId || !token) {
      throw new Error(`Invalid USER_API_TOKENS entry "${entry}". Expected userId:token.`);
    }

    tokens[token] = userId;
  }

  return tokens;
}

function toOrigin(value) {
  try {
    return new URL(value).origin;
  } catch (_error) {
    return null;
  }
}

function buildAllowedOrigins({ parsed, telegramMiniAppUrl }) {
  const origins = new Set(
    splitCsv(parsed.CORS_ALLOWED_ORIGINS, (entry) => {
      if (entry.includes('*')) {
        return entry.replace(/\/+$/, '');
      }

      return toOrigin(entry) || entry.replace(/\/+$/, '');
    })
  );

  [parsed.APP_BASE_URL, parsed.FRONTEND_URL, telegramMiniAppUrl].forEach((url) => {
    const origin = toOrigin(url);
    if (origin) {
      origins.add(origin);
    }
  });

  return [...origins];
}

function parseTelegramUserIds(value) {
  return new Set(
    splitCsv(value, (entry) => {
      const id = Number(entry);
      if (!Number.isFinite(id) || id <= 0) {
        throw new Error(`Invalid Telegram user ID: ${entry}. Expected positive integer.`);
      }
      return String(id);
    })
  );
}

const unsafeSecretFragments = Object.freeze([
  'change-me',
  'changeme',
  'replace-with',
  'development-secret',
  'test-secret',
  'test-token',
  'your-',
  'example',
  'placeholder',
  'secret-token'
]);

function isUnsafeSecretValue(value, { minLength = 32 } = {}) {
  const normalized = String(value || '').trim();
  if (normalized.length < minLength) {
    return true;
  }

  const lower = normalized.toLowerCase();
  return unsafeSecretFragments.some((fragment) => lower.includes(fragment));
}

function collectProductionConfigErrors(parsed, derived) {
  if (parsed.NODE_ENV !== 'production') {
    return [];
  }

  const errors = [];
  const requireSecret = (key, value, options) => {
    if (isUnsafeSecretValue(value, options)) {
      errors.push(`${key} must be set to a production-only random secret.`);
    }
  };
  const requirePresent = (key, value) => {
    if (!String(value || '').trim()) {
      errors.push(`${key} must be set in production.`);
    }
  };

  requireSecret('JWT_SECRET', parsed.JWT_SECRET, { minLength: 32 });
  requireSecret('ADMIN_API_TOKEN', parsed.ADMIN_API_TOKEN, { minLength: 32 });
  requireSecret('BOT_API_HMAC_SECRET', derived.BOT_API_HMAC_SECRET, { minLength: 32 });
  requireSecret('TELEGRAM_WEBHOOK_SECRET', parsed.TELEGRAM_WEBHOOK_SECRET, { minLength: 32 });
  requirePresent('TELEGRAM_BOT_TOKEN', parsed.TELEGRAM_BOT_TOKEN);
  requirePresent('PAYPAL_CLIENT_ID', parsed.PAYPAL_CLIENT_ID);
  requireSecret('PAYPAL_CLIENT_SECRET', parsed.PAYPAL_CLIENT_SECRET, { minLength: 32 });
  requirePresent('PAYPAL_WEBHOOK_ID', parsed.PAYPAL_WEBHOOK_ID);
  requirePresent('POINTS_FUNDING_BANK_PROVIDER', parsed.POINTS_FUNDING_BANK_PROVIDER);
  requirePresent('POINTS_FUNDING_ACCOUNT_NAME', parsed.POINTS_FUNDING_ACCOUNT_NAME);
  requirePresent('POINTS_FUNDING_ACCOUNT_NUMBER', parsed.POINTS_FUNDING_ACCOUNT_NUMBER);
  requirePresent('POINTS_FUNDING_PAYMENT_NOTE', parsed.POINTS_FUNDING_PAYMENT_NOTE);
  if (!parsed.POINTS_FUNDING_DESTINATION_ACTIVE) {
    errors.push('POINTS_FUNDING_DESTINATION_ACTIVE must be true in production.');
  }
  if (Number(parsed.POINTS_TO_NAIRA_RATE) !== 1) {
    errors.push('POINTS_TO_NAIRA_RATE must be 1 so 1 point = ₦1.');
  }
  if (Number(parsed.DEFAULT_SERVICE_POINT_CHARGE) !== 250) {
    errors.push('DEFAULT_SERVICE_POINT_CHARGE must be 250 unless code/tests are updated for a new pricing policy.');
  }
  if (/^(0+|1234567890)$/i.test(String(parsed.POINTS_FUNDING_ACCOUNT_NUMBER || '').trim())) {
    errors.push('POINTS_FUNDING_ACCOUNT_NUMBER must be a real configured production account number.');
  }
  if (/config required|configured bank|placeholder|example/i.test(`${parsed.POINTS_FUNDING_BANK_PROVIDER} ${parsed.POINTS_FUNDING_ACCOUNT_NAME}`)) {
    errors.push('POINTS_FUNDING_BANK_PROVIDER and POINTS_FUNDING_ACCOUNT_NAME must be production values.');
  }
  if (parsed.PAYMENT_VERIFICATION_ENABLED) {
    requireSecret('OPAY_WEBHOOK_SECRET', parsed.OPAY_WEBHOOK_SECRET, { minLength: 24 });
  }

  if (parsed.PAYPAL_ENVIRONMENT !== 'production') {
    errors.push('PAYPAL_ENVIRONMENT must be production when NODE_ENV=production.');
  }
  if (parsed.INLINE_QUEUE_MODE) {
    errors.push('INLINE_QUEUE_MODE must be false in production.');
  }
  if (derived.BOT_API_HMAC_REPLAY_STORE !== 'redis') {
    errors.push('BOT_API_HMAC_REPLAY_STORE must be redis in production.');
  }
  if (!parsed.BOT_API_HMAC_REQUIRED) {
    errors.push('BOT_API_HMAC_REQUIRED must be true in production.');
  }

  const userTokenMap = derived.USER_API_TOKEN_MAP || {};
  if (Object.prototype.hasOwnProperty.call(userTokenMap, parsed.ADMIN_API_TOKEN)) {
    errors.push('ADMIN_API_TOKEN must not also be listed in USER_API_TOKENS.');
  }

  const enabledProviders = derived.ENABLED_PAYMENT_PROVIDERS || new Set();
  const providerEnabled = (provider) => enabledProviders.has(provider);
  const requireProviderSecretPair = (provider, credentialKey, credentialValue, webhookKey, webhookValue) => {
    if (!providerEnabled(provider) && !credentialValue && !webhookValue) {
      return;
    }
    if (credentialValue || webhookValue || providerEnabled(provider)) {
      requireSecret(credentialKey, credentialValue, { minLength: 24 });
      requireSecret(webhookKey, webhookValue, { minLength: 24 });
    }
  };

  requireProviderSecretPair('stripe', 'STRIPE_SECRET_KEY', parsed.STRIPE_SECRET_KEY, 'STRIPE_WEBHOOK_SECRET', parsed.STRIPE_WEBHOOK_SECRET);
  requireProviderSecretPair('paystack', 'PAYSTACK_SECRET_KEY', parsed.PAYSTACK_SECRET_KEY, 'PAYSTACK_WEBHOOK_SECRET', parsed.PAYSTACK_WEBHOOK_SECRET);
  requireProviderSecretPair('flutterwave', 'FLUTTERWAVE_SECRET_KEY', parsed.FLUTTERWAVE_SECRET_KEY, 'FLUTTERWAVE_WEBHOOK_SECRET', parsed.FLUTTERWAVE_WEBHOOK_SECRET);
  requireProviderSecretPair('crypto', 'CRYPTO_COMMERCE_API_KEY', parsed.CRYPTO_COMMERCE_API_KEY, 'CRYPTO_COMMERCE_WEBHOOK_SECRET', parsed.CRYPTO_COMMERCE_WEBHOOK_SECRET);

  if (providerEnabled('wise')) {
    requireSecret('WISE_API_TOKEN', parsed.WISE_API_TOKEN, { minLength: 24 });
    requirePresent('WISE_PROFILE_ID', parsed.WISE_PROFILE_ID);
    requireSecret('WISE_WEBHOOK_PUBLIC_KEY', parsed.WISE_WEBHOOK_PUBLIC_KEY, { minLength: 64 });
  }

  return errors;
}

function validateProductionConfig(parsed, derived) {
  const errors = collectProductionConfigErrors(parsed, derived);
  if (errors.length > 0) {
    throw new Error(`Production configuration is unsafe:\n- ${errors.join('\n- ')}`);
  }
}

function deriveEnvironmentConfig(parsed, { resolvePath = path.resolve } = {}) {
  const telegramMiniAppUrl = parsed.TELEGRAM_MINI_APP_URL || parsed.MINI_APP_URL || parsed.FRONTEND_URL;
  const botApiHmacSecret = parsed.BOT_API_HMAC_SECRET || parsed.API_HMAC_SECRET;

  return {
    SQLITE_DATABASE_PATH: resolvePath(parsed.SQLITE_DATABASE_PATH),
    JOB_WAIT_MS: parsed.JOB_WAIT_MS ?? parsed.WEBHOOK_QUEUE_WAIT_MS ?? 30000,
    WEBHOOK_QUEUE_WAIT_MS: parsed.JOB_WAIT_MS ?? parsed.WEBHOOK_QUEUE_WAIT_MS ?? 30000,
    TELEGRAM_MINI_APP_URL: telegramMiniAppUrl,
    CORS_ALLOWED_ORIGINS: buildAllowedOrigins({ parsed, telegramMiniAppUrl }),
    ADMIN_AUTH_ENABLED: Boolean(parsed.ADMIN_API_TOKEN),
    BOT_API_HMAC_SECRET: botApiHmacSecret,
    BOT_API_HMAC_ENABLED: Boolean(botApiHmacSecret),
    BOT_API_HMAC_REQUIRED: parsed.BOT_API_HMAC_REQUIRED,
    BOT_API_HMAC_REPLAY_STORE: parsed.BOT_API_HMAC_REPLAY_STORE || (parsed.NODE_ENV === 'production' ? 'redis' : 'memory'),
    JWT_AUTH_ENABLED: Boolean(parsed.JWT_SECRET),
    DEFAULT_ADMIN_ACTOR_ID: parsed.ADMIN_API_ACTOR_ID || parsed.SEED_ADMIN_ACTOR_ID || 'system-admin',
    USER_API_TOKEN_MAP: parseUserApiTokens(parsed.USER_API_TOKENS),
    OWNER_TELEGRAM_USER_IDS: parseTelegramUserIds(parsed.TRANSFERLY_OWNER_TELEGRAM_USER_IDS),
    ADMIN_TELEGRAM_USER_IDS: parseTelegramUserIds(parsed.TRANSFERLY_ADMIN_TELEGRAM_USER_IDS),
    ENABLED_SERVICE_FEATURE_FLAGS: new Set(splitCsv(parsed.SERVICE_FEATURE_FLAGS)),
    ENABLED_PAYMENT_PROVIDERS: new Set(splitCsv(parsed.PAYMENT_PROVIDER_FEATURE_FLAGS, (entry) => entry.toLowerCase())),
    HIGH_RISK_COUNTRIES: splitCsv(parsed.HIGH_RISK_COUNTRIES, (entry) => entry.toUpperCase()),
    HIGH_RISK_CURRENCIES: splitCsv(parsed.HIGH_RISK_CURRENCIES, (entry) => entry.toUpperCase()),
    SUSPICIOUS_INVOICE_KEYWORDS: splitCsv(parsed.SUSPICIOUS_INVOICE_KEYWORDS, (entry) => entry.toLowerCase()),
    POINTS_ECONOMY: {
      pointsToNairaRate: Number(parsed.POINTS_TO_NAIRA_RATE),
      defaultServicePointCharge: Number(parsed.DEFAULT_SERVICE_POINT_CHARGE),
      valueNote: `1 Transferly Point = ₦${Number(parsed.POINTS_TO_NAIRA_RATE).toLocaleString('en-NG')}`
    },
    POINTS_FUNDING_DESTINATION: {
      active: Boolean(parsed.POINTS_FUNDING_DESTINATION_ACTIVE),
      provider: parsed.POINTS_FUNDING_BANK_PROVIDER,
      accountName: parsed.POINTS_FUNDING_ACCOUNT_NAME,
      accountNumber: parsed.POINTS_FUNDING_ACCOUNT_NUMBER,
      paymentNote: parsed.POINTS_FUNDING_PAYMENT_NOTE,
      instructions: parsed.POINTS_FUNDING_INSTRUCTIONS,
      currency: 'NGN'
    },
    PAYMENT_VERIFICATION: {
      enabled: Boolean(parsed.PAYMENT_VERIFICATION_ENABLED),
      autoApprovalEnabled: Boolean(parsed.PAYMENT_AUTO_APPROVAL_ENABLED),
      autoApprovalMaxAmountMinor: Number(parsed.PAYMENT_AUTO_APPROVAL_MAX_AMOUNT_MINOR),
      webhookTimestampToleranceSeconds: Number(parsed.PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS)
    },
    RISK_ENGINE: {
      enabled: Boolean(parsed.RISK_ENGINE_ENABLED),
      reviewEnabled: Boolean(parsed.RISK_REVIEW_ENABLED),
      autoRestrictionEnabled: Boolean(parsed.AUTO_RESTRICTION_ENABLED),
      highRiskAutoReviewEnabled: Boolean(parsed.HIGH_RISK_AUTO_REVIEW_ENABLED),
      maxFundingAttemptsPerHour: Number(parsed.MAX_FUNDING_ATTEMPTS_PER_HOUR),
      maxDailyFundingAmount: Number(parsed.MAX_DAILY_FUNDING_AMOUNT),
      largeFundingThreshold: Number(parsed.LARGE_FUNDING_THRESHOLD),
      maxServiceActionsPerMinute: Number(parsed.MAX_SERVICE_ACTIONS_PER_MINUTE),
      maxServiceActionsPerHour: Number(parsed.MAX_SERVICE_ACTIONS_PER_HOUR),
      maxRefundRequestsPerDay: Number(parsed.MAX_REFUND_REQUESTS_PER_DAY),
      maxFailedPaymentAttempts: Number(parsed.MAX_FAILED_PAYMENT_ATTEMPTS),
      rapidPointConsumptionThreshold: Number(parsed.RAPID_POINT_CONSUMPTION_THRESHOLD),
      largeAdminAdjustmentThreshold: Number(parsed.LARGE_ADMIN_ADJUSTMENT_THRESHOLD),
      signalRetentionDays: Number(parsed.RISK_SIGNAL_RETENTION_DAYS),
      caseRetentionDays: Number(parsed.RISK_CASE_RETENTION_DAYS)
    }
  };
}

module.exports = {
  buildAllowedOrigins,
  collectProductionConfigErrors,
  deriveEnvironmentConfig,
  isUnsafeSecretValue,
  parseTelegramUserIds,
  parseUserApiTokens,
  splitCsv,
  toOrigin,
  validateProductionConfig
};