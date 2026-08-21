const assert = require('node:assert/strict');
const { test } = require('node:test');

const { operationalMetrics } = require('../core/observability/operationalMetrics');
const { getOperationalDiagnostics } = require('../services/opsService');

test('operational diagnostics exposes safe API and queue visibility', async () => {
  operationalMetrics.reset();
  operationalMetrics.recordRequest({ method: 'GET', route: '/api/health', statusCode: 200, durationMs: 12 });
  operationalMetrics.recordFailure({
    requestId: 'request-denied',
    correlationId: 'correlation-denied',
    route: '/api/admin/diagnostics',
    method: 'GET',
    statusCode: 401,
    errorCode: 'ADMIN_AUTH_REQUIRED',
    failureClass: 'authentication_failure',
    retryable: false
  });

  const diagnostics = await getOperationalDiagnostics({
    requestId: 'request-admin-diagnostics',
    correlationId: 'correlation-admin-diagnostics',
    queueOverviewProvider: async () => ({
      generated_at: '2026-08-09T12:00:00.000Z',
      redis_status: 'ready',
      queues: [
        {
          key: 'dead_letter',
          name: 'dead-letter',
          counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 }
        }
      ]
    }),
    outboxSummaryProvider: async () => ({ pending: 2, leased: 1, dispatched: 8, failed: 1 })
  });

  assert.equal(diagnostics.requestId, 'request-admin-diagnostics');
  assert.equal(diagnostics.correlationId, 'correlation-admin-diagnostics');
  assert.match(diagnostics.status, /healthy|degraded/);
  assert.equal(diagnostics.signals.live, true);
  assert.equal(diagnostics.environment.nodeEnv, process.env.NODE_ENV || 'development');
  assert.equal(diagnostics.metrics.requests.total, 1);
  assert.equal(diagnostics.metrics.auth.denied, 1);
  assert.equal(diagnostics.metrics.failures.byCode.ADMIN_AUTH_REQUIRED, 1);
  assert.equal(diagnostics.queues.status === 'available' || diagnostics.queues.status === 'unavailable', true);
  assert.equal(diagnostics.outbox.status, 'available');
  assert.equal(diagnostics.outbox.counts.failed, 1);
  assert.equal(diagnostics.degradedReasons.includes('outbox_terminal_failures_present'), true);
  assert.equal(JSON.stringify(diagnostics).includes(process.env.ADMIN_API_TOKEN || 'admin-test-token'), false);
});