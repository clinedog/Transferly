'use strict';

const { randomUUID } = require('node:crypto');
const { AppError } = require('../../utils/errors');
const {
  OPERATION_BY_TRANSACTION_TYPE,
  normalizeProviderKey,
  normalizeTransactionType
} = require('./providerContract');

const OPERATION_CONTEXT_VERSION = 1;

function requiredString(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new AppError(422, 'FINANCIAL_OPERATION_CONTEXT_INVALID', `${field} is required.`, { field });
  }
  return normalized;
}

function createOperationContext(input = {}) {
  const transactionType = normalizeTransactionType(input.transactionType || input.type);
  if (!transactionType || !OPERATION_BY_TRANSACTION_TYPE[transactionType]) {
    throw new AppError(422, 'FINANCIAL_TRANSACTION_TYPE_INVALID', 'A supported financial transaction type is required.', {
      transactionType: input.transactionType || input.type || null
    });
  }

  const actorId = requiredString(input.actorId || input.userId, 'actorId');
  const operationId = requiredString(input.operationId || randomUUID(), 'operationId');
  const idempotencyKey = requiredString(input.idempotencyKey, 'idempotencyKey');
  const provider = input.provider ? normalizeProviderKey(input.provider) : null;

  return Object.freeze({
    version: OPERATION_CONTEXT_VERSION,
    operationId,
    transactionType,
    operation: OPERATION_BY_TRANSACTION_TYPE[transactionType],
    actorId,
    tenantId: input.tenantId ? requiredString(input.tenantId, 'tenantId') : null,
    provider,
    environment: input.environment || 'production',
    idempotencyKey,
    requestHash: input.requestHash || null,
    resourceId: input.resourceId || null,
    metadata: Object.freeze({ ...(input.metadata || {}) })
  });
}

function createExecutionResult(context, input = {}) {
  if (!context || context.version !== OPERATION_CONTEXT_VERSION) {
    throw new AppError(500, 'FINANCIAL_EXECUTION_CONTEXT_INVALID', 'A valid financial operation context is required.');
  }

  const status = requiredString(input.status, 'status').toUpperCase();
  return Object.freeze({
    version: OPERATION_CONTEXT_VERSION,
    operationId: context.operationId,
    transactionType: context.transactionType,
    operation: context.operation,
    status,
    authoritative: input.authoritative === true,
    resourceId: input.resourceId || context.resourceId || null,
    provider: input.provider || context.provider || null,
    providerRequestId: input.providerRequestId || null,
    reconciliationRequired: input.reconciliationRequired === true,
    data: input.data || null,
    error: input.error || null
  });
}

module.exports = {
  OPERATION_CONTEXT_VERSION,
  createOperationContext,
  createExecutionResult
};
