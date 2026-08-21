'use strict';

/**
 * Crypto Commerce (Coinbase Commerce) webhook router — mounted at /webhooks/crypto
 *
 * Security contract:
 *  - Coinbase Commerce signs webhooks with HMAC-SHA256 using
 *    CRYPTO_COMMERCE_WEBHOOK_SECRET. The X-CC-Webhook-Signature header
 *    contains the hex digest over the raw request body.
 *  - Deduplication is by event id.
 *  - Return HTTP 200 immediately; heavy work is queued.
 *  - Never log the webhook secret, wallet addresses, or private keys.
 *
 * Docs: https://docs.cloud.coinbase.com/commerce/docs/webhooks-overview
 */

const crypto = require('node:crypto');
const express = require('express');
const { logger } = require('../../utils/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// Signature verification (HMAC-SHA256)
// ---------------------------------------------------------------------------

function verifyCryptoSignature(rawBody, sigHeader, secret) {
  if (!secret || !sigHeader) return false;
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(sigHeader.toLowerCase(), 'hex'),
      Buffer.from(expected.toLowerCase(), 'hex')
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

const seen = new Set();
const SEEN_MAX = 5000;

function isDuplicate(eventId) {
  if (!eventId) return false;
  if (seen.has(eventId)) return true;
  if (seen.size >= SEEN_MAX) seen.delete(seen.values().next().value);
  seen.add(eventId);
  return false;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

router.post('/', (req, res) => {
  const rawBody = req.rawBody || req.body;
  const sigHeader = req.headers['x-cc-webhook-signature'] || '';
  const secret = process.env.CRYPTO_COMMERCE_WEBHOOK_SECRET || '';

  if (secret) {
    const valid = verifyCryptoSignature(rawBody, sigHeader, secret);
    if (!valid) {
      logger.warn({ provider: 'crypto' }, 'crypto:webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    logger.warn({ provider: 'crypto' }, 'crypto:webhook CRYPTO_COMMERCE_WEBHOOK_SECRET not set — skipping verification (dev mode)');
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

  if (isDuplicate(eventId)) {
    logger.info({ provider: 'crypto', eventId, eventType }, 'crypto:webhook duplicate — skipping');
    return res.status(200).json({ ok: true, duplicate: true });
  }

  logger.info({ provider: 'crypto', eventId, eventType }, 'crypto:webhook received');

  setImmediate(() => {
    try {
      const { processWebhookEvent } = require('./jobs');
      processWebhookEvent({ data: { event } }).catch((err) => {
        logger.error({ err, provider: 'crypto', eventId, eventType }, 'crypto:webhook job failed');
      });
    } catch (err) {
      logger.error({ err, provider: 'crypto', eventId }, 'crypto:webhook job dispatch error');
    }
  });

  return res.status(200).json({ ok: true });
});

module.exports = router;
