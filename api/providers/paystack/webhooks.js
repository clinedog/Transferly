'use strict';

/**
 * Paystack webhook router — mounted at /webhooks/paystack
 *
 * Security:  HMAC-SHA512 via verifyPaystackSignature (providerWebhookSignatures.js)
 * Dedup:     DB-backed via webhookEventRepository unique constraint on event_id
 * Response:  202 first receipt, 200 duplicate — matches the Stripe/Crypto pattern
 */

const express = require('express');
const { logger } = require('../../utils/logger');
const { webhookService } = require('../../services/webhookService');
const { enqueueWebhookProcessing } = require('../../jobs/dispatchers');

const router = express.Router();

router.post('/', async (req, res) => {
  // rawBody for signature verification must be the exact original bytes
  const rawBody = req.rawBody
    || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  const sigHeader = req.headers['x-paystack-signature'] || '';

  // Parse event — use already-parsed object when available
  const event = req.body && typeof req.body === 'object' ? req.body
    : (() => { try { return JSON.parse(rawBody); } catch { return {}; } })();

  let result;
  try {
    result = await webhookService.ingestPaystackEvent(
      { signature: sigHeader },
      event,
      rawBody
    );
  } catch (err) {
    logger.warn({ provider: 'paystack', code: err.code, message: err.message }, 'paystack:webhook ingest failed');
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  if (!result.duplicate) {
    await enqueueWebhookProcessing(result.webhookEvent.id, result.webhookEvent.eventId);
  }

  logger.info(
    { provider: 'paystack', eventId: result.webhookEvent.eventId, duplicate: result.duplicate },
    'paystack:webhook received'
  );

  return res.status(result.duplicate ? 200 : 202).json({
    received: true,
    duplicate: result.duplicate,
    event_id: result.webhookEvent.eventId
  });
});

module.exports = router;
