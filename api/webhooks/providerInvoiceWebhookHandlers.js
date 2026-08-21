'use strict';

const { providerInvoiceService } = require('../services/providerInvoiceService');
const { stripeConnectedAccountService } = require('../services/stripeConnectedAccountService');
const { ledgerService } = require('../services/ledgerService');
const { payoutRepository } = require('../repositories/payoutRepository');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { auditLogService } = require('../services/auditLogService');
const { logger } = require('../utils/logger');
const { AUDIT_ACTOR_TYPE, INVOICE_STATUS, PAYOUT_STATUS } = require('../utils/constants');

// ---------------------------------------------------------------------------
// Stripe handlers (unchanged)
// ---------------------------------------------------------------------------

async function handleStripeInvoiceEvent(event) {
  return providerInvoiceService.processProviderInvoiceEvent({
    provider: 'stripe',
    event,
    eventId: event.id,
    eventType: event.type
  });
}

async function handleCryptoChargeEvent(event) {
  return providerInvoiceService.processProviderInvoiceEvent({
    provider: 'crypto',
    event,
    eventId: event.id,
    eventType: event.type || event.event_type
  });
}

async function handleStripeAccountEvent(event) {
  return stripeConnectedAccountService.syncAccountUpdatedEvent(event);
}

// ---------------------------------------------------------------------------
// Paystack handlers
// ---------------------------------------------------------------------------

/**
 * Handle Paystack charge.success webhook.
 *
 * Looks up the invoice by the Paystack transaction reference stored in
 * paypal_invoice_id (the generic provider invoice ID column), then
 * credits pending_balance via ledgerService.creditPendingFromInvoice.
 *
 * The settlement key is idempotent — double-delivery is safe.
 */
async function handlePaystackChargeEvent(event) {
  const data = event?.data || {};
  const status = data.status;
  if (status !== 'success') {
    logger.info({ provider: 'paystack', status }, 'paystack:charge not success — skipping ledger credit');
    return { skipped: true, reason: `status=${status}` };
  }

  const reference = data.reference || String(data.id || '');
  if (!reference) {
    logger.warn({ provider: 'paystack' }, 'paystack:charge.success missing reference');
    return { skipped: true, reason: 'missing_reference' };
  }

  const invoice = await invoiceRepository.findByPaypalInvoiceId(reference);
  if (!invoice) {
    logger.warn({ provider: 'paystack', reference }, 'paystack:charge.success no invoice found for reference');
    return { skipped: true, reason: 'invoice_not_found' };
  }

  if (invoice.status === INVOICE_STATUS.PAID) {
    logger.info({ provider: 'paystack', invoiceId: invoice.id }, 'paystack:charge already settled');
    return { skipped: true, reason: 'already_paid' };
  }

  const now = new Date().toISOString();
  await invoiceRepository.update(invoice.id, {
    status: INVOICE_STATUS.PAID,
    paidAt: invoice.paidAt || now,
    metadata: {
      ...(invoice.metadata || {}),
      provider: 'paystack',
      provider_resource: 'charge',
      provider_invoice_id: reference,
      provider_status: status,
      paystack_transaction_id: data.id || null,
      paystack_channel: data.channel || null
    }
  });

  await ledgerService.creditPendingFromInvoice({
    userId: invoice.userId,
    invoiceId: invoice.id,
    amountCents: invoice.amountCents,
    currencyCode: invoice.currencyCode,
    eventId: `paystack:charge:${reference}:paid`
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'invoice.paid',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: { provider: 'paystack', reference }
  });

  logger.info({ provider: 'paystack', invoiceId: invoice.id, reference }, 'paystack:charge settled to pending_balance');
  return { settled: true, invoiceId: invoice.id };
}

// ---------------------------------------------------------------------------
// Flutterwave handlers
// ---------------------------------------------------------------------------

/**
 * Handle Flutterwave charge.completed webhook.
 *
 * Only processes events where data.status === 'successful'.
 * Matches invoice by tx_ref stored in paypal_invoice_id.
 */
async function handleFlutterwaveChargeEvent(event) {
  const data = event?.data || {};
  const status = data.status;
  if (status !== 'successful') {
    logger.info({ provider: 'flutterwave', status }, 'flutterwave:charge not successful — skipping ledger credit');
    return { skipped: true, reason: `status=${status}` };
  }

  const txRef = data.tx_ref || String(data.id || '');
  if (!txRef) {
    logger.warn({ provider: 'flutterwave' }, 'flutterwave:charge.completed missing tx_ref');
    return { skipped: true, reason: 'missing_tx_ref' };
  }

  const invoice = await invoiceRepository.findByPaypalInvoiceId(txRef);
  if (!invoice) {
    logger.warn({ provider: 'flutterwave', txRef }, 'flutterwave:charge.completed no invoice found for tx_ref');
    return { skipped: true, reason: 'invoice_not_found' };
  }

  if (invoice.status === INVOICE_STATUS.PAID) {
    logger.info({ provider: 'flutterwave', invoiceId: invoice.id }, 'flutterwave:charge already settled');
    return { skipped: true, reason: 'already_paid' };
  }

  const now = new Date().toISOString();
  await invoiceRepository.update(invoice.id, {
    status: INVOICE_STATUS.PAID,
    paidAt: invoice.paidAt || now,
    metadata: {
      ...(invoice.metadata || {}),
      provider: 'flutterwave',
      provider_resource: 'charge',
      provider_invoice_id: txRef,
      provider_status: status,
      flw_transaction_id: data.id || null,
      flw_payment_type: data.payment_type || null
    }
  });

  await ledgerService.creditPendingFromInvoice({
    userId: invoice.userId,
    invoiceId: invoice.id,
    amountCents: invoice.amountCents,
    currencyCode: invoice.currencyCode,
    eventId: `flutterwave:charge:${txRef}:paid`
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'invoice.paid',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: { provider: 'flutterwave', txRef }
  });

  logger.info({ provider: 'flutterwave', invoiceId: invoice.id, txRef }, 'flutterwave:charge settled to pending_balance');
  return { settled: true, invoiceId: invoice.id };
}

// ---------------------------------------------------------------------------
// Wise handlers
// ---------------------------------------------------------------------------

/**
 * Handle Wise transfers#state-change webhook.
 *
 * - outgoing_payment_sent: debit frozen_balance, credit paid_out_balance (payout completed)
 * - cancelled / bounced_back / funds_refunded: release frozen_balance back to available_balance
 *
 * Matches payout record by customerTransactionId stored in metadata.wise_customer_transaction_id
 * or by the transfer ID stored in metadata.wise_transfer_id.
 */
async function handleWiseTransferEvent(event) {
  const data = event?.data || {};
  const currentState = data.current_state;
  const transferId = String(data.resource?.id || data.transfer_id || '');

  if (!transferId) {
    logger.warn({ provider: 'wise' }, 'wise:transfers#state-change missing transfer id');
    return { skipped: true, reason: 'missing_transfer_id' };
  }

  // Find payout by wise_transfer_id stored in metadata
  const candidatePayouts = await payoutRepository.findMany({
    provider: 'wise',
    limit: 10
  });

  const payout = candidatePayouts.find(
    (p) =>
      String(p.metadata?.wise_transfer_id || '') === transferId ||
      String(p.metadata?.provider_payout_id || '') === transferId
  );

  if (!payout) {
    logger.warn({ provider: 'wise', transferId, currentState }, 'wise:transfer state-change no matching payout found');
    return { skipped: true, reason: 'payout_not_found' };
  }

  const TERMINAL_SUCCESS = ['outgoing_payment_sent', 'funds_converted', 'processing'];
  const TERMINAL_FAILURE = ['cancelled', 'bounced_back', 'funds_refunded'];

  if (TERMINAL_SUCCESS.includes(currentState) && currentState === 'outgoing_payment_sent') {
    // Payout completed — settle frozen → paid_out
    await ledgerService.settlePayout({
      userId: payout.userId,
      payoutId: payout.id,
      amountCents: payout.amountCents,
      currencyCode: payout.currencyCode,
      eventId: `wise:transfer:${transferId}:sent`
    });

    await payoutRepository.update(payout.id, {
      status: PAYOUT_STATUS.SUCCESS,
      processedAt: new Date().toISOString(),
      metadata: {
        ...(payout.metadata || {}),
        wise_current_state: currentState,
        wise_transfer_id: transferId
      }
    });

    await auditLogService.log({
      actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
      action: 'payout.settled',
      entityType: 'payout',
      entityId: payout.id,
      metadata: { provider: 'wise', transferId, currentState }
    });

    logger.info({ provider: 'wise', payoutId: payout.id, transferId }, 'wise:transfer settled — frozen → paid_out');
    return { settled: true, payoutId: payout.id };
  }

  if (TERMINAL_FAILURE.includes(currentState)) {
    // Payout failed — release frozen → available
    await ledgerService.refundReservedPayout({
      userId: payout.userId,
      payoutId: payout.id,
      amountCents: payout.amountCents,
      currencyCode: payout.currencyCode,
      reason: `Wise transfer state: ${currentState}`
    });

    await payoutRepository.update(payout.id, {
      status: PAYOUT_STATUS.FAILED,
      failureReason: `Wise transfer state: ${currentState}`,
      metadata: {
        ...(payout.metadata || {}),
        wise_current_state: currentState,
        wise_transfer_id: transferId
      }
    });

    await auditLogService.log({
      actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
      action: 'payout.failed',
      entityType: 'payout',
      entityId: payout.id,
      metadata: { provider: 'wise', transferId, currentState }
    });

    logger.info({ provider: 'wise', payoutId: payout.id, transferId, currentState }, 'wise:transfer failed — frozen released');
    return { released: true, payoutId: payout.id };
  }

  logger.info({ provider: 'wise', transferId, currentState }, 'wise:transfer state-change — non-terminal state, no action');
  return { skipped: true, reason: `non_terminal_state:${currentState}` };
}

module.exports = {
  providerInvoiceWebhookHandlers: {
    handleStripeInvoiceEvent,
    handleCryptoChargeEvent,
    handleStripeAccountEvent,
    handlePaystackChargeEvent,
    handleFlutterwaveChargeEvent,
    handleWiseTransferEvent
  }
};
