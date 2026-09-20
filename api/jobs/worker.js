const { Worker } = require('bullmq');

const config = require('../config');
const { close, initializeDatabase } = require('../db');
const {
  assetCleanupQueue,
  deadLetterQueue,
  payoutRetryQueue,
  payoutProcessQueue,
  pointReservationExpiryQueue,
  reconciliationQueue,
  queueNames,
  redisConnection
} = require('./queues');
const {
  createCleanupExpiredAssetJob,
  registerExpiredAssetCleanupSchedule
} = require('./cleanupExpiredAssetJob');
const {
  createExpirePointReservationJob,
  registerPointReservationExpirySchedule
} = require('./expirePointReservationJob');
const { registerPaymentReconciliationSchedule } = require('./paymentReconciliationJob');
const {
  RETRY_DELAYS_MS,
  classifyWorkerFailure,
  createClassifiedJobProcessor,
  createOrderJobProcessor,
  createPayoutJobProcessor,
  createWorkerFailureHandler
} = require('./workerHelpers');
const { createOutboxDispatcher } = require('./outboxDispatcher');
const { logger } = require('../utils/logger');
const { assetStorageService } = require('../services/assetStorageService');
const { deadLetterService } = require('../services/deadLetterService');
const { orderService } = require('../services/orderService');
const { providerInvoiceService } = require('../services/providerInvoiceService');
const { paymentReconciliationService } = require('../services/paymentReconciliationService');
const { payoutProcessingService } = require('../services/payoutProcessingService');
const { webhookService } = require('../services/webhookService');

const OUTBOX_POLL_INTERVAL_MS = 1000;
let outboxPollTimer = null;
let outboxPollActive = false;
const outboxDispatcher = createOutboxDispatcher({
  resolveQueue: (queueName) => queueName === queueNames.payoutProcess ? payoutProcessQueue : null
});

async function pollOutbox() {
  if (outboxPollActive) return;
  outboxPollActive = true;
  try {
    const results = await outboxDispatcher.drain();
    const failures = results.filter((result) => result.error);
    if (failures.length > 0) {
      logger.warn({ failureCount: failures.length }, 'Outbox dispatch attempts failed and were scheduled for retry.');
    }
  } catch (error) {
    logger.error({ err: error }, 'Outbox polling failed.');
  } finally {
    outboxPollActive = false;
  }
}

const invoiceWorker = new Worker(
  queueNames.invoiceSend,
  createClassifiedJobProcessor(async (job) => providerInvoiceService.createAndSendInvoice(job.data)),
  {
    connection: redisConnection,
    concurrency: 2
  }
);

const orderWorker = new Worker(
  queueNames.orderProcess,
  createClassifiedJobProcessor(
    createOrderJobProcessor({
      orderService
    })
  ),
  {
    connection: redisConnection,
    concurrency: 2
  }
);

const payoutWorker = new Worker(
  queueNames.payoutProcess,
  createClassifiedJobProcessor(
    createPayoutJobProcessor({
      payoutService: payoutProcessingService,
      retryQueue: payoutRetryQueue,
      retryDelayMs: RETRY_DELAYS_MS.initialPayoutPoll
    })
  ),
  {
    connection: redisConnection,
    concurrency: 2
  }
);

const payoutRetryWorker = new Worker(
  queueNames.payoutRetry,
  createClassifiedJobProcessor(
    createPayoutJobProcessor({
      payoutService: payoutProcessingService,
      retryQueue: payoutRetryQueue,
      retryDelayMs: RETRY_DELAYS_MS.followUpPayoutPoll
    })
  ),
  {
    connection: redisConnection,
    concurrency: 1
  }
);

const webhookWorker = new Worker(
  queueNames.webhookProcess,
  createClassifiedJobProcessor(async (job) => webhookService.processWebhookEvent(job.data.webhookEventId)),
  {
    connection: redisConnection,
    concurrency: 2
  }
);

const reconciliationWorker = new Worker(
  queueNames.reconciliation,
  createClassifiedJobProcessor(async (job) => paymentReconciliationService.runPaymentReconciliation(job.data)),
  {
    connection: redisConnection,
    concurrency: 1
  }
);

const assetCleanupWorker = new Worker(
  queueNames.assetCleanup,
  createClassifiedJobProcessor(
    createCleanupExpiredAssetJob({
      assetStorageService,
      batchSize: config.GENERATED_ASSET_CLEANUP_BATCH_SIZE,
      reconcileOrphans: config.GENERATED_ASSET_ORPHAN_DELETE_ENABLED
    })
  ),
  {
    connection: redisConnection,
    concurrency: 1
  }
);

const pointReservationExpiryWorker = new Worker(
  queueNames.pointReservationExpiry,
  createClassifiedJobProcessor(
    createExpirePointReservationJob({
      orderService,
      batchSize: config.POINT_RESERVATION_EXPIRY_BATCH_SIZE
    })
  ),
  {
    connection: redisConnection,
    concurrency: 1
  }
);

for (const [queueName, worker] of [
  [queueNames.invoiceSend, invoiceWorker],
  [queueNames.orderProcess, orderWorker],
  [queueNames.payoutProcess, payoutWorker],
  [queueNames.payoutRetry, payoutRetryWorker],
  [queueNames.webhookProcess, webhookWorker],
  [queueNames.reconciliation, reconciliationWorker],
  [queueNames.assetCleanup, assetCleanupWorker],
  [queueNames.pointReservationExpiry, pointReservationExpiryWorker]
]) {
  worker.on(
    'failed',
    createWorkerFailureHandler({
      queueName,
      deadLetterQueue,
      deadLetterHandler: (job, error) => deadLetterService.recordExhaustedJob({
        queueName,
        deadLetterQueue,
        job,
        error
      }),
      onExhausted:
        queueName === queueNames.orderProcess
          ? async (job, error) => {
            const failure = classifyWorkerFailure(error);
            return orderService.markOrderFailed({
              orderId: job.data.orderId,
              dispatchGeneration: job.data.dispatchGeneration,
              failureCode: failure.retryable ? 'ORDER_JOB_EXHAUSTED' : 'ORDER_JOB_TERMINAL',
              failureMessage: error.message,
              actorId: 'order-worker',
              reason: failure.retryable ? 'worker_attempts_exhausted' : 'worker_terminal_failure',
              metadata: {
                sourceJobId: job.id || null,
                sourceQueue: queueName,
                correlationId: job.data.correlationId || job.id || null,
                queueAttempts: job.attemptsMade || null,
                failureClassification: failure.classification
              }
            });
          }
          : null
    })
  );
}

async function bootstrap() {
  await initializeDatabase();
  await registerExpiredAssetCleanupSchedule(assetCleanupQueue, {
    intervalMs: config.GENERATED_ASSET_CLEANUP_INTERVAL_MS,
    batchSize: config.GENERATED_ASSET_CLEANUP_BATCH_SIZE
  });
  await registerPointReservationExpirySchedule(pointReservationExpiryQueue, {
    intervalMs: config.POINT_RESERVATION_EXPIRY_INTERVAL_MS,
    batchSize: config.POINT_RESERVATION_EXPIRY_BATCH_SIZE
  });
  await registerPaymentReconciliationSchedule(reconciliationQueue, {
    intervalMs: config.PAYMENT_RECONCILIATION_INTERVAL_MS,
    invoiceLimit: config.PAYMENT_RECONCILIATION_INVOICE_LIMIT,
    payoutLimit: config.PAYMENT_RECONCILIATION_PAYOUT_LIMIT
  });

  await Promise.all([
    invoiceWorker.waitUntilReady(),
    orderWorker.waitUntilReady(),
    payoutWorker.waitUntilReady(),
    payoutRetryWorker.waitUntilReady(),
    webhookWorker.waitUntilReady(),
    reconciliationWorker.waitUntilReady(),
    assetCleanupWorker.waitUntilReady(),
    pointReservationExpiryWorker.waitUntilReady()
  ]);

  await pollOutbox();
  outboxPollTimer = setInterval(() => {
    void pollOutbox();
  }, OUTBOX_POLL_INTERVAL_MS);

  logger.info('Workers are ready.');
}

async function shutdown() {
  if (outboxPollTimer) {
    clearInterval(outboxPollTimer);
    outboxPollTimer = null;
  }
  await Promise.all([
    invoiceWorker.close(),
    orderWorker.close(),
    payoutWorker.close(),
    payoutRetryWorker.close(),
    webhookWorker.close(),
    reconciliationWorker.close(),
    assetCleanupWorker.close(),
    pointReservationExpiryWorker.close()
  ]);
  await redisConnection.quit();
  await close();
  process.exit(0);
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, 'Worker bootstrap failed');
  try {
    await redisConnection.quit();
    await close();
  } catch (_closeError) {
    // Ignore shutdown noise after bootstrap failures.
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});
