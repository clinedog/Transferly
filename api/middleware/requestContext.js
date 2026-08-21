const { randomUUID } = require('node:crypto');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function normalizeRequestId(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return REQUEST_ID_PATTERN.test(trimmed) ? trimmed : null;
}

function assignRequestId(request, response, next) {
  request.id = normalizeRequestId(request.headers['x-request-id']) || randomUUID();
  request.correlationId = normalizeRequestId(request.headers['x-correlation-id']) || request.id;
  response.setHeader('x-request-id', request.id);
  response.setHeader('x-correlation-id', request.correlationId);
  next();
}

module.exports = {
  assignRequestId,
  normalizeRequestId
};
