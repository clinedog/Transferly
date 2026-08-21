const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');

const {
  buildClientHealthPayload,
  buildHealthPayload,
  createHttpRequestLogger
} = require('../core/observability/httpObservability');

function createConfig(overrides = {}) {
  return {
    NODE_ENV: 'test',
    INLINE_QUEUE_MODE: true,
    CORS_ALLOWED_ORIGINS: ['https://mini.transferly.test'],
    TELEGRAM_MINI_APP_URL: 'https://mini.transferly.test/app',
    TELEGRAM_BOT_TOKEN: 'telegram-test-token',
    TELEGRAM_MINI_APP_AUTH_EXPIRES_IN_SECONDS: 3600,
    FRONTEND_URL: 'https://app.transferly.test',
    API_REQUEST_TIMEOUT_MS: 30000,
    JOB_WAIT_MS: 30000,
    AUTH_RATE_LIMIT_WINDOW_MS: 60000,
    AUTH_RATE_LIMIT_MAX: 20,
    API_RATE_LIMIT_WINDOW_MS: 60000,
    API_RATE_LIMIT_MAX: 120,
    ...overrides
  };
}

test('buildHealthPayload exposes API-safe operational checks', () => {
  const payload = buildHealthPayload({
    request: { id: 'request-123' },
    config: createConfig(),
    now: new Date('2026-08-09T12:00:00.000Z'),
    uptimeSeconds: 42.4
  });

  assert.deepEqual(payload, {
    ok: true,
    status: 'healthy',
    signals: {
      live: true,
      ready: true,
      degraded: false,
      unavailable: false
    },
    requestId: 'request-123',
    uptimeSeconds: 42,
    timestamp: '2026-08-09T12:00:00.000Z',
    environment: 'test',
    checks: {
      database: 'configured',
      queue: 'inline',
      corsOrigins: 1,
      telegramMiniAppUrl: true,
      telegramMiniAppAuth: true,
      requestTimeoutMs: 30000,
      jobWaitMs: 30000,
      authRateLimit: {
        windowMs: 60000,
        max: 20
      },
      apiRateLimit: {
        windowMs: 60000,
        max: 120
      }
    },
    degradedReasons: []
  });
});

test('buildClientHealthPayload reports degraded setup without exposing secrets', () => {
  const payload = buildClientHealthPayload({
    request: { id: 'request-456' },
    config: createConfig({
      TELEGRAM_MINI_APP_URL: '',
      TELEGRAM_BOT_TOKEN: '',
      CORS_ALLOWED_ORIGINS: []
    }),
    now: new Date('2026-08-09T12:30:00.000Z')
  });

  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'degraded');
  assert.equal(payload.contractVersion, '2026-08-client-health-v2');
  assert.equal(payload.requestId, 'request-456');
  assert.equal(payload.timestamp, '2026-08-09T12:30:00.000Z');
  assert.deepEqual(payload.signals, {
    live: true,
    ready: false,
    degraded: true,
    unavailable: false
  });
  assert.equal(payload.auth.telegramMiniApp.enabled, false);
  assert.equal(payload.auth.telegramMiniApp.launchUrlConfigured, false);
  assert.equal(payload.featureFlags.telegramMiniApp, false);
  assert.deepEqual(payload.reliability.degradedReasons, [
    'telegram_mini_app_url_missing',
    'telegram_mini_app_auth_missing'
  ]);
  assert.equal(payload.degraded, true);
  assert.deepEqual(payload.nextActions, [
    'Configure TELEGRAM_MINI_APP_URL before launching the Mini App in production.',
    'Configure TELEGRAM_BOT_TOKEN so Telegram Mini App sessions can be verified.'
  ]);
  assert.equal(JSON.stringify(payload).includes('telegram-test-token'), false);
});

test('createHttpRequestLogger logs sanitized request completion metadata', () => {
  const entries = [];
  const logger = {
    info(metadata, message) {
      entries.push({ metadata, message });
    }
  };
  const times = [1_000_000_000n, 1_024_600_000n];
  const requestLogger = createHttpRequestLogger({
    logger,
    getTime: () => times.shift()
  });
  const request = {
    id: 'request-789',
    correlationId: 'correlation-789',
    method: 'GET',
    originalUrl: '/api/orders?token=secret-value&page=2'
  };
  const response = new EventEmitter();
  response.statusCode = 200;
  let nextCalled = false;

  requestLogger(request, response, () => {
    nextCalled = true;
  });
  response.emit('finish');

  assert.equal(nextCalled, true);
  assert.deepEqual(entries, [
    {
      metadata: {
        requestId: 'request-789',
        correlationId: 'correlation-789',
        method: 'GET',
        route: '/api/orders',
        path: '/api/orders?token=%5BREDACTED%5D&page=2',
        statusCode: 200,
        latencyMs: 25,
        durationMs: 25
      },
      message: 'HTTP request completed'
    }
  ]);
});