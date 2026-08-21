'use strict';

/**
 * Wise background jobs.
 *
 * processWebhookEvent — called after signature verification and deduplication.
 * Handles transfer state-change events from the Wise Platform API.
 *
 * Docs: https://docs.wise.com/api-docs/features/webhooks-notifications#transfer-state-change
 */

const { logger } = require('../../utils/logger');

const HANDLED_EVENTS = new Set([
  'transfers#state-change',
  'transfers#active-cases',
  'balances#credit',
  'balances#debit'
]);

/**
 * Process a Wise webhook event.
 *
 * @param {{ data: { event: object } }} job
 * @returns {Promise<{ ok: boolean, eventType: string }>}
 */
async function processWebhookEvent(job) {
  const event = job?.data?.event;
  if (!event) {
    logger.warn({ provider: 'wise' }, 'wise:job processWebhookEvent — missing event payload');
    return { ok: false, reason: 'missing_event' };
  }

  const eventType = event?.event_type;
  const transferId = event?.data?.resource?.id;

  if (!HANDLED_EVENTS.has(eventType)) {
    logger.info({ provider: 'wise', eventType }, 'wise:job ignoring unhandled event type');
    return { ok: true, eventType, handled: false };
  }

  logger.info({ provider: 'wise', eventType, transferId }, 'wise:job processing event');

  switch (eventType) {
    case 'transfers#state-change': {
      const state = event?.data?.current_state;
      logger.info({ provider: 'wise', transferId, state }, 'wise:job transfer state-change — pending ledger integration');
      // TODO: update internal transfer status; credit ledger on 'outgoing_payment_sent'
      break;
    }
    case 'balances#credit':
    case 'balances#debit':
      logger.info({ provider: 'wise', eventType }, 'wise:job balance event noted');
      break;
    default:
      break;
  }

  return { ok: true, eventType, handled: true };
}

module.exports = { processWebhookEvent };
