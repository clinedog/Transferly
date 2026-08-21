'use strict';

/**
 * Flutterwave webhook router — mounted at /webhooks/flutterwave
 *
 * Security:  verif-hash constant-time compare via verifyFlutterwaveSignature
 * Dedup:     DB-backed via webhookEventRepository unique constraint on event_id
 * Response:  202 first receipt, 200 duplicate
 */

const express = require('express');
const { logger } = require('../../utils/logger');
const { webhookService } = require('../../services/webhookService');
const { enqueueWebhookProcessing } = require('../../jobs/dispatchers');

const router = express.Router();

router.post('/', async (req, res) => {
  const rawBody = req.rawBody
    || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  const verifHash = req.headers['verif-hash'] || '';

  const event = req.body && typeof req.body === 'object' ? req.body
    : (() => { try { return JSON.parse(rawBody); } catch { return {}; } })();

  let result;
  try {
    result = await webhookService.ingestFlutterwaveEvent(
      { verifHash },
      event
    );
  } catch (err) {
    logger.warn({ provider: 'flutterwave', code: err.code, message: err.message }, 'flutterwave:webhook ingest failed');
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  if (!result.duplicate) {
    await enqueueWebhookProcessing(result.webhookEvent.id, result.webhookEvent.eventId);
  }

  logger.info(
    { provider: 'flutterwave', eventId: result.webhookEvent.eventId, duplicate: result.duplicate },
    'flutterwave:webhook received'
  );

  return res.status(result.duplicate ? 200 : 202).json({
    received: true,
    duplicate: result.duplicate,
    event_id: result.webhookEvent.eventId
  });
});

module.exports = router;
