'use strict';

const { createExecutionResult } = require('./operationContext');
const { AppError } = require('../../utils/errors');
const { idempotencyRepository: defaultIdempotencyRepository } = require('../../repositories/idempotencyRepository');

function replayOrThrow(record, context) {
  if (!record) return null;

  if (record.requestHash && context.requestHash && record.requestHash !== context.requestHash) {
    throw new AppError(409, 'FINANCIAL_IDEMPOTENCY_CONFLICT',
      'The idempotency key was already used with a different request.', {
        operation: context.operation,
        idempotencyKey: context.idempotencyKey
      });
  }

  if (record.responsePayload) {
    return record.responsePayload;
  }

  throw new AppError(409, 'FINANCIAL_OPERATION_IN_PROGRESS',
    'A request with this idempotency key is already being processed.', {
      operationId: record.id || context.operationId
    });
}

async function claimOperation(context, repository) {
  const existing = await repository.findByUserOperationAndKey(
    context.actorId,
    context.operation,
    context.idempotencyKey
  );
  const replay = replayOrThrow(existing, context);
  if (replay) return { replay, claimed: false };

  try {
    const record = await repository.create({
      userId: context.actorId,
      operation: context.operation,
      idempotencyKey: context.idempotencyKey,
      requestHash: context.requestHash || '',
      responseStatus: null,
      responsePayload: null
    });
    return { record, claimed: true };
  } catch (error) {
    const raced = await repository.findByUserOperationAndKey(
      context.actorId,
      context.operation,
      context.idempotencyKey
    );
    const replayAfterRace = replayOrThrow(raced, context);
    if (replayAfterRace) return { replay: replayAfterRace, claimed: false };
    throw error;
  }
}

async function executeFinancialOperation({
  context,
  execute,
  idempotencyRepository = defaultIdempotencyRepository
} = {}) {
  if (!context || typeof execute !== 'function') {
    throw new AppError(500, 'FINANCIAL_EXECUTION_INVALID', 'Operation context and execute function are required.');
  }

  const claim = await claimOperation(context, idempotencyRepository);
  if (!claim.claimed) return claim.replay;

  const execution = await execute(context);
  const result = createExecutionResult(context, execution);
  await idempotencyRepository.updateResponse(
    context.actorId,
    context.operation,
    context.idempotencyKey,
    {
      responseStatus: execution.responseStatus || 200,
      responsePayload: result
    }
  );
  return result;
}

module.exports = {
  executeFinancialOperation
};
