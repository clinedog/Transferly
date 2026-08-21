'use strict';

/**
 * Flutterwave background jobs.
 *
 * processWebhookEvent — called after verif-hash verification and deduplication.
 * Handles charge and transfer events from the Flutterwave v3 API.
 *
 * Docs: https://developer.flutterwave.com/docs/integration-guides/webhooks/
 */

const { logger } = require('../../utils/logger');

const HANDLED_EVENTS = new Set([
  'charge.completed',
  'transfer.completed',
  'PAYMENT',
  'SUBSCRIPTION_CANCELLED'
]);

/**
 * Process a Flutterwave webhook event.
 *
 * @param {{ data: { event: object } }} job
 * @returns {Promise<{ ok: boolean, eventType: string }>}
 */
async function processWebhookEvent(job) {
  const event = job?.data?.event;
  if (!event) {
    logger.warn({ provider: 'flutterwave' }, 'flutterwave:job processWebhookEvent — missing event payload');
    return { ok: false, reason: 'missing_event' };
  }

  const eventType = event?.event;
  const eventId = event?.data?.id;

  if (!HANDLED_EVENTS.has(eventType)) {
    logger.info({ provider: 'flutterwave', eventType }, 'flutterwave:job ignoring unhandled event type');
    return { ok: true, eventType, handled: false };
  }

  logger.info({ provider: 'flutterwave', eventType, eventId }, 'flutterwave:job processing event');

  switch (eventType) {
    case 'charge.completed': {
      const status = event?.data?.status;
      if (status === 'successful') {
        // TODO: credit internal pending_balance via ledgerService
        logger.info({ provider: 'flutterwave', eventId }, 'flutterwave:job charge successful — pending ledger integration');
      } else {
        logger.info({ provider: 'flutterwave', eventId, status }, 'flutterwave:job charge not successful — no action');
      }
      break;
    }
    case 'transfer.completed':
      logger.info({ provider: 'flutterwave', eventId }, 'flutterwave:job transfer completed noted');
      break;
    default:
      break;
  }

  return { ok: true, eventType, handled: true };
}

module.exports = { processWebhookEvent };
