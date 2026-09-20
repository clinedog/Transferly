const config = require('../config');
const { PayPalClient } = require('../adapters/paypalClient');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');
const { paymentProviderTransactionRepository } = require('../repositories/paymentProviderTransactionRepository');
const { auditLogService } = require('./auditLogService');
const { paypalWebhookHandlers } = require('../webhooks/paypalWebhookHandlers');
const { providerInvoiceWebhookHandlers } = require('../webhooks/providerInvoiceWebhookHandlers');
const { automationDispatchService } = require('./automationDispatchService');
const { AppError } = require('../utils/errors');
const {
  verifyCoinbaseWebhookSignature,
  verifyStripeSignature,
  verifyPaystackSignature,
  verifyFlutterwaveSignature,
  verifyWiseSignature
} = require('../utils/providerWebhookSignatures');
const { AUDIT_ACTOR_TYPE, WEBHOOK_PROCESSING_STATUS } = require('../utils/constants');
const { normalizeProviderStatus } = require('../core/financial/reconciliation');
const { PAYMENT_STATES, assertPaymentTransition, assertPayoutTransition } = require('../core/financial/providerStateMachine');

const paypalClient = new PayPalClient(
  config.PAYPAL_CLIENT_ID,
  config.PAYPAL_CLIENT_SECRET,
  config.PAYPAL_ENVIRONMENT
);

function webhookAutomationTrigger(eventType) {
  if (['INVOICING.INVOICE.PAID', 'invoice.paid', 'invoice.payment_succeeded'].includes(eventType)) return 'INVOICE_PAID';
  if (['invoice.payment_failed', 'charge.failed', 'checkout.payment.failed'].includes(eventType)) return 'PAYMENT_FAILED';
  if (['PAYMENT.PAYOUTS-ITEM.SUCCEEDED', 'PAYMENT.PAYOUTSBATCH.SUCCESS'].includes(eventType)) return 'PAYOUT_SUCCEEDED';
  if (['PAYMENT.PAYOUTS-ITEM.FAILED', 'PAYMENT.PAYOUTS-ITEM.DENIED', 'PAYMENT.PAYOUTSBATCH.DENIED'].includes(eventType)) return 'PAYOUT_FAILED';
  return null;
}

function isUniqueConstraintError(error) {
  return error?.code === 'SQLITE_CONSTRAINT' || /unique constraint/i.test(String(error?.message || ''));
}

/**
 * Map a provider's raw status string to the canonical Transferly state machine
 * state, and validate that the transition is legal before processing it.
 *
 * @param {string} transactionType 'payment' or 'payout'
 * @param {string} currentStatus   - Current internal status (e.g. CREATED, SUCCEEDED)
 * @param {string} providerStatus  - Raw provider status (e.g. 'SUCCESS', 'PAID')
 * @returns {{from: string, to: string, providerStatus: string}}
 */
function validateStatusTransition(transactionType, currentStatus, providerStatus) {
  const normalized = normalizeProviderStatus(providerStatus);
  const to = normalized === 'SUCCEEDED' ? PAYMENT_STATES.SUCCEEDED : PAYMENT_STATES[normalized] || PAYMENT_STATES.UNKNOWN;
  const from = PAYMENT_STATES[currentStatus] || PAYMENT_STATES[currentStatus];

  if (transactionType === 'payout') {
    assertPayoutTransition(from, to);
  } else {
    assertPaymentTransition(from, to);
  }

  return { from, to, providerStatus: normalized };
}

/**
 * Compare a provider transaction record against a Transferly ledger entry and
 * return a structured reconciliation result.
 *
 * @param {object} providerTx
 * @param {object} ledgerEntry
 * @returns {{status: string, discrepancies: string[], details: object}}
 */
function compareProviderTransaction(providerTx, ledgerEntry) {
  const { compareTransaction } = require('../core/financial/reconciliation');
  return compareTransaction(providerTx, ledgerEntry);
}

/**
 * Find a Transferly ledger entry matching a provider transaction by reference.
 *
 * @param {string} provider
 * @param {string} providerTransactionId
 * @returns {Promise<object|null>}
 */
async function findLedgerEntryForTransaction(provider, providerTransactionId) {
  // Fallback: use the provider transaction repository to find the matching entry
  // by its internal reference, then resolve the ledger entry.
  const tx = await paymentProviderTransactionRepository.findByProviderTransactionId(provider, providerTransactionId);
  if (!tx) return null;

  const reference = tx.providerReference || tx.provider_transaction_id;
  if (!reference) return null;

  // Ledger entries are stored with provider references in their metadata.
  // Search by the reference in the metadata_json field.
  const { db } = require('../db');
  const rows = await db.all(
    'SELECT * FROM ledger_entries WHERE json_extract(metadata_json, \'$.provider_reference\') = ? LIMIT 1',
    [reference]
  );
  return rows[0] || null;
}

async function createReconciliationCase({ type, referenceId, providerKey, ledgerEntryId, providerTransaction, discrepancy, severity }) {
  const { createReconciliationCase: createCase } = require('../core/financial/reconciliation');
  return createCase({ type, referenceId, providerKey, ledgerEntryId, providerTransaction, discrepancy, severity });
}

async function createWebhookEventOnce(data) {
  try {
    return {
      duplicate: false,
      webhookEvent: await webhookEventRepository.create(data)
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await webhookEventRepository.findByEventId(data.eventId);
    if (!existing) {
      throw error;
    }

    return {
      duplicate: true,
      webhookEvent: existing
    };
  }
}

function assertPayPalSignatureHeaders(headers = {}) {
  const missing = [
    ['authAlgo', headers.authAlgo],
    ['certUrl', headers.certUrl],
    ['transmissionId', headers.transmissionId],
    ['transmissionSig', headers.transmissionSig],
    ['transmissionTime', headers.transmissionTime]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'PayPal webhook signature headers are required.', {
      missing_headers: missing
    });
  }
}

function assertProductionWebhookSecret(provider, configured) {
  if (config.NODE_ENV === 'production' && !String(configured || '').trim()) {
    throw new AppError(500, 'WEBHOOK_SECRET_NOT_CONFIGURED', `${provider} webhook secret is required in production.`);
  }
}

async function ingestPayPalEvent(headers, event) {
  const eventId = String(event.id || '');
  if (!eventId) {
    throw new AppError(400, 'INVALID_WEBHOOK_EVENT', 'Webhook event id is required.');
  }
  assertPayPalSignatureHeaders(headers);

  const existing = await webhookEventRepository.findByEventId(eventId);
  if (existing) {
    return {
      duplicate: true,
      webhookEvent: existing
    };
  }

  const createResult = await createWebhookEventOnce({
    eventId,
    eventType: String(event.event_type || 'unknown'),
    resourceType: typeof event.resource_type === 'string' ? event.resource_type : null,
    transmissionId: headers.transmissionId,
    status: WEBHOOK_PROCESSING_STATUS.RECEIVED,
    payload: event,
    verificationPayload: null
  });
  if (createResult.duplicate) {
    return createResult;
  }
  const { webhookEvent } = createResult;

  const verificationPayload = {
    auth_algo: headers.authAlgo,
    cert_url: headers.certUrl,
    transmission_id: headers.transmissionId,
    transmission_sig: headers.transmissionSig,
    transmission_time: headers.transmissionTime,
    webhook_id: config.PAYPAL_WEBHOOK_ID,
    webhook_event: event
  };

  const verification = await paypalClient.verifyWebhookSignature(verificationPayload);
  if (verification.verification_status !== 'SUCCESS') {
    const rejected = await webhookEventRepository.update(webhookEvent.id, {
      status: WEBHOOK_PROCESSING_STATUS.REJECTED,
      verificationPayload,
      lastError: `Verification status: ${verification.verification_status}`
    });

    await auditLogService.log({
      actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
      action: 'webhook.rejected',
      entityType: 'webhook_event',
      entityId: rejected.id,
      metadata: {
        eventId,
        verificationStatus: verification.verification_status
      }
    });

    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'PayPal webhook signature verification failed.');
  }

  const verified = await webhookEventRepository.update(webhookEvent.id, {
    status: WEBHOOK_PROCESSING_STATUS.VERIFIED,
    verificationPayload,
    lastError: null
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'webhook.received',
    entityType: 'webhook_event',
    entityId: verified.id,
    metadata: {
      eventId
    }
  });

  return {
    duplicate: false,
    webhookEvent: verified
  };
}

async function ingestVerifiedProviderEvent(input) {
  const eventId = `${input.provider}:${String(input.eventId || '')}`;
  if (!input.eventId) {
    throw new AppError(400, 'INVALID_WEBHOOK_EVENT', 'Webhook event id is required.');
  }

  const existing = await webhookEventRepository.findByEventId(eventId);
  if (existing) {
    return {
      duplicate: true,
      webhookEvent: existing
    };
  }

  const createResult = await createWebhookEventOnce({
    eventId,
    eventType: input.eventType || 'unknown',
    resourceType: input.resourceType || null,
    transmissionId: input.transmissionId || null,
    status: WEBHOOK_PROCESSING_STATUS.VERIFIED,
    payload: input.payload,
    verificationPayload: input.verificationPayload || null
  });
  if (createResult.duplicate) {
    return createResult;
  }
  const { webhookEvent } = createResult;

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'webhook.received',
    entityType: 'webhook_event',
    entityId: webhookEvent.id,
    metadata: {
      provider: input.provider,
      eventId
    }
  });

  return {
    duplicate: false,
    webhookEvent
  };
}

async function ingestStripeEvent(headers, event, rawBody) {
  assertProductionWebhookSecret('Stripe', config.STRIPE_WEBHOOK_SECRET);
  verifyStripeSignature(rawBody, headers.signature, config.STRIPE_WEBHOOK_SECRET);

  return ingestVerifiedProviderEvent({
    provider: 'stripe',
    eventId: event.id,
    eventType: String(event.type || 'unknown'),
    resourceType: event.data?.object?.object || null,
    transmissionId: headers.signature || null,
    payload: event,
    verificationPayload: {
      signature_header_present: Boolean(headers.signature)
    }
  });
}

async function ingestCryptoEvent(headers, event, rawBody, requestHeaders = {}) {
  assertProductionWebhookSecret('Crypto Commerce', config.CRYPTO_COMMERCE_WEBHOOK_SECRET);
  verifyCoinbaseWebhookSignature(
    rawBody,
    headers.signature,
    config.CRYPTO_COMMERCE_WEBHOOK_SECRET,
    requestHeaders
  );

  return ingestVerifiedProviderEvent({
    provider: 'crypto',
    eventId: event.id || headers.hookId,
    eventType: String(event.type || event.event_type || 'unknown'),
    resourceType: event.data?.resource || event.resource || 'crypto_charge',
    transmissionId: headers.hookId || null,
    payload: event,
    verificationPayload: {
      signature_header_present: Boolean(headers.signature),
      hook_id: headers.hookId || null
    }
  });
}

async function ingestPaystackEvent(headers, event, rawBody) {
  // Paystack signs webhook payloads with the secret key. Keep the separate
  // webhook secret as a backwards-compatible fallback for older deployments.
  const secret = config.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY || config.PAYSTACK_WEBHOOK_SECRET || '';
  assertProductionWebhookSecret('Paystack', secret);
  verifyPaystackSignature(rawBody, headers.signature, secret);

  return ingestVerifiedProviderEvent({
    provider: 'paystack',
    eventId: String(event?.data?.id || event?.data?.reference || ''),
    eventType: String(event?.event || 'unknown'),
    resourceType: event?.data?.channel || null,
    transmissionId: headers.signature || null,
    payload: event,
    verificationPayload: { signature_header_present: Boolean(headers.signature) }
  });
}

async function ingestFlutterwaveEvent(headers, event) {
  const secret = config.FLUTTERWAVE_WEBHOOK_SECRET || process.env.FLUTTERWAVE_WEBHOOK_SECRET || '';
  assertProductionWebhookSecret('Flutterwave', secret);
  verifyFlutterwaveSignature(headers.verifHash, secret);

  return ingestVerifiedProviderEvent({
    provider: 'flutterwave',
    eventId: String(event?.data?.id || event?.data?.tx_ref || ''),
    eventType: String(event?.event || 'unknown'),
    resourceType: event?.data?.payment_type || null,
    transmissionId: null,
    payload: event,
    verificationPayload: { verif_hash_present: Boolean(headers.verifHash) }
  });
}

async function ingestWiseEvent(headers, event, rawBody) {
  const publicKey = config.WISE_WEBHOOK_PUBLIC_KEY || process.env.WISE_WEBHOOK_PUBLIC_KEY || '';
  assertProductionWebhookSecret('Wise', publicKey);
  if (publicKey) {
    verifyWiseSignature(rawBody, headers.signature, publicKey);
  }
  // When WISE_WEBHOOK_PUBLIC_KEY is not set, skip verification (dev/test mode only)

  const eventType = String(event?.event_type || 'unknown');
  const resourceId = String(
    event?.data?.resource?.id ||
    event?.data?.id ||
    event?.data?.transfer_id ||
    ''
  );

  return ingestVerifiedProviderEvent({
    provider: 'wise',
    eventId: resourceId || `wise:${Date.now()}`,
    eventType,
    resourceType: event?.data?.resource_type || null,
    transmissionId: headers.signature || null,
    payload: event,
    verificationPayload: { signature_header_present: Boolean(headers.signature) }
  });
}

async function processWebhookEvent(webhookEventId) {
  const webhookEvent = await webhookEventRepository.findById(webhookEventId);
  if (!webhookEvent) {
    throw new AppError(404, 'WEBHOOK_EVENT_NOT_FOUND', 'Webhook event not found.');
  }

  if ([WEBHOOK_PROCESSING_STATUS.PROCESSED, WEBHOOK_PROCESSING_STATUS.IGNORED].includes(webhookEvent.status)) {
    return {
      status: webhookEvent.status,
      skipped: true
    };
  }

  const claim = await webhookEventRepository.claimForProcessing(webhookEvent.id);
  if (!claim.claimed) {
    return {
      status: claim.webhookEvent?.status || webhookEvent.status,
      skipped: true
    };
  }

  const event = claim.webhookEvent.payload;

  try {
    switch (webhookEvent.eventType) {
      case 'invoice.finalized':
      case 'invoice.sent':
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
      case 'invoice.updated':
      case 'invoice.voided':
        await providerInvoiceWebhookHandlers.handleStripeInvoiceEvent(event);
        break;
      case 'account.updated':
        await providerInvoiceWebhookHandlers.handleStripeAccountEvent(event);
        break;
      case 'charge:created':
      case 'charge:pending':
      case 'charge:confirmed':
      case 'charge:failed':
      case 'charge:delayed':
      case 'charge:resolved':
      case 'checkout.payment.success':
      case 'checkout.payment.failed':
      case 'checkout.payment.expired':
        await providerInvoiceWebhookHandlers.handleCryptoChargeEvent(event);
        break;
      case 'charge.success':
        await providerInvoiceWebhookHandlers.handlePaystackChargeEvent(event);
        break;
      case 'charge.completed':
        await providerInvoiceWebhookHandlers.handleFlutterwaveChargeEvent(event);
        break;
      case 'transfers#state-change':
        await providerInvoiceWebhookHandlers.handleWiseTransferEvent(event);
        break;
      case 'INVOICING.INVOICE.CREATED':
        await paypalWebhookHandlers.handleInvoiceCreated(event);
        break;
      case 'INVOICING.INVOICE.SCHEDULED':
        await paypalWebhookHandlers.handleInvoiceScheduled(event);
        break;
      case 'INVOICING.INVOICE.PAID':
        await paypalWebhookHandlers.handleInvoicePaid(event);
        break;
      case 'INVOICING.INVOICE.CANCELLED':
        await paypalWebhookHandlers.handleInvoiceCancelled(event);
        break;
      case 'INVOICING.INVOICE.REFUNDED':
        await paypalWebhookHandlers.handleInvoiceRefunded(event);
        break;
      case 'INVOICING.INVOICE.UPDATED':
        await paypalWebhookHandlers.handleInvoiceUpdated(event);
        break;
      case 'PAYMENT.PAYOUTSBATCH.PROCESSING':
      case 'PAYMENT.PAYOUTSBATCH.SUCCESS':
      case 'PAYMENT.PAYOUTSBATCH.DENIED':
      case 'PAYMENT.PAYOUTS-ITEM.BLOCKED':
      case 'PAYMENT.PAYOUTS-ITEM.CANCELED':
      case 'PAYMENT.PAYOUTS-ITEM.DENIED':
      case 'PAYMENT.PAYOUTS-ITEM.FAILED':
      case 'PAYMENT.PAYOUTS-ITEM.HELD':
      case 'PAYMENT.PAYOUTS-ITEM.PROCESSING':
      case 'PAYMENT.PAYOUTS-ITEM.REFUNDED':
      case 'PAYMENT.PAYOUTS-ITEM.RETURNED':
      case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
      case 'PAYMENT.PAYOUTS-ITEM.UNCLAIMED':
        await paypalWebhookHandlers.handlePayoutEvent(event);
        break;
      default:
        await webhookEventRepository.update(webhookEvent.id, {
          status: WEBHOOK_PROCESSING_STATUS.IGNORED,
          processedAt: new Date().toISOString(),
          lastError: null
        });
        return {
          status: WEBHOOK_PROCESSING_STATUS.IGNORED
        };
    }

  } catch (error) {
    await webhookEventRepository.update(webhookEvent.id, {
      status: WEBHOOK_PROCESSING_STATUS.FAILED,
      lastError: error.message
    });
    throw error;
  }

  const trigger = webhookAutomationTrigger(webhookEvent.eventType);
  if (trigger) {
    try {
      await automationDispatchService.dispatch({
        event: {
          trigger,
          eventId: webhookEvent.eventId,
          entityId: event?.resource?.id || event?.data?.id || event?.id || null,
          provider: webhookEvent.provider || null,
          status: event?.resource?.status || event?.data?.status || null,
          occurredAt: event?.create_time || event?.created_at || new Date().toISOString()
        }
      });
    } catch (error) {
      await auditLogService.log({
        actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
        action: 'automation.dispatch_failed',
        entityType: 'webhook_event',
        entityId: webhookEvent.id,
        metadata: { trigger, error: error.message }
      });
    }
  }

  await webhookEventRepository.update(webhookEvent.id, {
    status: WEBHOOK_PROCESSING_STATUS.PROCESSED,
    processedAt: new Date().toISOString(),
    lastError: null
  });

  return {
    status: WEBHOOK_PROCESSING_STATUS.PROCESSED
  };
}

module.exports = {
  webhookService: {
    ingestPayPalEvent,
    ingestStripeEvent,
    ingestCryptoEvent,
    ingestPaystackEvent,
    ingestFlutterwaveEvent,
    ingestWiseEvent,
    processWebhookEvent,
    validateStatusTransition,
    compareProviderTransaction,
    findLedgerEntryForTransaction,
    createReconciliationCase
  }
};
