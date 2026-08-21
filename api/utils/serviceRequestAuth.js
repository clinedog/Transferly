const crypto = require('node:crypto');

const { stableStringify } = require('./canonicalJson');
const { AppError } = require('./errors');

const SIGNATURE_HEADER = 'x-api-signature';
const TIMESTAMP_HEADER = 'x-api-timestamp';
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_REPLAY_CACHE_SIZE = 5000;
const replayCache = new Map();

function normalizeBody(body, method = 'GET') {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  if (['GET', 'HEAD'].includes(normalizedMethod)) {
    return '';
  }
  if (body === undefined || body === null) {
    return '';
  }
  if (Buffer.isBuffer(body)) {
    return normalizeBody(body.toString('utf8'), method);
  }
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return stableStringify(JSON.parse(trimmed));
      } catch (_error) {
        return body;
      }
    }
    return body;
  }
  if (typeof body === 'object') {
    return stableStringify(body);
  }
  return JSON.stringify(body);
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(String(left || '')) || !/^[a-f0-9]{64}$/i.test(String(right || ''))) {
    return false;
  }
  const leftBuffer = Buffer.from(String(left), 'hex');
  const rightBuffer = Buffer.from(String(right), 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function buildSignature(secret, timestamp, method, pathWithQuery, body) {
  const payload = `${timestamp}.${String(method || 'GET').toUpperCase()}.${pathWithQuery}.${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function pruneReplayCache(now = Date.now()) {
  for (const [key, expiresAt] of replayCache.entries()) {
    if (expiresAt <= now || replayCache.size > MAX_REPLAY_CACHE_SIZE) {
      replayCache.delete(key);
    }
  }
}

function assertNotReplayed(signature, timestamp, maxAgeMs, now = Date.now()) {
  pruneReplayCache(now);
  const replayKey = `${timestamp}:${signature}`;
  if (replayCache.has(replayKey)) {
    throw new AppError(401, 'BOT_API_REPLAY_REJECTED', 'Duplicate service request signature rejected.');
  }
  replayCache.set(replayKey, now + maxAgeMs);
}

function buildReplayKey(signature, timestamp) {
  return `${timestamp}:${signature}`;
}

function verifyServiceRequestSignature(request, options = {}) {
  const secret = options.secret;
  if (!secret) {
    throw new AppError(503, 'BOT_API_AUTH_NOT_CONFIGURED', 'Service request authentication is not configured.');
  }

  const timestamp = request.get ? request.get(TIMESTAMP_HEADER) : request.headers?.[TIMESTAMP_HEADER];
  const signature = request.get ? request.get(SIGNATURE_HEADER) : request.headers?.[SIGNATURE_HEADER];
  if (!timestamp || !signature) {
    throw new AppError(401, 'BOT_API_SIGNATURE_MISSING', 'Service request signature is required.');
  }

  const timestampMs = Number(timestamp);
  const now = options.now || Date.now();
  const maxAgeMs = Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : DEFAULT_MAX_AGE_MS;
  if (!Number.isSafeInteger(timestampMs) || timestampMs <= 0) {
    throw new AppError(401, 'BOT_API_TIMESTAMP_INVALID', 'Service request timestamp is invalid.');
  }
  if (Math.abs(now - timestampMs) > maxAgeMs) {
    throw new AppError(401, 'BOT_API_TIMESTAMP_EXPIRED', 'Service request timestamp is outside the allowed window.');
  }

  const method = String(request.method || 'GET').toUpperCase();
  const pathWithQuery = request.originalUrl || request.url || '/';
  const body = normalizeBody(request.rawBody ?? request.body, method);
  const expectedSignature = buildSignature(secret, timestamp, method, pathWithQuery, body);

  if (!safeEqualHex(signature, expectedSignature)) {
    throw new AppError(401, 'BOT_API_SIGNATURE_INVALID', 'Service request signature is invalid.');
  }

  const replayKey = buildReplayKey(signature, timestamp);
  if (options.replayProtection !== false) {
    assertNotReplayed(signature, timestamp, maxAgeMs, now);
  }

  return {
    method,
    path: pathWithQuery,
    replayKey,
    timestampMs
  };
}

async function verifyServiceRequestSignatureAsync(request, options = {}) {
  const replayProtection = options.replayProtection !== false;
  const result = verifyServiceRequestSignature(request, {
    ...options,
    replayProtection: false
  });

  if (!replayProtection) {
    return result;
  }

  if (!options.replayStore) {
    assertNotReplayed(
      request.get ? request.get(SIGNATURE_HEADER) : request.headers?.[SIGNATURE_HEADER],
      request.get ? request.get(TIMESTAMP_HEADER) : request.headers?.[TIMESTAMP_HEADER],
      Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : DEFAULT_MAX_AGE_MS,
      options.now || Date.now()
    );
    return result;
  }

  let accepted = false;
  try {
    accepted = await options.replayStore.checkAndStore(
      result.replayKey,
      Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : DEFAULT_MAX_AGE_MS
    );
  } catch (error) {
    error.code = error.code || 'BOT_API_REPLAY_STORE_UNAVAILABLE';
    throw new AppError(
      503,
      'BOT_API_REPLAY_STORE_UNAVAILABLE',
      'Service request replay protection is temporarily unavailable.'
    );
  }

  if (!accepted) {
    throw new AppError(401, 'BOT_API_REPLAY_REJECTED', 'Duplicate service request signature rejected.');
  }

  return result;
}

module.exports = {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  buildSignature,
  normalizeBody,
  stableStringify,
  verifyServiceRequestSignature,
  verifyServiceRequestSignatureAsync
};
