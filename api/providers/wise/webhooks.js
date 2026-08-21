'use strict';

/**
 * Wise webhook router — mounted at /webhooks/wise
 *
 * Security:  RSA-SHA256/PSS via verifyWiseSignature (providerWebhookSignatures.js)
 * Dedup:     DB-backed via webhookEventRepository unique constraint on event_id
 * Response:  202 first receipt, 200 duplicate
 */

const express = require('express');
const { logger } = require('../../utils/logger');
const { webhookService } = require('../../services/webhookService');
const { enqueueWebhookProcessing } = require('../../jobs/dispatchers');

const router = express.Router();

router.post('/', async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const sigHeader = req.headers['x-signature-sha256'] || req.headers['x-signature'] || '';

  // Parse event — if req.body is already an object (Express parsed it), use it directly
  const event = req.body && typeof req.body === 'object' ? req.body
    : (() => { try { return JSON.parse(rawBody); } catch { return {}; } })();

  // Wise sends a ping event during webhook registration — acknowledge immediately
  if (event?.event_type === 'ping') {
    logger.info({ provider: 'wise' }, 'wise:webhook ping received');
    return res.status(200).json({ ok: true });
  }

  let result;
  try {
    result = await webhookService.ingestWiseEvent(
      { signature: sigHeader },
      event,
      rawBody
    );
  } catch (err) {
    logger.warn({ provider: 'wise', code: err.code, message: err.message }, 'wise:webhook ingest failed');
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  if (!result.duplicate) {
    await enqueueWebhookProcessing(result.webhookEvent.id, result.webhookEvent.eventId);
  }

  logger.info(
    { provider: 'wise', eventId: result.webhookEvent.eventId, duplicate: result.duplicate },
    'wise:webhook received'
  );

  return res.status(result.duplicate ? 200 : 202).json({
    received: true,
    duplicate: result.duplicate,
    event_id: result.webhookEvent.eventId
  });
});

module.exports = router;
