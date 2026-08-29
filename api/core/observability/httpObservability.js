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

async function probeDatabase({ timeoutMs = 1500 } = {}) {
  const startedAt = Date.now();
  try {
    const { db } = require('../../db');
    if (!db || typeof db.get !== 'function') {
      return { status: 'unavailable', latencyMs: 0, error: 'database_handle_unavailable' };
    }
    const result = await Promise.race([
      db.get('SELECT 1 AS ok'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('database_probe_timeout')), timeoutMs))
    ]);
    if (!result || result.ok !== 1) {
      return { status: 'degraded', latencyMs: Date.now() - startedAt, error: 'unexpected_response' };
    }
    return { status: 'healthy', latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - startedAt,
      error: error && error.message ? error.message : 'database_probe_failed'
    };
  }
}

async function probeRedis({ config, timeoutMs = 1500 } = {}) {
  const startedAt = Date.now();
  if (config.INLINE_QUEUE_MODE) {
    return { status: 'healthy', latencyMs: 0, mode: 'inline' };
  }
  try {
    let redisClient;
    try {
      const { redisConnection } = require('../../jobs/queues');
      redisClient = redisConnection;
    } catch (_moduleError) {
      return { status: 'unavailable', latencyMs: 0, error: 'queue_module_unavailable' };
    }
    if (!redisClient || typeof redisClient.ping !== 'function') {
      return { status: 'degraded', latencyMs: 0, error: 'queue_ping_unavailable' };
    }
    const result = await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('redis_probe_timeout')), timeoutMs))
    ]);
    if (result !== 'PONG') {
      return { status: 'degraded', latencyMs: Date.now() - startedAt, error: 'unexpected_response' };
    }
    return { status: 'healthy', latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - startedAt,
      error: error && error.message ? error.message : 'redis_probe_failed'
    };
  }
}

async function buildDetailedHealth({ config }) {
  const [database, redis] = await Promise.all([probeDatabase(), probeRedis({ config })]);
  const checks = {
    database,
    redis,
    queue: {
      mode: config.INLINE_QUEUE_MODE ? 'inline' : 'redis',
      status: config.INLINE_QUEUE_MODE ? 'healthy' : redis.status
    },
    telegram: {
      botToken: Boolean(config.TELEGRAM_BOT_TOKEN),
      miniAppUrl: Boolean(config.TELEGRAM_MINI_APP_URL),
      status: config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_MINI_APP_URL ? 'healthy' : 'degraded'
    },
    paypal: {
      clientId: Boolean(config.PAYPAL_CLIENT_ID),
      clientSecret: Boolean(config.PAYPAL_CLIENT_SECRET),
      webhookId: Boolean(config.PAYPAL_WEBHOOK_ID),
      status: config.PAYPAL_CLIENT_ID && config.PAYPAL_CLIENT_SECRET && config.PAYPAL_WEBHOOK_ID ? 'healthy' : 'degraded'
    },
    auth: {
      jwtSecret: Boolean(config.JWT_SECRET),
      adminToken: Boolean(config.ADMIN_API_TOKEN),
      botHmac: Boolean(config.BOT_API_HMAC_SECRET),
      status: config.JWT_SECRET ? 'healthy' : 'degraded'
    }
  };

  const degradedReasons = [];
  if (database.status !== 'healthy') degradedReasons.push(`database_${database.status}`);
  if (!config.INLINE_QUEUE_MODE && redis.status !== 'healthy') degradedReasons.push(`redis_${redis.status}`);
  if (!config.TELEGRAM_BOT_TOKEN) degradedReasons.push('telegram_bot_token_missing');
  if (!config.TELEGRAM_MINI_APP_URL) degradedReasons.push('telegram_mini_app_url_missing');

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
  buildDetailedHealth,
  buildHealthPayload,
  createHttpRequestLogger
};