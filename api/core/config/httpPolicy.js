const { sanitizeRequestUrl } = require('../../utils/sanitizeRequestUrl');
const { buildRecoveryHint, classifyFailure } = require('../reliability/failureClassification');

const HEALTH_RATE_LIMIT_BYPASS_PATHS = new Set([
  '/health',
  '/api/health',
  '/api/health/client',
  '/api/v1/health',
  '/api/v1/health/client'
]);

const CORS_ALLOWED_HEADERS = Object.freeze([
  'authorization',
  'content-type',
  'idempotency-key',
  'x-admin-token',
  'x-request-id',
  'x-transferly-client',
  'x-api-signature',
  'x-api-timestamp',
  'x-telegram-start-param',
  'x-telegram-bot-api-secret-token'
]);

const CORS_EXPOSED_HEADERS = Object.freeze(['x-request-id', 'retry-after']);
const CORS_METHODS = Object.freeze(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOriginMatcher(origin) {
  if (!origin.includes('*')) {
    return { type: 'exact', value: origin };
  }

  return {
    type: 'pattern',
    value: origin,
    pattern: new RegExp(`^${escapeRegExp(origin).replace(/\\\*/g, '[^.]+')}$`)
  };
}

function createOriginPolicy({ allowedOrigins, logger }) {
  const matchers = allowedOrigins.map(buildOriginMatcher);
  const exactOrigins = new Set(matchers.filter((entry) => entry.type === 'exact').map((entry) => entry.value));
  const patternOrigins = matchers.filter((entry) => entry.type === 'pattern');

  return function resolveOrigin(origin, callback) {
    const allowed =
      !origin ||
      exactOrigins.has(origin) ||
      patternOrigins.some((entry) => entry.pattern.test(origin));

    if (allowed) {
      callback(null, true);
      return;
    }

    logger.warn(
      {
        origin,
        configuredOrigins: allowedOrigins.length
      },
      'CORS origin rejected'
    );
    callback(null, false);
  };
}

function buildCorsOptions({ config, logger }) {
  return {
    credentials: true,
    exposedHeaders: [...CORS_EXPOSED_HEADERS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    methods: [...CORS_METHODS],
    origin: createOriginPolicy({ allowedOrigins: config.CORS_ALLOWED_ORIGINS, logger })
  };
}

function shouldBypassRateLimit(request) {
  return HEALTH_RATE_LIMIT_BYPASS_PATHS.has(request.path);
}

function buildApiRateLimitOptions({ config }) {
  return {
    windowMs: config.API_RATE_LIMIT_WINDOW_MS,
    max: config.API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldBypassRateLimit,
    handler: (request, response) => {
      const rateLimitError = { statusCode: 429, code: 'RATE_LIMITED' };
      const classification = classifyFailure(rateLimitError);
      response.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
        classification: classification.class,
        retryable: classification.retryable,
        recovery: buildRecoveryHint(classification),
        requestId: request.id
      });
    }
  };
}

function createRequestTimeoutMiddleware({ timeoutMs, logger }) {
  return function requestTimeout(request, response, next) {
    let completed = false;
    const timer = setTimeout(() => {
      if (completed || response.headersSent) {
        return;
      }

      completed = true;
      logger.warn(
        {
          requestId: request.id,
          method: request.method,
          path: sanitizeRequestUrl(request.originalUrl),
          timeoutMs
        },
        'HTTP request timed out'
      );
      const timeoutError = { statusCode: 503, code: 'REQUEST_TIMEOUT' };
      const classification = classifyFailure(timeoutError);
      response.status(503).json({
        code: 'REQUEST_TIMEOUT',
        message: 'Request timed out. Please retry later.',
        classification: classification.class,
        retryable: classification.retryable,
        recovery: buildRecoveryHint(classification),
        requestId: request.id
      });
    }, timeoutMs);

    response.on('finish', () => {
      completed = true;
      clearTimeout(timer);
    });
    response.on('close', () => {
      completed = true;
      clearTimeout(timer);
    });

    next();
  };
}

module.exports = {
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
  CORS_METHODS,
  HEALTH_RATE_LIMIT_BYPASS_PATHS,
  buildApiRateLimitOptions,
  buildCorsOptions,
  buildOriginMatcher,
  createRequestTimeoutMiddleware,
  createOriginPolicy,
  escapeRegExp,
  shouldBypassRateLimit
};