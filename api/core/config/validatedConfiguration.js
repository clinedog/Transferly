'use strict';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function csv(value) {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function buildValidatedConfiguration(parsed, derived = {}) {
  const providers = {};
  for (const provider of ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto', 'binance', 'cashapp']) {
    const prefix = provider === 'cashapp' ? 'CASH_APP' :
      provider === 'crypto' ? 'CRYPTO_COMMERCE' : provider.toUpperCase();
    providers[provider] = {
      configured: provider === 'paypal'
        ? Boolean(parsed.PAYPAL_CLIENT_ID && parsed.PAYPAL_CLIENT_SECRET)
        : Boolean(parsed[`${prefix}_API_KEY`] || parsed[`${prefix}_SECRET_KEY`] || parsed[`${prefix}_API_TOKEN`]),
      environment: parsed[`${prefix}_ENVIRONMENT`] || null
    };
  }

  return freeze({
    environment: {
      node: parsed.NODE_ENV,
      appBaseUrl: parsed.APP_BASE_URL,
      frontendUrl: parsed.FRONTEND_URL,
      sqliteDatabasePath: derived.SQLITE_DATABASE_PATH || parsed.SQLITE_DATABASE_PATH,
      inlineQueueMode: Boolean(parsed.INLINE_QUEUE_MODE)
    },
    providers,
    security: {
      adminAuthEnabled: Boolean(derived.ADMIN_AUTH_ENABLED),
      botApiHmacRequired: Boolean(parsed.BOT_API_HMAC_REQUIRED),
      webhookTimestampToleranceSeconds: parsed.PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
    },
    financial: {
      maxSinglePayout: parsed.MAX_SINGLE_PAYOUT,
      dailyPayoutLimit: parsed.DAILY_PAYOUT_LIMIT,
      payoutAutoApprovalMaxCents: parsed.PAYOUT_AUTO_APPROVAL_MAX_CENTS,
      reconciliationIntervalMs: parsed.PAYMENT_RECONCILIATION_INTERVAL_MS
    },
    queues: {
      jobWaitMs: derived.JOB_WAIT_MS || parsed.JOB_WAIT_MS || parsed.WEBHOOK_QUEUE_WAIT_MS,
      webhookWaitMs: derived.WEBHOOK_QUEUE_WAIT_MS || parsed.WEBHOOK_QUEUE_WAIT_MS
    },
    points: {
      pointsToNairaRate: parsed.POINTS_TO_NAIRA_RATE,
      defaultServicePointCharge: parsed.DEFAULT_SERVICE_POINT_CHARGE,
      reservationTtlMs: parsed.POINT_RESERVATION_TTL_MS,
      reservationExpiryIntervalMs: parsed.POINT_RESERVATION_EXPIRY_INTERVAL_MS
    },
    features: {
      service: csv(parsed.SERVICE_FEATURE_FLAGS),
      paymentProvider: csv(parsed.PAYMENT_PROVIDER_FEATURE_FLAGS),
      paymentVerificationEnabled: Boolean(parsed.PAYMENT_VERIFICATION_ENABLED),
      riskEngineEnabled: Boolean(parsed.RISK_ENGINE_ENABLED)
    }
  });
}

module.exports = {
  buildValidatedConfiguration
};
