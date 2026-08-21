const { createHmac, timingSafeEqual } = require('node:crypto');

const { decodeBase64Url, encodeBase64Url } = require('./base64url');
const { AppError } = require('./errors');

function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseJsonPart(value) {
  try {
    return JSON.parse(decodeBase64Url(value));
  } catch (_error) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signJwt(payload, secret, expiresInSeconds, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    ...(options.notBeforeSeconds ? { nbf: now + options.notBeforeSeconds } : {}),
    exp: now + expiresInSeconds
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  return `${encodedHeader}.${encodedPayload}.${toBase64Url(signature)}`;
}

function verifyJwt(token, secret, options = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonPart(encodedHeader);
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  if (!safeEqual(encodedSignature, toBase64Url(expectedSignature))) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }

  const payload = parseJsonPart(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  const clockSkewSeconds = Number.isFinite(options.clockSkewSeconds)
    ? Math.max(0, options.clockSkewSeconds)
    : 30;

  if (!Number.isFinite(Number(payload.iat))) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }

  if (!Number.isFinite(Number(payload.exp))) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }

  if (Number(payload.nbf) && Number(payload.nbf) > now + clockSkewSeconds) {
    throw new AppError(401, 'TOKEN_NOT_ACTIVE', 'Authentication token is not active yet.');
  }

  if (Number(payload.exp) < now - clockSkewSeconds) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Authentication token has expired.');
  }

  return payload;
}

module.exports = {
  signJwt,
  verifyJwt
};
