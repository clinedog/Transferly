const { ZodError } = require('zod');

const { buildRecoveryHint, classifyFailure } = require('../core/reliability/failureClassification');
const { operationalMetrics } = require('../core/observability/operationalMetrics');
const { AppError, isAppError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { sanitizeRequestUrl } = require('../utils/sanitizeRequestUrl');

function buildErrorResponse(error, request, overrides = {}) {
  const classification = classifyFailure(error);
  const recovery = buildRecoveryHint(classification, {
    retryAfter: overrides.retryAfter || error?.retryAfter || null
  });

  return {
    code: error.code,
    message: error.message,
    details: error.details,
    classification: classification.class,
    retryable: classification.retryable,
    recovery,
    requestId: request.id,
    correlationId: request.correlationId
  };
}

function recordErrorMetric(error, request, statusCode) {
  const classification = classifyFailure(error);
  operationalMetrics.recordFailure({
    requestId: request.id,
    correlationId: request.correlationId,
    route: sanitizeRequestUrl(request.originalUrl),
    method: request.method,
    statusCode,
    errorCode: error.code,
    failureClass: classification.class,
    retryable: classification.retryable
  });
}

function notFoundHandler(request, response) {
  operationalMetrics.recordFailure({
    requestId: request.id,
    correlationId: request.correlationId,
    route: sanitizeRequestUrl(request.originalUrl),
    method: request.method,
    statusCode: 404,
    errorCode: 'NOT_FOUND',
    failureClass: 'validation_failure',
    retryable: false
  });
  response.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${request.method} ${sanitizeRequestUrl(request.originalUrl)} not found.`,
    requestId: request.id,
    correlationId: request.correlationId
  });
}

function errorHandler(error, request, response, _next) {
  if (isAppError(error)) {
    recordErrorMetric(error, request, error.statusCode);
    response.status(error.statusCode).json(buildErrorResponse(error, request));
    return;
  }

  if (error instanceof ZodError) {
    const validationError = new AppError(400, 'VALIDATION_ERROR', error.message, error.flatten());
    recordErrorMetric(validationError, request, 400);
    response.status(400).json(buildErrorResponse(validationError, request));
    return;
  }

  logger.error(
    {
      err: error,
      requestId: request.id,
      correlationId: request.correlationId,
      route: sanitizeRequestUrl(request.originalUrl)
    },
    'Unhandled request error'
  );

  const internalError = new AppError(500, 'INTERNAL_ERROR', 'Internal server error.');
  recordErrorMetric(internalError, request, internalError.statusCode);
  response.status(internalError.statusCode).json(buildErrorResponse(internalError, request));
}

module.exports = {
  buildErrorResponse,
  notFoundHandler,
  errorHandler
};
