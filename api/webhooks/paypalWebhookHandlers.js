const { invoiceRepository } = require('../repositories/invoiceRepository');
const { paymentProviderTransactionRepository } = require('../repositories/paymentProviderTransactionRepository');
const { auditLogService } = require('../services/auditLogService');
const { ledgerService } = require('../services/ledgerService');
const { paypalInvoiceService } = require('../services/paypalInvoiceService');
const { paypalPayoutService } = require('../services/paypalPayoutService');
const { INVOICE_STATUS, AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { parseAmount } = require('../utils/money');

function extractInvoiceId(event) {
  return event.resource?.invoice_id || event.resource?.invoice?.id || event.resource?.id || null;
}

function extractPaymentStatus(event) {
  return String(event.resource?.status || event.resource?.state || event.resource?.invoice?.status || '').toUpperCase();
}

function extractEventTimestamp(event) {
  const timestamp = event.resource?.update_time || event.resource?.create_time || event.create_time;
  const date = new Date(timestamp || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function extractPaymentAmount(event, invoice) {
  const value =
    event.resource?.amount?.value ||
    event.resource?.amount?.total ||
    event.resource?.invoice?.amount?.value ||
    event.resource?.invoice?.amount?.total ||
    event.resource?.total_amount?.value ||
    null;

  if (!value) {
    return invoice.amountCents;
  }

  try {
    return parseAmount(value);
  } catch (_error) {
    return invoice.amountCents;
  }
}

function extractPaymentCurrency(event, invoice) {
  return (
    event.resource?.amount?.currency_code ||
    event.resource?.amount?.currency ||
    event.resource?.invoice?.amount?.currency_code ||
    event.resource?.invoice?.amount?.currency ||
    event.resource?.total_amount?.currency_code ||
    invoice.currencyCode
  );
}

function buildProviderTransactionId(event, invoice) {
  return String(
    event.resource?.sale_id ||
    event.resource?.capture_id ||
    event.resource?.id ||
    event.resource?.invoice_id ||
    invoice.paypalInvoiceId ||
    event.id
  );
}

function buildInvoiceMetadata(invoice, event, reconciliationState) {
  const previous = invoice.metadata || {};
  return {
    ...previous,
    provider: 'paypal',
    provider_resource: 'invoice',
    provider_invoice_id: invoice.paypalInvoiceId,
    provider_status: extractPaymentStatus(event) || previous.provider_status || null,
    payment_verification: {
      status: reconciliationState,
      event_id: event.id,
      event_type: event.event_type,
      verified_at: new Date().toISOString()
    }
  };
}

async function recordInvoiceTransaction({ event, invoice, reconciliationState, matchResult }) {
  const amountMinor = extractPaymentAmount(event, invoice);
  const currency = extractPaymentCurrency(event, invoice);
  const providerTransactionId = buildProviderTransactionId(event, invoice);

  return paymentProviderTransactionRepository.createOrGet({
    provider: 'paypal',
    providerTransactionId,
    providerReference: invoice.paypalInvoiceId,
    eventId: event.id,
    amountMinor,
    currency,
    status: extractPaymentStatus(event) || 'UNKNOWN',
    destination: {
      invoice_id: invoice.id,
      paypal_invoice_id: invoice.paypalInvoiceId,
      recipient_email: invoice.recipientEmail
    },
    sender: {
      payer_email: event.resource?.payer?.email_address || event.resource?.billing_info?.[0]?.email_address || null
    },
    transactionTime: extractEventTimestamp(event),
    verificationStatus: 'VERIFIED_WEBHOOK',
    matchStatus: reconciliationState,
    riskLevel: reconciliationState === 'MATCHED' ? 'LOW' : 'MEDIUM',
    matchResult,
    metadata: {
      event_type: event.event_type,
      resource_type: event.resource_type || null,
      paypal_invoice_id: invoice.paypalInvoiceId,
      raw_payload_exposed: false
    }
  });
}

function reconcilePaidInvoiceEvent(event, invoice) {
  const providerAmount = extractPaymentAmount(event, invoice);
  const providerCurrency = extractPaymentCurrency(event, invoice);
  const amountMatches = providerAmount === invoice.amountCents;
  const currencyMatches = String(providerCurrency || '').toUpperCase() === String(invoice.currencyCode || '').toUpperCase();
  const providerStatus = extractPaymentStatus(event) || 'PAID';
  const statusSupportsPaid = ['PAID', 'COMPLETED', 'MARKED_AS_PAID', ''].includes(providerStatus);
  const state = amountMatches && currencyMatches && statusSupportsPaid ? 'MATCHED' : 'NEEDS_REVIEW';

  return {
    state,
    result: {
      provider_status: providerStatus || 'PAID',
      transferly_status: invoice.status,
      provider_amount_minor: providerAmount,
      transferly_amount_minor: invoice.amountCents,
      amount_matches: amountMatches,
      provider_currency: providerCurrency,
      transferly_currency: invoice.currencyCode,
      currency_matches: currencyMatches,
      invoice_reference_matches: true,
      source: 'paypal_verified_webhook'
    }
  };
}

function extractRefundAmount(event) {
  return (
    event.resource?.amount?.value ||
    event.resource?.invoice?.amount?.value ||
    event.resource?.amount?.breakdown?.refunded_amount?.value ||
    null
  );
}

function extractPayoutIdentifier(event) {
  return (
    event.resource?.payout_item_id ||
    event.resource?.payout_batch_id ||
    event.resource?.batch_header?.payout_batch_id ||
    event.resource?.sender_batch_header?.sender_batch_id ||
    null
  );
}

function isTerminalInvoiceStatus(status) {
  return [INVOICE_STATUS.PAID, INVOICE_STATUS.CANCELLED, INVOICE_STATUS.REFUNDED].includes(status);
}

async function handleInvoicePaid(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  if ([INVOICE_STATUS.CANCELLED, INVOICE_STATUS.REFUNDED].includes(invoice.status)) {
    const reviewTransaction = await recordInvoiceTransaction({
      event,
      invoice,
      reconciliationState: 'NEEDS_REVIEW',
      matchResult: {
        provider_status: extractPaymentStatus(event) || 'PAID',
        transferly_status: invoice.status,
        reason: 'terminal_invoice_status',
        source: 'paypal_verified_webhook'
      }
    });
    await auditLogService.log({
      actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
      action: 'invoice.payment_needs_review',
      entityType: 'invoice',
      entityId: invoice.id,
      metadata: {
        eventId: event.id,
        paypalInvoiceId,
        reason: 'terminal_invoice_status',
        currentStatus: invoice.status,
        transactionId: reviewTransaction.transaction.id,
        transactionDuplicate: reviewTransaction.duplicate
      }
    });
    return { status: 'needs_review', reason: 'terminal_invoice_status' };
  }

  const reconciliation = reconcilePaidInvoiceEvent(event, invoice);
  const paidAt = invoice.paidAt || extractEventTimestamp(event);

  const updatedInvoice = await invoiceRepository.update(invoice.id, {
    status: reconciliation.state === 'MATCHED' ? INVOICE_STATUS.PAID : invoice.status,
    paidAt: reconciliation.state === 'MATCHED' ? paidAt : invoice.paidAt,
    paypalSyncedAt: new Date().toISOString(),
    paypalDetails: {
      ...(invoice.paypalDetails || {}),
      latest_webhook_event: event,
      latest_provider_status: extractPaymentStatus(event) || 'PAID'
    },
    metadata: buildInvoiceMetadata(invoice, event, reconciliation.state)
  });

  const transaction = await recordInvoiceTransaction({
    event,
    invoice: updatedInvoice,
    reconciliationState: reconciliation.state,
    matchResult: reconciliation.result
  });

  if (reconciliation.state === 'MATCHED') {
    await ledgerService.creditPendingFromInvoice({
      userId: invoice.userId,
      invoiceId: invoice.id,
      amountCents: invoice.amountCents,
      currencyCode: invoice.currencyCode,
      eventId: event.id
    });
  }

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: reconciliation.state === 'MATCHED' ? 'invoice.paid' : 'invoice.payment_needs_review',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      eventId: event.id,
      paypalInvoiceId,
      reconciliationState: reconciliation.state,
      transactionId: transaction.transaction.id,
      transactionDuplicate: transaction.duplicate
    }
  });

  return {
    status: reconciliation.state === 'MATCHED' ? 'processed' : 'needs_review',
    reconciliationState: reconciliation.state,
    transaction: transaction.transaction
  };
}

async function handleInvoiceCancelled(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  if ([INVOICE_STATUS.PAID, INVOICE_STATUS.REFUNDED].includes(invoice.status)) {
    return;
  }

  await invoiceRepository.update(invoice.id, {
    status: INVOICE_STATUS.CANCELLED,
    cancelledAt: invoice.cancelledAt || extractEventTimestamp(event),
    paypalSyncedAt: new Date().toISOString(),
    paypalDetails: {
      ...(invoice.paypalDetails || {}),
      latest_webhook_event: event,
      latest_provider_status: 'CANCELLED'
    },
    metadata: buildInvoiceMetadata(invoice, event, 'MATCHED')
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'invoice.cancelled',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      eventId: event.id
    }
  });
}

async function handleInvoiceRefunded(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  await invoiceRepository.update(invoice.id, {
    status: INVOICE_STATUS.REFUNDED,
    refundedAt: invoice.refundedAt || extractEventTimestamp(event),
    paypalSyncedAt: new Date().toISOString(),
    paypalDetails: {
      ...(invoice.paypalDetails || {}),
      latest_webhook_event: event,
      latest_provider_status: 'REFUNDED'
    },
    metadata: buildInvoiceMetadata(invoice, event, 'MATCHED')
  });

  await ledgerService.adjustForInvoiceRefund({
    userId: invoice.userId,
    invoiceId: invoice.id,
    amountCents: extractRefundAmount(event) ? parseAmount(extractRefundAmount(event)) : invoice.amountCents,
    currencyCode: invoice.currencyCode,
    eventId: event.id
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'invoice.refunded',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      eventId: event.id
    }
  });
}

async function handleInvoiceUpdated(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  if (isTerminalInvoiceStatus(invoice.status)) {
    return;
  }

  await invoiceRepository.update(invoice.id, {
    status: INVOICE_STATUS.UPDATED,
    paypalSyncedAt: new Date().toISOString(),
    paypalDetails: {
      ...(invoice.paypalDetails || {}),
      latest_webhook_event: event,
      latest_provider_status: extractPaymentStatus(event) || 'UPDATED'
    },
    metadata: buildInvoiceMetadata(invoice, event, 'PENDING')
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'invoice.updated',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      eventId: event.id
    }
  });
}

async function handleInvoiceCreated(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  await paypalInvoiceService.refreshInvoice({
    invoiceId: invoice.id,
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    actorId: null
  });
}

async function handleInvoiceScheduled(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  await paypalInvoiceService.refreshInvoice({
    invoiceId: invoice.id,
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    actorId: null
  });
}

async function handlePayoutEvent(event) {
  const payoutIdentifier = extractPayoutIdentifier(event);
  if (!payoutIdentifier) {
    return;
  }

  await paypalPayoutService.refreshPayout({
    payoutId: payoutIdentifier,
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    actorId: null
  });
}

module.exports = {
  paypalWebhookHandlers: {
    handleInvoiceCreated,
    handleInvoicePaid,
    handleInvoiceScheduled,
    handleInvoiceCancelled,
    handleInvoiceRefunded,
    handleInvoiceUpdated,
    handlePayoutEvent
  }
};
