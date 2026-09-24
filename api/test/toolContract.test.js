'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONFIRMATION_POLICY,
  TOOL_LIFECYCLE,
  TOOL_RISK_CLASS,
  normalizeToolManifest
} = require('../core/tools/toolContract');
const { createToolRegistry } = require('../core/tools/toolRegistry');

function tool(overrides = {}) {
  return {
    toolId: 'payments.refund',
    version: '1.0.0',
    name: 'Refund payment',
    description: 'Creates a refund through the approved financial boundary.',
    permissions: ['payments:refund'],
    scopes: ['tenant:payments'],
    riskClass: TOOL_RISK_CLASS.HIGH,
    confirmationPolicy: CONFIRMATION_POLICY.ADMIN,
    ...overrides
  };
}

test('normalizes a tool manifest with explicit financial safety policies', () => {
  const manifest = normalizeToolManifest(tool());
  assert.equal(manifest.toolId, 'payments.refund');
  assert.equal(manifest.idempotencyPolicy, 'REQUIRED');
  assert.equal(manifest.auditPolicy.required, true);
  assert.deepEqual(manifest.permissions, ['payments:refund']);
});

test('critical tools cannot omit confirmation', () => {
  assert.throws(
    () => normalizeToolManifest(tool({
      riskClass: TOOL_RISK_CLASS.CRITICAL,
      confirmationPolicy: CONFIRMATION_POLICY.NONE
    })),
    (error) => error.code === 'TOOL_CONFIRMATION_REQUIRED'
  );
});

test('registry supports version-safe registration and lifecycle control', () => {
  const registry = createToolRegistry();
  const registered = registry.register(tool());
  assert.equal(registered.lifecycle, TOOL_LIFECYCLE.DISABLED);
  const enabled = registry.setLifecycle(registered.toolId, TOOL_LIFECYCLE.ENABLED);
  assert.equal(enabled.lifecycle, TOOL_LIFECYCLE.ENABLED);
  assert.equal(registry.list({ lifecycle: TOOL_LIFECYCLE.ENABLED }).length, 1);
  assert.throws(
    () => registry.register(tool({ version: '2.0.0' })),
    (error) => error.code === 'TOOL_VERSION_CONFLICT'
  );
});
