'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPluginRegistry } = require('../core/plugins/pluginRegistry');
const {
  PLUGIN_LIFECYCLE,
  normalizePluginManifest
} = require('../core/plugins/pluginContract');

function plugin(overrides = {}) {
  return {
    pluginId: 'reports.exporter',
    version: '1.0.0',
    publisher: 'Transferly',
    displayName: 'Reports exporter',
    permissions: ['tool:reports.read'],
    capabilities: ['reporting'],
    supportedEnvironments: ['sandbox'],
    ...overrides
  };
}

test('normalizes a plugin manifest with explicit trust metadata', () => {
  const manifest = normalizePluginManifest(plugin({
    financialSideEffects: true,
    permissions: ['tool:payments.prepare']
  }));
  assert.equal(manifest.pluginId, 'reports.exporter');
  assert.equal(manifest.financialSideEffects, true);
  assert.equal(manifest.lifecycle, PLUGIN_LIFECYCLE.DISCOVERED);
});

test('financial plugins must declare approved tool access', () => {
  assert.throws(
    () => normalizePluginManifest(plugin({ financialSideEffects: true, permissions: ['ledger:write'] })),
    (error) => error.code === 'PLUGIN_FINANCIAL_ACCESS_INVALID'
  );
});

test('registry requires verification before enabling a plugin', () => {
  const registry = createPluginRegistry();
  const registered = registry.register(plugin());
  assert.throws(
    () => registry.setLifecycle(registered.pluginId, PLUGIN_LIFECYCLE.ENABLED),
    (error) => error.code === 'PLUGIN_VERIFICATION_REQUIRED'
  );
  registry.verify(registered.pluginId);
  const enabled = registry.setLifecycle(registered.pluginId, PLUGIN_LIFECYCLE.ENABLED);
  assert.equal(enabled.lifecycle, PLUGIN_LIFECYCLE.ENABLED);
  assert.equal(registry.list({ lifecycle: PLUGIN_LIFECYCLE.ENABLED }).length, 1);
});
