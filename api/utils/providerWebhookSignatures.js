const crypto = require('node:crypto');

const { AppError } = require('./errors');

const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

function parseSignatureHeader(headerValue) {
  return String(headerValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((parts, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return parts;
      }

      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      parts[key] = parts[key] || [];
      parts[key].push(value);
      return parts;
    }, {});
}

function assertFreshTimestamp(timestamp, toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS) {
  const webhookTimestamp = Number(timestamp);
  if (!Number.isFinite(webhookTimestamp)) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature timestamp is invalid.');
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - webhookTimestamp);
  if (ageSeconds > toleranceSeconds) {
    throw new AppError(400, 'WEBHOOK_SIGNATURE_EXPIRED', 'Webhook signature timestamp is outside the allowed tolerance.');
  }
}

function safeCompareHex(expected, candidates) {
  const expectedBuffer = Buffer.from(expected, 'hex');
  return candidates.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, 'hex');
    return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    throw new AppError(503, 'STRIPE_WEBHOOK_NOT_CONFIGURED', 'Stripe webhook secret is not configured.');
  }

  const parts = parseSignatureHeader(signatureHeader);
  const timestamp = parts.t && parts.t[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Stripe signature header is incomplete.');
  }

  assertFreshTimestamp(timestamp);
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  if (!safeCompareHex(expected, signatures)) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Stripe webhook signature verification failed.');
  }
}

function normalizeHeaderLookup(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value || '')]));
}

function verifyCoinbaseWebhookSignature(rawBody, signatureHeader, secret, headers = {}) {
  if (!secret) {
    throw new AppError(503, 'CRYPTO_WEBHOOK_NOT_CONFIGURED', 'Crypto Commerce webhook secret is not configured.');
  }

  const parts = parseSignatureHeader(signatureHeader);
  const timestamp = parts.t && parts.t[0];
  const headerNames = parts.h && parts.h[0];
  const signatures = parts.v1 || [];
  if (!timestamp || !headerNames || signatures.length === 0) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Coinbase webhook signature header is incomplete.');
  }

  assertFreshTimestamp(timestamp);
  const normalizedHeaders = normalizeHeaderLookup(headers);
  const headerValues = headerNames
    .split(' ')
    .map((name) => normalizedHeaders[name.toLowerCase()] || '')
    .join('.');
  const signedPayload = `${timestamp}.${headerNames}.${headerValues}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  if (!safeCompareHex(expected, signatures)) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Coinbase webhook signature verification failed.');
  }
}

/**
 * Verify a Paystack webhook signature.
 * Paystack signs with HMAC-SHA512 of the raw body using the secret key.
 * Header: X-Paystack-Signature (hex digest)
 *
 * @param {string|Buffer} rawBody
 * @param {string} signatureHeader
 * @param {string} secret  PAYSTACK_SECRET_KEY
 */
function verifyPaystackSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    throw new AppError(503, 'PAYSTACK_WEBHOOK_NOT_CONFIGURED', 'Paystack secret key is not configured.');
  }
  if (!signatureHeader) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'X-Paystack-Signature header is required.');
  }
  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  const sigBuf = Buffer.from(signatureHeader.toLowerCase(), 'hex');
  const expBuf = Buffer.from(expected.toLowerCase(), 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Paystack webhook signature verification failed.');
  }
}

/**
 * Verify a Flutterwave webhook signature.
 * Flutterwave sends the secret hash in the verif-hash header; compare directly.
 *
 * @param {string} receivedHash
 * @param {string} secret  FLUTTERWAVE_WEBHOOK_SECRET
 */
function verifyFlutterwaveSignature(receivedHash, secret) {
  if (!secret) {
    throw new AppError(503, 'FLUTTERWAVE_WEBHOOK_NOT_CONFIGURED', 'Flutterwave webhook secret is not configured.');
  }
  if (!receivedHash) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'verif-hash header is required.');
  }
  const a = Buffer.from(secret, 'utf8');
  const b = Buffer.from(receivedHash, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Flutterwave webhook signature verification failed.');
  }
}

/**
 * Verify a Wise webhook RSA-SHA256 signature.
 * Wise signs with their private key; we verify with their published public key (PEM).
 * Header: X-Signature-SHA256 (base64-encoded RSA signature)
 *
 * @param {string|Buffer} rawBody
 * @param {string} signatureHeader  Base64-encoded signature
 * @param {string} publicKeyPem     Wise webhook public key PEM
 */
function verifyWiseSignature(rawBody, signatureHeader, publicKeyPem) {
  if (!publicKeyPem) {
    throw new AppError(503, 'WISE_WEBHOOK_NOT_CONFIGURED', 'Wise webhook public key is not configured.');
  }
  if (!signatureHeader) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'X-Signature-SHA256 header is required.');
  }
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const sig = Buffer.from(signatureHeader, 'base64');
  // Try PSS first (newer Wise endpoints), fall back to PKCS1v15
  let valid = false;
  try {
    valid = crypto.verify('sha256', body, { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING }, sig);
  } catch {
    try {
      valid = crypto.verify('sha256WithRSAEncryption', body, publicKeyPem, sig);
    } catch {
      valid = false;
    }
  }
  if (!valid) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Wise webhook signature verification failed.');
  }
}

module.exports = {
  verifyStripeSignature,
  verifyCoinbaseWebhookSignature,
  verifyPaystackSignature,
  verifyFlutterwaveSignature,
  verifyWiseSignature
};
