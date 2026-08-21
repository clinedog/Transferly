'use strict';

/**
 * Stripe background jobs (BullMQ-style job handlers).
 *
 * processWebhookEvent — called by the webhook router after signature verification
 * and deduplication. Dispatches to the correct service handler based on event type.
 *
 * Future: wire in to the main BullMQ worker by registering the queue in
 * api/jobs/queues.js and dispatching from the webhook router via a proper
 * BullMQ producer. For now the handler is called inline via setImmediate.
 */

const { logger } = require('../../utils/logger');

/** Stripe event types this handler processes */
const HANDLED_EVENTS = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.voided',
  'checkout.session.completed',
  'transfer.created',
  'transfer.reversed'
]);

/**
 * Process a Stripe webhook event.
 *
 * @param {{ data: { event: object } }} job  BullMQ-shaped job object
 * @returns {Promise<{ ok: boolean, eventType: string }>}
 */
async function processWebhookEvent(job) {
  const event = job?.data?.event;
  if (!event) {
    logger.warn({ provider: 'stripe' }, 'stripe:job processWebhookEvent — missing event payload');
    return { ok: false, reason: 'missing_event' };
  }

  const { id: eventId, type: eventType } = event;

  if (!HANDLED_EVENTS.has(eventType)) {
    logger.info({ provider: 'stripe', eventId, eventType }, 'stripe:job ignoring unhandled event type');
    return { ok: true, eventType, handled: false };
  }

  logger.info({ provider: 'stripe', eventId, eventType }, 'stripe:job processing event');

  // Dispatch to type-specific handlers as the service layer matures
  switch (eventType) {
    case 'payment_intent.succeeded':
    case 'invoice.paid':
    case 'checkout.session.completed':
      // TODO: credit internal pending_balance via ledgerService
      logger.info({ provider: 'stripe', eventId, eventType }, 'stripe:job payment event — pending ledger integration');
      break;

    case 'payment_intent.payment_failed':
    case 'invoice.payment_failed':
      logger.info({ provider: 'stripe', eventId, eventType }, 'stripe:job payment failed event noted');
      break;

    case 'transfer.created':
    case 'transfer.reversed':
      logger.info({ provider: 'stripe', eventId, eventType }, 'stripe:job transfer event noted');
      break;

    default:
      break;
  }

  return { ok: true, eventType, handled: true };
}

module.exports = { processWebhookEvent };
