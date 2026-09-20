'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  sanitizeClientTelemetry,
  sanitizeTelemetryValue
} = require('../core/observability/clientTelemetry');

test('client telemetry redacts credential-like values and bounds fields', () => {
  const result = sanitizeClientTelemetry({
    event: 'route_render_error',
    message: 'authorization: Bearer super-secret-token',
    stack: 'token=private-value',
    route: '/dashboard',
    value: 123.4
  });

  assert.equal(result.message, 'authorization=[REDACTED]');
  assert.equal(result.stack, 'token=[REDACTED]');
  assert.equal(result.value, 123.4);
  assert.equal(sanitizeTelemetryValue('x'.repeat(100), 10).length, 10);
});
