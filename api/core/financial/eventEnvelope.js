'use strict';

const { randomUUID } = require('node:crypto');
const { AppError } = require('../../utils/errors');

function requiredString(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new AppError(422, 'FINANCIAL_EVENT_FIELD_REQUIRED', `${field} is required.`);
  }
  return normalized;
}

function buildEventEnvelope(input = {}) {
  const eventType = requiredString(input.eventType, 'eventType');
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)+$/i.test(eventType)) {
    throw new AppError(422, 'FINANCIAL_EVENT_TYPE_INVALID', 'eventType must be a namespaced event identifier.');
  }

  const version = Number(input.version || 1);
  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new AppError(422, 'FINANCIAL_EVENT_VERSION_INVALID', 'Event version must be a positive integer.');
  }

  const occurredAt = input.occurredAt || new Date().toISOString();
  if (!Number.isFinite(new Date(occurredAt).getTime())) {
    throw new AppError(422, 'FINANCIAL_EVENT_TIMESTAMP_INVALID', 'occurredAt must be a valid timestamp.');
  }

  return Object.freeze({
    eventId: String(input.eventId || randomUUID()).trim(),
    eventType,
    version,
    occurredAt: new Date(occurredAt).toISOString(),
    tenantId: input.tenantId ? String(input.tenantId).trim() : null,
    actorId: input.actorId ? String(input.actorId).trim() : null,
    resourceId: input.resourceId ? String(input.resourceId).trim() : null,
    correlationId: requiredString(input.correlationId, 'correlationId'),
    causationId: input.causationId ? String(input.causationId).trim() : null,
    payload: Object.freeze({ ...(input.payload || {}) })
  });
}

module.exports = {
  buildEventEnvelope
};
