'use strict';

const { AppError } = require('../../utils/errors');
const { PLUGIN_LIFECYCLE, normalizePluginManifest } = require('./pluginContract');

function createPluginRegistry() {
  const plugins = new Map();

  function register(input) {
    const manifest = normalizePluginManifest(input);
    const existing = plugins.get(manifest.pluginId);
    if (existing && existing.version !== manifest.version) {
      throw new AppError(409, 'PLUGIN_VERSION_CONFLICT', 'A different plugin version is already registered.', {
        pluginId: manifest.pluginId,
        existingVersion: existing.version,
        requestedVersion: manifest.version
      });
    }
    plugins.set(manifest.pluginId, manifest);
    return manifest;
  }

  function get(pluginId) {
    const plugin = plugins.get(String(pluginId || '').trim());
    if (!plugin) throw new AppError(404, 'PLUGIN_NOT_FOUND', 'Plugin was not found.', { pluginId });
    return plugin;
  }

  function verify(pluginId) {
    const plugin = get(pluginId);
    const verified = Object.freeze({ ...plugin, verified: true, lifecycle: PLUGIN_LIFECYCLE.VERIFIED });
    plugins.set(plugin.pluginId, verified);
    return verified;
  }

  function setLifecycle(pluginId, lifecycle) {
    const plugin = get(pluginId);
    if (![PLUGIN_LIFECYCLE.CONFIGURED, PLUGIN_LIFECYCLE.ENABLED, PLUGIN_LIFECYCLE.DISABLED, PLUGIN_LIFECYCLE.REVOKED].includes(lifecycle)) {
      throw new AppError(422, 'PLUGIN_LIFECYCLE_INVALID', 'Plugin lifecycle state is invalid.');
    }
    if (lifecycle === PLUGIN_LIFECYCLE.ENABLED && !plugin.verified) {
      throw new AppError(409, 'PLUGIN_VERIFICATION_REQUIRED', 'Plugin verification is required before enablement.');
    }
    const updated = Object.freeze({ ...plugin, lifecycle });
    plugins.set(plugin.pluginId, updated);
    return updated;
  }

  function list({ lifecycle } = {}) {
    return [...plugins.values()].filter((plugin) => !lifecycle || plugin.lifecycle === lifecycle);
  }

  return Object.freeze({ register, get, verify, setLifecycle, list });
}

module.exports = { createPluginRegistry };
