'use strict';

const { AppError } = require('../../utils/errors');
const { EXECUTION_STATUS, normalizeExecutionStatus } = require('./providerContract');

const MUTATING_OPERATION_PREFIXES = Object.freeze([
  'create',
  'send',
  'cancel',
  'refund',
  'transfer',
  'payout'
]);

function isMutatingOperation(operation) {
  const name = String(operation || '').trim().toLowerCase();
  return MUTATING_OPERATION_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function getOperationContract(provider, operation) {
  if (!provider || typeof provider.getAdapterContract !== 'function') {
    throw new AppError(500, 'PAYMENT_PROVIDER_CONTRACT_INVALID', 'Provider does not expose an adapter contract.');
  }

  const contract = provider.getAdapterContract();
  const operationContract = contract?.operations?.[operation];
  if (!operationContract) {
    throw new AppError(422, 'PAYMENT_PROVIDER_OPERATION_UNDECLARED',
      'Provider has not declared the requested operation.', {
        provider: contract.provider,
        operation
      });
  }

  return { contract, operationContract };
}

function assertProviderOperationReady(provider, operation, {
  environment = 'production',
  mutating = isMutatingOperation(operation)
} = {}) {
  const { contract, operationContract } = getOperationContract(provider, operation);
  const status = normalizeExecutionStatus(operationContract.status) || EXECUTION_STATUS.UNSUPPORTED;

  if (!contract.configured) {
    throw new AppError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED',
      'Provider credentials are not configured for this operation.', {
        provider: contract.provider,
        operation,
        missing_env: contract.missing_env || []
      });
  }

  if (status === EXECUTION_STATUS.DISABLED || status === EXECUTION_STATUS.MAINTENANCE ||
      status === EXECUTION_STATUS.DEGRADED) {
    throw new AppError(503, 'PAYMENT_PROVIDER_OPERATION_UNAVAILABLE',
      'Provider operation is temporarily unavailable.', {
        provider: contract.provider,
        operation,
        status
      });
  }

  if (status === EXECUTION_STATUS.UNSUPPORTED || status === EXECUTION_STATUS.PLANNED ||
      status === EXECUTION_STATUS.COMING_SOON || status === EXECUTION_STATUS.PREVIEW) {
    throw new AppError(422, 'PAYMENT_PROVIDER_OPERATION_NOT_READY',
      'Provider operation is not enabled for execution.', {
        provider: contract.provider,
        operation,
        status
      });
  }

  if (mutating && status !== EXECUTION_STATUS.LIVE &&
      !(status === EXECUTION_STATUS.SANDBOX && environment !== 'production')) {
    throw new AppError(409, 'PAYMENT_PROVIDER_ENVIRONMENT_MISMATCH',
      'Mutating provider operations require a live provider in production or a sandbox provider in a non-production environment.', {
        provider: contract.provider,
        operation,
        status,
        environment
      });
  }

  return Object.freeze({
    provider: contract.provider,
    operation,
    status,
    environment,
    mutating
  });
}

async function executeProviderOperation(provider, operation, input, options = {}) {
  const readiness = assertProviderOperationReady(provider, operation, options);
  const method = provider[operation];
  if (typeof method !== 'function') {
    throw new AppError(422, 'PAYMENT_PROVIDER_OPERATION_UNAVAILABLE',
      'Provider declared an operation without exposing its implementation.', {
        provider: readiness.provider,
        operation
      });
  }

  return method.call(provider, input);
}

module.exports = {
  isMutatingOperation,
  getOperationContract,
  assertProviderOperationReady,
  executeProviderOperation
};
