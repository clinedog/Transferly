'use strict';

const { AppError } = require('../../utils/errors');
const { TOOL_LIFECYCLE, normalizeToolManifest } = require('./toolContract');

function createToolRegistry() {
  const tools = new Map();

  function register(input) {
    const manifest = normalizeToolManifest(input);
    const existing = tools.get(manifest.toolId);
    if (existing && existing.version !== manifest.version) {
      throw new AppError(409, 'TOOL_VERSION_CONFLICT', 'A different version of this tool is already registered.', {
        toolId: manifest.toolId,
        existingVersion: existing.version,
        requestedVersion: manifest.version
      });
    }
    tools.set(manifest.toolId, manifest);
    return manifest;
  }

  function get(toolId) {
    const manifest = tools.get(String(toolId || '').trim());
    if (!manifest) {
      throw new AppError(404, 'TOOL_NOT_FOUND', 'Tool was not found.', { toolId });
    }
    return manifest;
  }

  function setLifecycle(toolId, lifecycle) {
    if (![TOOL_LIFECYCLE.ENABLED, TOOL_LIFECYCLE.DISABLED, TOOL_LIFECYCLE.DEPRECATED].includes(lifecycle)) {
      throw new AppError(422, 'TOOL_LIFECYCLE_INVALID', 'Tool lifecycle state is invalid.');
    }
    const manifest = get(toolId);
    const updated = Object.freeze({ ...manifest, lifecycle });
    tools.set(manifest.toolId, updated);
    return updated;
  }

  function list({ lifecycle } = {}) {
    return [...tools.values()].filter((tool) => !lifecycle || tool.lifecycle === lifecycle);
  }

  return Object.freeze({ register, get, setLifecycle, list });
}

module.exports = { createToolRegistry };
