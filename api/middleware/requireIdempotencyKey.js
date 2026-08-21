const { AppError } = require('../utils/errors');

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

function requireIdempotencyKey(request, _response, next) {
  const idempotencyKey = request.headers['idempotency-key'];
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    next(new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.'));
    return;
  }

  const normalized = idempotencyKey.trim();
  if (!normalized || normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    next(
      new AppError(
        400,
        'IDEMPOTENCY_KEY_INVALID',
        `Idempotency-Key must be between 1 and ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`
      )
    );
    return;
  }

  request.idempotencyKey = normalized;
  next();
}

module.exports = {
  requireIdempotencyKey
};
