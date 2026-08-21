'use strict';

/**
 * Crypto Commerce (Coinbase Commerce) background jobs.
 *
 * processWebhookEvent — called after HMAC-SHA256 signature verification
 * and deduplication. Handles charge lifecycle events.
 *
 * Docs: https://docs.cloud.coinbase.com/commerce/docs/webhooks-overview
 */

const { logger } = require('../../utils/logger');

const HANDLED_EVENTS = new Set([
  'charge:created',
  'charge:confirmed',
  'charge:failed',
  'charge:delayed',
  'charge:pending',
  'charge:resolved'
]);

/**
 * Process a Coinbase Commerce webhook event.
 *
 * @param {{ data: { event: object } }} job
 * @returns {Promise<{ ok: boolean, eventType: string }>}
 */
async function processWebhookEvent(job) {
  const event = job?.data?.event;
  if (!event) {
    logger.warn({ provider: 'crypto' }, 'crypto:job processWebhookEvent — missing event payload');
    return { ok: false, reason: 'missing_event' };
  }

  const eventType = event?.type;
  const eventId = event?.id;
  const chargeCode = event?.data?.code;

  if (!HANDLED_EVENTS.has(eventType)) {
    logger.info({ provider: 'crypto', eventType }, 'crypto:job ignoring unhandled event type');
    return { ok: true, eventType, handled: false };
  }

  logger.info({ provider: 'crypto', eventType, eventId, chargeCode }, 'crypto:job processing event');

  switch (eventType) {
    case 'charge:confirmed':
    case 'charge:resolved':
      // TODO: credit internal pending_balance via ledgerService for confirmed/resolved charges
      logger.info({ provider: 'crypto', eventId, chargeCode }, 'crypto:job charge confirmed — pending ledger integration');
      break;

    case 'charge:failed':
      logger.info({ provider: 'crypto', eventId, chargeCode }, 'crypto:job charge failed noted');
      break;

    case 'charge:delayed':
      logger.info({ provider: 'crypto', eventId, chargeCode }, 'crypto:job charge delayed (underpaid or delayed broadcast)');
      break;

    default:
      break;
  }

  return { ok: true, eventType, handled: true };
}

module.exports = { processWebhookEvent };
