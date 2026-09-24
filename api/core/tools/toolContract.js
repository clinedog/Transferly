'use strict';

const { AppError } = require('../../utils/errors');

const TOOL_LIFECYCLE = Object.freeze({
  ENABLED: 'ENABLED',
  DISABLED: 'DISABLED',
  DEPRECATED: 'DEPRECATED'
});

const TOOL_RISK_CLASS = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

const CONFIRMATION_POLICY = Object.freeze({
  NONE: 'NONE',
  USER: 'USER',
  ADMIN: 'ADMIN',
  DUAL_CONTROL: 'DUAL_CONTROL'
});

const IDEMPOTENCY_POLICY = Object.freeze({
  REQUIRED: 'REQUIRED',
  OPTIONAL: 'OPTIONAL',
  NONE: 'NONE'
});

function required(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new AppError(422, 'TOOL_FIELD_REQUIRED', `${field} is required.`);
  }
  return normalized;
}

function normalizeToolManifest(input = {}) {
  const toolId = required(input.toolId, 'toolId');
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)+$/i.test(toolId)) {
    throw new AppError(422, 'TOOL_ID_INVALID', 'toolId must be a namespaced identifier.');
  }

  const version = required(input.version, 'version');
  const permissions = Array.isArray(input.permissions) ? [...new Set(input.permissions.map((entry) => required(entry, 'permission')))] : [];
  const scopes = Array.isArray(input.scopes) ? [...new Set(input.scopes.map((entry) => required(entry, 'scope')))] : [];
  const environments = Array.isArray(input.supportedEnvironments) ? [...new Set(input.supportedEnvironments.map((entry) => required(entry, 'environment')))] : ['sandbox'];
  const riskClass = String(input.riskClass || TOOL_RISK_CLASS.LOW).trim().toUpperCase();
  const confirmationPolicy = String(input.confirmationPolicy || CONFIRMATION_POLICY.NONE).trim().toUpperCase();
  const idempotencyPolicy = String(input.idempotencyPolicy || IDEMPOTENCY_POLICY.REQUIRED).trim().toUpperCase();

  if (!Object.values(TOOL_RISK_CLASS).includes(riskClass)) {
    throw new AppError(422, 'TOOL_RISK_CLASS_INVALID', 'Tool risk class is invalid.');
  }
  if (!Object.values(CONFIRMATION_POLICY).includes(confirmationPolicy)) {
    throw new AppError(422, 'TOOL_CONFIRMATION_POLICY_INVALID', 'Tool confirmation policy is invalid.');
  }
  if (!Object.values(IDEMPOTENCY_POLICY).includes(idempotencyPolicy)) {
    throw new AppError(422, 'TOOL_IDEMPOTENCY_POLICY_INVALID', 'Tool idempotency policy is invalid.');
  }
  if (riskClass === TOOL_RISK_CLASS.CRITICAL && confirmationPolicy === CONFIRMATION_POLICY.NONE) {
    throw new AppError(422, 'TOOL_CONFIRMATION_REQUIRED', 'Critical tools require explicit confirmation.');
  }

  return Object.freeze({
    toolId,
    version,
    name: required(input.name, 'name'),
    description: required(input.description, 'description'),
    inputSchema: Object.freeze({ ...(input.inputSchema || {}) }),
    outputSchema: Object.freeze({ ...(input.outputSchema || {}) }),
    permissions: Object.freeze(permissions),
    scopes: Object.freeze(scopes),
    supportedEnvironments: Object.freeze(environments),
    capabilityRequirements: Object.freeze([...(input.capabilityRequirements || [])]),
    riskClass,
    idempotencyPolicy,
    confirmationPolicy,
    timeoutMs: Number(input.timeoutMs || 30000),
    retryPolicy: Object.freeze({ ...(input.retryPolicy || {}) }),
    auditPolicy: Object.freeze({ required: input.auditPolicy?.required !== false }),
    lifecycle: input.lifecycle || TOOL_LIFECYCLE.DISABLED
  });
}

module.exports = {
  TOOL_LIFECYCLE,
  TOOL_RISK_CLASS,
  CONFIRMATION_POLICY,
  IDEMPOTENCY_POLICY,
  normalizeToolManifest
};
