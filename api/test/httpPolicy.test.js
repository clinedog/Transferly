const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
  CORS_METHODS,
  buildApiRateLimitOptions,
  buildCorsOptions,
  buildOriginMatcher,
  createRequestTimeoutMiddleware,
  createOriginPolicy,
  escapeRegExp,
  shouldBypassRateLimit
} = require('../core/config/httpPolicy');

function createLogger() {
  const warnings = [];
  return {
    warnings,
    warn(metadata, message) {
      warnings.push({ metadata, message });
    }
  };
}

function resolveOrigin(policy, origin) {
  let result;
  policy(origin, (error, allowed) => {
    result = { error, allowed };
  });
  return result;
}

test('escapeRegExp escapes user-provided origin pattern characters', () => {
  assert.equal(escapeRegExp('https://*.transferly.test'), 'https://\\*\\.transferly\\.test');
});

test('buildOriginMatcher supports exact origins and single-label wildcard origins', () => {
  const exact = buildOriginMatcher('https://app.transferly.test');
  const wildcard = buildOriginMatcher('https://*.transferly.test');

  assert.deepEqual(exact, { type: 'exact', value: 'https://app.transferly.test' });
  assert.equal(wildcard.type, 'pattern');
  assert.equal(wildcard.value, 'https://*.transferly.test');
  assert.equal(wildcard.pattern.test('https://mini.transferly.test'), true);
  assert.equal(wildcard.pattern.test('https://nested.mini.transferly.test'), false);
  assert.equal(wildcard.pattern.test('https://transferly.test'), false);
});

test('createOriginPolicy allows absent, exact, and wildcard origins and logs rejected origins', () => {
  const logger = createLogger();
  const policy = createOriginPolicy({
    allowedOrigins: ['https://app.transferly.test', 'https://*.transferly.test'],
    logger
  });

  assert.deepEqual(resolveOrigin(policy, undefined), { error: null, allowed: true });
  assert.deepEqual(resolveOrigin(policy, 'https://app.transferly.test'), { error: null, allowed: true });
  assert.deepEqual(resolveOrigin(policy, 'https://mini.transferly.test'), { error: null, allowed: true });
  assert.deepEqual(resolveOrigin(policy, 'https://evil.example.test'), { error: null, allowed: false });
  assert.deepEqual(logger.warnings, [
    {
      metadata: {
        origin: 'https://evil.example.test',
        configuredOrigins: 2
      },
      message: 'CORS origin rejected'
    }
  ]);
});

test('buildCorsOptions exposes Transferly API headers and delegates origin decisions', () => {
  const logger = createLogger();
  const options = buildCorsOptions({
    config: {
      CORS_ALLOWED_ORIGINS: ['https://app.transferly.test']
    },
    logger
  });

  assert.equal(options.credentials, true);
  assert.deepEqual(options.exposedHeaders, [...CORS_EXPOSED_HEADERS]);
  assert.deepEqual(options.allowedHeaders, [...CORS_ALLOWED_HEADERS]);
  assert.equal(options.allowedHeaders.includes('x-telegram-init-data'), false);
  assert.equal(options.allowedHeaders.includes('authorization'), true);
  assert.deepEqual(options.methods, [...CORS_METHODS]);
  assert.deepEqual(resolveOrigin(options.origin, 'https://app.transferly.test'), { error: null, allowed: true });
});

test('shouldBypassRateLimit bypasses only health endpoints', () => {
  assert.equal(shouldBypassRateLimit({ path: '/health' }), true);
  assert.equal(shouldBypassRateLimit({ path: '/api/health' }), true);
  assert.equal(shouldBypassRateLimit({ path: '/api/health/client' }), true);
  assert.equal(shouldBypassRateLimit({ path: '/api/v1/health' }), true);
  assert.equal(shouldBypassRateLimit({ path: '/api/v1/health/client' }), true);
  assert.equal(shouldBypassRateLimit({ path: '/api/orders' }), false);
});

test('buildApiRateLimitOptions preserves API rate-limit response contract', () => {
  const options = buildApiRateLimitOptions({
    config: {
      API_RATE_LIMIT_WINDOW_MS: 60000,
      API_RATE_LIMIT_MAX: 120
    }
  });
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  assert.equal(options.windowMs, 60000);
  assert.equal(options.max, 120);
  assert.equal(options.standardHeaders, true);
  assert.equal(options.legacyHeaders, false);
  assert.equal(options.skip({ path: '/api/orders' }), false);

  options.handler({ id: 'request-123' }, response);
  assert.equal(response.statusCode, 429);
  assert.deepEqual(response.body, {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
    classification: 'rate_limit',
    retryable: true,
    recovery: {
      retryable: true,
      retryAfter: 60,
      action: 'wait_then_retry'
    },
    requestId: 'request-123'
  });
});

test('createRequestTimeoutMiddleware returns a consistent timeout response and sanitized logs', async () => {
  const logger = createLogger();
  const middleware = createRequestTimeoutMiddleware({ timeoutMs: 5, logger });
  const response = {
    headersSent: false,
    statusCode: null,
    body: null,
    listeners: {},
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      this.headersSent = true;
      this.listeners.finish?.();
      return this;
    },
    on(event, handler) {
      this.listeners[event] = handler;
      return this;
    }
  };
  let nextCalled = false;

  middleware(
    {
      id: 'request-timeout-1',
      method: 'GET',
      originalUrl: '/api/orders?token=secret-value'
    },
    response,
    () => {
      nextCalled = true;
    }
  );

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, {
    code: 'REQUEST_TIMEOUT',
    message: 'Request timed out. Please retry later.',
    classification: 'timeout',
    retryable: true,
    recovery: {
      retryable: true,
      retryAfter: null,
      action: 'retry_with_backoff'
    },
    requestId: 'request-timeout-1'
  });
  assert.equal(logger.warnings.length, 1);
  assert.equal(logger.warnings[0].metadata.path, '/api/orders?token=%5BREDACTED%5D');
});

test('createRequestTimeoutMiddleware clears timer when response finishes first', async () => {
  const logger = createLogger();
  const middleware = createRequestTimeoutMiddleware({ timeoutMs: 20, logger });
  const response = {
    headersSent: false,
    listeners: {},
    on(event, handler) {
      this.listeners[event] = handler;
      return this;
    }
  };

  middleware({ id: 'request-fast', method: 'GET', originalUrl: '/health' }, response, () => {});
  response.listeners.finish();
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(logger.warnings.length, 0);
});