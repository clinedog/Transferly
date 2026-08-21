const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createOperationalMetrics } = require('../core/observability/operationalMetrics');

test('operational metrics records requests, failures, latency, and safe recent failure metadata', () => {
  const dates = [
    new Date('2026-08-09T12:00:00.000Z'),
    new Date('2026-08-09T12:00:01.000Z'),
    new Date('2026-08-09T12:00:02.000Z')
  ];
  const metrics = createOperationalMetrics({ now: () => dates.shift() || new Date('2026-08-09T12:00:03.000Z') });

  metrics.recordRequest({ method: 'GET', route: '/api/health', statusCode: 200, durationMs: 20 });
  metrics.recordRequest({ method: 'POST', route: '/api/auth/telegram-mini-app', statusCode: 503, durationMs: 1250 });
  metrics.recordFailure({
    requestId: 'request-1',
    correlationId: 'correlation-1',
    method: 'POST',
    route: '/api/auth/telegram-mini-app',
    statusCode: 503,
    errorCode: 'SERVICE_UNAVAILABLE',
    failureClass: 'provider_failure',
    retryable: true,
    token: 'must-not-appear'
  });

  const snapshot = metrics.snapshot({ requestId: 'diagnostics-request', correlationId: 'diagnostics-correlation' });

  assert.equal(snapshot.requestId, 'diagnostics-request');
  assert.equal(snapshot.correlationId, 'diagnostics-correlation');
  assert.equal(snapshot.requests.total, 2);
  assert.equal(snapshot.requests.errors, 1);
  assert.equal(snapshot.requests.slow, 1);
  assert.equal(snapshot.requests.errorRate, 0.5);
  assert.equal(snapshot.requests.latencyMs.average, 635);
  assert.equal(snapshot.requests.latencyMs.max, 1250);
  assert.equal(snapshot.requests.byStatusClass['2xx'], 1);
  assert.equal(snapshot.requests.byStatusClass['5xx'], 1);
  assert.equal(snapshot.failures.byCode.SERVICE_UNAVAILABLE, 1);
  assert.equal(snapshot.failures.byClass.provider_failure, 1);
  assert.deepEqual(snapshot.recentFailures, [{
    at: '2026-08-09T12:00:01.000Z',
    requestId: 'request-1',
    correlationId: 'correlation-1',
    route: '/api/auth/telegram-mini-app',
    method: 'POST',
    statusCode: 503,
    errorCode: 'SERVICE_UNAVAILABLE',
    failureClass: 'provider_failure',
    retryable: true
  }]);
  assert.equal(JSON.stringify(snapshot).includes('must-not-appear'), false);
});