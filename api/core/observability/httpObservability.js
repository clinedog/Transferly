const { sanitizeRequestUrl } = require('../../utils/sanitizeRequestUrl');
const { operationalMetrics } = require('./operationalMetrics');

function buildReliabilityChecks(config) {
  const queueMode = config.INLINE_QUEUE_MODE ? 'inline' : 'redis';
  const checks = {
    database: 'configured',
    queue: queueMode,
    corsOrigins: config.CORS_ALLOWED_ORIGINS.length,
    telegramMiniAppUrl: Boolean(config.TELEGRAM_MINI_APP_URL),
    telegramMiniAppAuth: Boolean(config.TELEGRAM_BOT_TOKEN),
    requestTimeoutMs: config.API_REQUEST_TIMEOUT_MS,
    jobWaitMs: config.JOB_WAIT_MS,
    authRateLimit: {
      windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
      max: config.AUTH_RATE_LIMIT_MAX
    },
    apiRateLimit: {
      windowMs: config.API_RATE_LIMIT_WINDOW_MS,
      max: config.API_RATE_LIMIT_MAX
    }
  };

  const degradedReasons = [];
  if (!checks.telegramMiniAppUrl) degradedReasons.push('telegram_mini_app_url_missing');
  if (!checks.telegramMiniAppAuth) degradedReasons.push('telegram_mini_app_auth_missing');
  if (queueMode !== 'redis' && config.NODE_ENV === 'production') degradedReasons.push('queue_inline_mode_in_production');

  return { checks, degradedReasons };
}

function buildHealthPayload({ request, config, now = new Date(), uptimeSeconds = process.uptime() }) {
  const { checks, degradedReasons } = buildReliabilityChecks(config);
  const degraded = degradedReasons.length > 0;

  return {
    ok: !degraded,
    status: degraded ? 'degraded' : 'healthy',
    signals: {
      live: true,
      ready: !degraded,
      degraded,
      unavailable: false
    },
    requestId: request.id,
    uptimeSeconds: Math.round(uptimeSeconds),
    timestamp: now.toISOString(),
    environment: config.NODE_ENV,
    checks,
    degradedReasons
  };
}

function buildClientHealthPayload({ request, config, now = new Date() }) {
  const { checks, degradedReasons } = buildReliabilityChecks(config);
  const telegramMiniAppConfigured = Boolean(config.TELEGRAM_MINI_APP_URL);
  const telegramAuthConfigured = Boolean(config.TELEGRAM_BOT_TOKEN);
  const nextActions = [];

  if (!telegramMiniAppConfigured) {
    nextActions.push('Configure TELEGRAM_MINI_APP_URL before launching the Mini App in production.');
  }

  if (!telegramAuthConfigured) {
    nextActions.push('Configure TELEGRAM_BOT_TOKEN so Telegram Mini App sessions can be verified.');
  }

  return {
    ok: true,
    status: nextActions.length > 0 ? 'degraded' : 'healthy',
    contractVersion: '2026-08-client-health-v2',
    requestId: request.id,
    timestamp: now.toISOString(),
    environment: config.NODE_ENV,
    signals: {
      live: true,
      ready: nextActions.length === 0,
      degraded: nextActions.length > 0,
      unavailable: false
    },
    api: {
      available: true,
      mode: config.NODE_ENV,
      requestTimeoutMs: checks.requestTimeoutMs
    },
    reliability: {
      queueMode: checks.queue,
      jobWaitMs: checks.jobWaitMs,
      degradedReasons
    },
    auth: {
      telegramMiniApp: {
        enabled: telegramAuthConfigured,
        launchUrlConfigured: telegramMiniAppConfigured,
        expiresInSeconds: config.TELEGRAM_MINI_APP_AUTH_EXPIRES_IN_SECONDS
      }
    },
    cors: {
      allowedOriginCount: config.CORS_ALLOWED_ORIGINS.length
    },
    deployment: {
      frontendOriginConfigured: Boolean(config.FRONTEND_URL),
      miniAppOriginConfigured: telegramMiniAppConfigured
    },
    featureFlags: {
      telegramMiniApp: telegramMiniAppConfigured,
      providerWorkspace: true
    },
    degraded: nextActions.length > 0,
    nextActions
  };
}

function createHttpRequestLogger({ logger, getTime = process.hrtime.bigint }) {
  return function requestLogger(request, response, next) {
    const startedAt = getTime();

    response.on('finish', () => {
      const durationMs = Number(getTime() - startedAt) / 1_000_000;
      const roundedDurationMs = Math.round(durationMs);
      const route = request.route?.path || sanitizeRequestUrl(request.originalUrl).split('?')[0];

      operationalMetrics.recordRequest({
        requestId: request.id,
        correlationId: request.correlationId,
        method: request.method,
        route,
        path: sanitizeRequestUrl(request.originalUrl),
        statusCode: response.statusCode,
        durationMs: roundedDurationMs
      });

      logger.info(
        {
          requestId: request.id,
          correlationId: request.correlationId,
          method: request.method,
          route,
          path: sanitizeRequestUrl(request.originalUrl),
          statusCode: response.statusCode,
          latencyMs: roundedDurationMs,
          durationMs: roundedDurationMs
        },
        'HTTP request completed'
      );
    });

    next();
  };
}

module.exports = {
  buildClientHealthPayload,
  buildHealthPayload,
  createHttpRequestLogger
};