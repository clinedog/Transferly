const crypto = require('node:crypto');

const config = require('../config');
const { AppError } = require('../utils/errors');

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function buildSignature({ timestamp, rawBody, secret }) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
}

function verifyHmacWebhook({ provider, headers = {}, rawBody = '' }) {
  const secret = provider === 'opay' ? config.OPAY_WEBHOOK_SECRET : config.OPAY_WEBHOOK_SECRET;
  if (!config.PAYMENT_VERIFICATION.enabled) {
    throw new AppError(503, 'PAYMENT_VERIFICATION_DISABLED', 'Automatic payment verification is disabled.');
  }
  if (!secret) {
    throw new AppError(503, 'PAYMENT_WEBHOOK_SECRET_NOT_CONFIGURED', 'Payment webhook secret is not configured.');
  }

  const timestamp = headers['x-transferly-payment-timestamp'] || headers['x-opay-timestamp'];
  const signature = headers['x-transferly-payment-signature'] || headers['x-opay-signature'];
  if (!timestamp || !signature) {
    throw new AppError(400, 'PAYMENT_WEBHOOK_SIGNATURE_REQUIRED', 'Payment webhook signature and timestamp are required.');
  }
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) {
    throw new AppError(400, 'PAYMENT_WEBHOOK_TIMESTAMP_INVALID', 'Payment webhook timestamp is invalid.');
  }
  const ageSeconds = Math.abs(Date.now() - timestampMs) / 1000;
  if (ageSeconds > config.PAYMENT_VERIFICATION.webhookTimestampToleranceSeconds) {
    throw new AppError(400, 'PAYMENT_WEBHOOK_REPLAY_REJECTED', 'Payment webhook timestamp is outside the replay window.');
  }
  const expected = buildSignature({ timestamp, rawBody, secret });
  if (!safeEqual(expected, signature)) {
    throw new AppError(400, 'PAYMENT_WEBHOOK_SIGNATURE_INVALID', 'Payment webhook signature is invalid.');
  }
  return { signature_header_present: true, timestamp, provider };
}

function normalizeTransaction(provider, event = {}) {
  const data = event.data || event.transaction || event;
  const providerTransactionId = String(data.providerTransactionId || data.transactionId || data.id || data.reference || '').trim();
  if (!providerTransactionId) {
    throw new AppError(400, 'PAYMENT_TRANSACTION_ID_REQUIRED', 'Payment transaction id is required.');
  }
  return {
    provider,
    providerTransactionId,
    providerReference: String(data.providerReference || data.reference || data.paymentReference || '').trim() || null,
    eventId: String(event.eventId || event.id || providerTransactionId).trim(),
    amountMinor: Number(data.amountMinor ?? data.amount_minor ?? data.amount ?? 0),
    currency: String(data.currency || 'NGN').trim().toUpperCase(),
    status: String(data.status || 'UNKNOWN').trim().toUpperCase(),
    transactionTime: data.transactionTime || data.paidAt || data.createdAt || new Date().toISOString(),
    destination: data.destination || {},
    sender: data.sender || {},
    metadata: {
      event_type: event.eventType || event.type || null,
      raw_status: data.status || null
    }
  };
}

module.exports = {
  paymentProviderService: {
    normalizeTransaction,
    verifyHmacWebhook,
    buildSignature
  }
};