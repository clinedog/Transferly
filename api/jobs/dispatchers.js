const config = require('../config');
const { orderRepository } = require('../repositories/orderRepository');
const { outboxEventRepository } = require('../repositories/outboxEventRepository');
const { orderService } = require('../services/orderService');
const { providerInvoiceService } = require('../services/providerInvoiceService');
const { paymentReconciliationService } = require('../services/paymentReconciliationService');
const { payoutProcessingService } = require('../services/payoutProcessingService');
const { webhookService } = require('../services/webhookService');
const { AppError } = require('../utils/errors');
const { buildOrderDispatchIdentity } = require('../utils/orderDispatch');
const { buildQueueJobId } = require('../utils/queueJobId');
const { createOutboxDispatcher } = require('./outboxDispatcher');
const { payoutOutboxService } = require('../services/payoutOutboxService');

const OUTBOX_STATUS_POLL_MS = 50;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForOutboxJob(eventId) {
  const deadline = Date.now() + config.JOB_WAIT_MS;
  while (Date.now() < deadline) {
    const event = await outboxEventRepository.findById(eventId);
    if (event?.status === 'dispatched' && event.queueJobId) return event;
    if (!event || event.status === 'failed' || event.status === 'pending') return event;
    await delay(OUTBOX_STATUS_POLL_MS);
  }
  return outboxEventRepository.findById(eventId);
}

async function dispatchInvoiceCreation(payload) {
  if (config.INLINE_QUEUE_MODE) {
    return providerInvoiceService.createAndSendInvoice(payload);
  }

  const { invoiceSendQueue, invoiceSendQueueEvents } = require('./queues');
  const job = await invoiceSendQueue.add('create-and-send-invoice', payload);
  return job.waitUntilFinished(invoiceSendQueueEvents, config.JOB_WAIT_MS);
}

async function dispatchOrderProcessing(orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }

  const dispatchIdentity = buildOrderDispatchIdentity(order);

  if (config.INLINE_QUEUE_MODE) {
    return orderService.processQueuedOrder({
      ...dispatchIdentity.payload,
      jobId: `inline-${dispatchIdentity.jobId}`
    });
  }

  const { orderProcessQueue } = require('./queues');
  const job = await orderProcessQueue.add(
    'process-order',
    dispatchIdentity.payload,
    { jobId: dispatchIdentity.jobId }
  );

  await orderService.markOrderDispatched({
    orderId,
    jobId: job.id,
    dispatchGeneration: dispatchIdentity.dispatchGeneration
  });

  return {
    orderId,
    jobId: job.id,
    dispatchGeneration: dispatchIdentity.dispatchGeneration
  };
}

async function dispatchPendingOrders({ limit = 25 } = {}) {
  const orders = await orderRepository.findDispatchPending({ limit });
  const results = [];

  for (const order of orders) {
    try {
      const result = await dispatchOrderProcessing(order.id);
      results.push({
        orderId: order.id,
        dispatched: true,
        result
      });
    } catch (error) {
      results.push({
        orderId: order.id,
        dispatched: false,
        error: {
          code: error.code || 'ORDER_DISPATCH_FAILED',
          message: error.message
        }
      });
    }
  }

  return {
    scanned: orders.length,
    dispatched: results.filter((result) => result.dispatched).length,
    failed: results.filter((result) => !result.dispatched).length,
    results
  };
}

async function dispatchPayoutProcessing(payoutId) {
  if (config.INLINE_QUEUE_MODE) {
    return payoutProcessingService.processQueuedPayout(payoutId);
  }

  const { payoutProcessQueue, payoutProcessQueueEvents, queueNames } = require('./queues');
  const event = await outboxEventRepository
    .findBySemanticKey(payoutOutboxService.payoutProcessingSemanticKey(payoutId));
  if (!event) {
    throw new AppError(409, 'PAYOUT_OUTBOX_EVENT_MISSING', 'Payout processing was not recorded durably.');
  }
  const dispatcher = createOutboxDispatcher({
    resolveQueue: (queueName) => queueName === queueNames.payoutProcess ? payoutProcessQueue : null
  });
  const dispatched = await dispatcher.dispatchOne(event.id);
  if (!dispatched) {
    const current = await waitForOutboxJob(event.id);
    if (current?.status === 'dispatched' && current.queueJobId) {
      const existingJob = await payoutProcessQueue.getJob(current.queueJobId);
      if (existingJob) {
        return existingJob.waitUntilFinished(payoutProcessQueueEvents, config.JOB_WAIT_MS);
      }
      throw new AppError(409, 'PAYOUT_JOB_NOT_RETAINED', 'The durable payout job is no longer retained for synchronous waiting.');
    }
    throw new AppError(409, 'PAYOUT_OUTBOX_NOT_DISPATCHABLE', 'Payout processing is already being dispatched.');
  }
  const job = dispatched.job;
  return job.waitUntilFinished(payoutProcessQueueEvents, config.JOB_WAIT_MS);
}

async function dispatchOutboxEvent(eventId) {
  const { payoutProcessQueue, queueNames } = require('./queues');
  const dispatcher = createOutboxDispatcher({
    resolveQueue: (queueName) => queueName === queueNames.payoutProcess ? payoutProcessQueue : null
  });
  return dispatcher.dispatchOne(eventId);
}

async function enqueueWebhookProcessing(webhookEventId, eventId) {
  if (config.INLINE_QUEUE_MODE) {
    await webhookService.processWebhookEvent(webhookEventId);
    return;
  }

  const { webhookProcessQueue } = require('./queues');
  await webhookProcessQueue.add(
    'process-paypal-webhook',
    { webhookEventId },
    { jobId: buildQueueJobId('webhook', eventId) }
  );
}

async function dispatchPaymentReconciliation(payload = {}) {
  if (config.INLINE_QUEUE_MODE) {
    return paymentReconciliationService.runPaymentReconciliation(payload);
  }

  const { reconciliationQueue, reconciliationQueueEvents } = require('./queues');
  const job = await reconciliationQueue.add('run-payment-reconciliation', payload);
  return job.waitUntilFinished(reconciliationQueueEvents, config.JOB_WAIT_MS);
}

module.exports = {
  dispatchInvoiceCreation,
  dispatchOutboxEvent,
  dispatchOrderProcessing,
  dispatchPendingOrders,
  dispatchPayoutProcessing,
  enqueueWebhookProcessing,
  dispatchPaymentReconciliation
};
