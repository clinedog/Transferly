'use strict';

/**
 * Paystack background jobs.
 *
 * processWebhookEvent — called after HMAC-SHA512 signature verification
 * and deduplication. Handles charge and transfer events from Paystack.
 *
 * Docs: https://paystack.com/docs/payments/webhooks/#supported-events
 */

const { logger } = require('../../utils/logger');

const HANDLED_EVENTS = new Set([
  'charge.success',
  'charge.failed',
  'charge.dispute.create',
  'charge.dispute.resolve',
  'transfer.success',
  'transfer.failed',
  'transfer.reversed',
  'invoice.create',
  'invoice.payment_failed',
  'invoice.update',
  'subscription.create',
  'subscription.disable'
]);

/**
 * Process a Paystack webhook event.
 *
 * @param {{ data: { event: object } }} job
 * @returns {Promise<{ ok: boolean, eventType: string }>}
 */
async function processWebhookEvent(job) {
  const event = job?.data?.event;
  if (!event) {
    logger.warn({ provider: 'paystack' }, 'paystack:job processWebhookEvent — missing event payload');
    return { ok: false, reason: 'missing_event' };
  }

  const eventType = event?.event;
  const eventId = event?.data?.id;

  if (!HANDLED_EVENTS.has(eventType)) {
    logger.info({ provider: 'paystack', eventType }, 'paystack:job ignoring unhandled event type');
    return { ok: true, eventType, handled: false };
  }

  logger.info({ provider: 'paystack', eventType, eventId }, 'paystack:job processing event');

  switch (eventType) {
    case 'charge.success':
      // TODO: credit internal pending_balance via ledgerService
      logger.info({ provider: 'paystack', eventId }, 'paystack:job charge success — pending ledger integration');
      break;
    case 'transfer.success':
      logger.info({ provider: 'paystack', eventId }, 'paystack:job transfer success noted');
      break;
    case 'transfer.failed':
    case 'transfer.reversed':
      logger.info({ provider: 'paystack', eventId, eventType }, 'paystack:job transfer failure noted');
      break;
    default:
      break;
  }

  return { ok: true, eventType, handled: true };
}

module.exports = { processWebhookEvent };
