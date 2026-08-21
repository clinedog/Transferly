'use strict';

/**
 * Stripe webhook router — mounted at /webhooks/stripe
 *
 * Security contract:
 *  - Stripe-Signature header must be verified using the raw request body
 *    (Express raw body is available on req.rawBody set by the kernel).
 *  - Deduplication is by Stripe event id (idempotent processing).
 *  - Return HTTP 200 immediately; heavy work is queued.
 *  - Never log the webhook secret or raw card / payout data.
 *
 * Signature verification uses HMAC-SHA256 over the raw body with
 * STRIPE_WEBHOOK_SECRET. When the secret is not configured the handler
 * logs a warning and skips verification (development mode only).
 */

const crypto = require('node:crypto');
const express = require('express');
const { logger } = require('../../utils/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a Stripe webhook signature.
 *
 * Stripe sends: Stripe-Signature: t=<timestamp>,v1=<sig>
 *
 * @param {Buffer|string} rawBody
 * @param {string} sigHeader
 * @param {string} secret
 * @returns {boolean}
 */
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!secret || !sigHeader) return false;

  const parts = Object.fromEntries(
    sigHeader.split(',').map((part) => part.split('='))
  );
  const timestamp = parts.t;
  const signatures = sigHeader.split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Deduplication store (in-process; replace with Redis for multi-instance)
// ---------------------------------------------------------------------------

const seen = new Set();
const SEEN_MAX = 5000;

function isDuplicate(eventId) {
  if (!eventId) return false;
  if (seen.has(eventId)) return true;
  if (seen.size >= SEEN_MAX) {
    const first = seen.values().next().value;
    seen.delete(first);
  }
  seen.add(eventId);
  return false;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

router.post('/', (req, res) => {
  const rawBody = req.rawBody || req.body;
  const sigHeader = req.headers['stripe-signature'] || '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';

  // Signature verification
  if (secret) {
    const valid = verifyStripeSignature(rawBody, sigHeader, secret);
    if (!valid) {
      logger.warn({ provider: 'stripe' }, 'stripe:webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    logger.warn({ provider: 'stripe' }, 'stripe:webhook STRIPE_WEBHOOK_SECRET not set — skipping verification (dev mode)');
  }

  let event;
  try {
    event = typeof rawBody === 'string' || Buffer.isBuffer(rawBody)
      ? JSON.parse(rawBody.toString('utf8'))
      : rawBody;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const eventId = event?.id;
  const eventType = event?.type;

  // Deduplication
  if (isDuplicate(eventId)) {
    logger.info({ provider: 'stripe', eventId, eventType }, 'stripe:webhook duplicate — skipping');
    return res.status(200).json({ ok: true, duplicate: true });
  }

  logger.info({ provider: 'stripe', eventId, eventType }, 'stripe:webhook received');

  // Enqueue async processing — non-blocking
  setImmediate(() => {
    try {
      const { processWebhookEvent } = require('./jobs');
      processWebhookEvent({ data: { event } }).catch((err) => {
        logger.error({ err, provider: 'stripe', eventId, eventType }, 'stripe:webhook job failed');
      });
    } catch (err) {
      logger.error({ err, provider: 'stripe', eventId }, 'stripe:webhook job dispatch error');
    }
  });

  return res.status(200).json({ ok: true });
});

module.exports = router;
