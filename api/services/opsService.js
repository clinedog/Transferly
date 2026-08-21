const { randomUUID } = require('node:crypto');

const QUEUE_COUNT_STATES = Object.freeze([
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused'
]);

const { AUDIT_ACTOR_TYPE, DEAD_LETTER_STATUS } = require('../utils/constants');
const config = require('../config');
const { operationalMetrics } = require('../core/observability/operationalMetrics');
const { AppError } = require('../utils/errors');
const { buildQueueJobId } = require('../utils/queueJobId');
const { outboxEventRepository } = require('../repositories/outboxEventRepository');

const RECOVERY_JOB_NAMES = Object.freeze({
  'invoice-send': 'create-and-send-invoice',
  'order-process': 'process-order',
  'payout-process': 'process-approved-payout',
  'webhook-process': 'process-paypal-webhook',
  'payout-retry': 'retry-payout-status-poll',
  'payment-reconciliation': 'run-payment-reconciliation'
});
const RECOVERY_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

function getQueueRuntime() {
  return require('../jobs/queues');
}

function getDeadLetterPersistence() {
  const { transaction } = require('../db');
  const { deadLetterRepository } = require('../repositories/deadLetterRepository');
  const { auditLogService } = require('./auditLogService');
  return { auditLogService, deadLetterRepository, transaction };
}

function buildQueueRegistry(runtime) {
  const registry = [
    { key: 'invoice_send', name: runtime.queueNames.invoiceSend, queue: runtime.invoiceSendQueue },
    { key: 'order_process', name: runtime.queueNames.orderProcess, queue: runtime.orderProcessQueue },
    { key: 'payout_process', name: runtime.queueNames.payoutProcess, queue: runtime.payoutProcessQueue },
    { key: 'webhook_process', name: runtime.queueNames.webhookProcess, queue: runtime.webhookProcessQueue },
    { key: 'payout_retry', name: runtime.queueNames.payoutRetry, queue: runtime.payoutRetryQueue },
    { key: 'payment_reconciliation', name: runtime.queueNames.reconciliation, queue: runtime.reconciliationQueue },
    { key: 'dead_letter', name: runtime.queueNames.deadLetter, queue: runtime.deadLetterQueue }
  ];

  if (runtime.queueNames.assetCleanup && runtime.assetCleanupQueue) {
    registry.splice(registry.length - 1, 0, {
      key: 'asset_cleanup',
      name: runtime.queueNames.assetCleanup,
      queue: runtime.assetCleanupQueue
    });
  }

  return registry;
}

function presentQueueCounts(counts) {
  return QUEUE_COUNT_STATES.reduce((result, state) => {
    result[state] = counts[state] || 0;
    return result;
  }, {});
}

async function buildQueueSnapshot(entry) {
  const counts = await entry.queue.getJobCounts(...QUEUE_COUNT_STATES);
  return {
    key: entry.key,
    name: entry.name,
    counts: presentQueueCounts(counts)
  };
}

function mapDeadLetterJob(job) {
  const data = job.data || {};

  return {
    job_id: job.id,
    name: job.name,
    attempts_made: job.attemptsMade,
    failed_reason: job.failedReason || null,
    queue_name: job.queueName,
    source_queue: data.sourceQueue || data.source_queue || data.queueName || null,
    source_job_id: data.sourceJobId || data.source_job_id || null,
    recovery: data.recovery || null,
    data,
    created_at: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    finished_at: job.finishedOn ? new Date(job.finishedOn).toISOString() : null
  };
}

function buildRecordRecovery(record) {
  if (!record.recoveryStartedAt && !record.recoveredAt && !record.recoveryJobId) {
    return null;
  }

  return {
    recoveredAt: record.recoveredAt || null,
    recoveredByActorId: record.recoveredByActorId || null,
    note: record.recoveryNote || null,
    recoveryJobId: record.recoveryJobId || null,
    recoveryJobName: record.recoveryJobName || null,
    sourceQueue: record.sourceQueue,
    status: record.status,
    startedAt: record.recoveryStartedAt || null,
    lastError: record.lastRecoveryError || null
  };
}

function mapDeadLetterRecord(record) {
  return {
    job_id: record.id,
    queue_job_id: record.deadLetterJobId || null,
    record_id: record.id,
    name: record.jobName,
    attempts_made: record.attemptsMade,
    failed_reason: record.failureMessage,
    failure_code: record.failureCode || null,
    failure_classification: record.failureClassification,
    retryable: record.retryable,
    status: record.status,
    queue_name: 'dead-letter',
    source_queue: record.sourceQueue,
    source_job_id: record.sourceJobId || null,
    correlation_id: record.correlationId || null,
    recovery: buildRecordRecovery(record),
    data: {
      sourceQueue: record.sourceQueue,
      sourceJobId: record.sourceJobId || null,
      payload: record.payload,
      error: record.failureMessage,
      errorCode: record.failureCode || null,
      failureClassification: record.failureClassification,
      retryable: record.retryable,
      attemptsMade: record.attemptsMade,
      correlationId: record.correlationId || null,
      deadLetterRecordId: record.id,
      metadata: record.metadata
    },
    created_at: record.createdAt,
    finished_at: record.failedAt
  };
}

function getQueueByName(runtime, queueName) {
  return buildQueueRegistry(runtime).find((entry) => entry.name === queueName)?.queue || null;
}

function resolveRecoveryJobName(sourceQueue, deadLetterJob) {
  return RECOVERY_JOB_NAMES[sourceQueue] || String(deadLetterJob.name || '').replace(/-dead-letter$/, '') || `${sourceQueue}-recovered`;
}

async function getQueueOverview() {
  const runtime = getQueueRuntime();
  const queues = await Promise.all(buildQueueRegistry(runtime).map(buildQueueSnapshot));
  return {
    generated_at: new Date().toISOString(),
    redis_status: runtime.redisConnection.status,
    queues
  };
}

async function getOperationalDiagnostics({
  requestId = null,
  correlationId = null,
  queueOverviewProvider = getQueueOverview,
  outboxSummaryProvider = () => outboxEventRepository.getStatusSummary()
} = {}) {
  const metrics = operationalMetrics.snapshot({ requestId, correlationId });
  let queueOverview = null;
  let queueError = null;
  let outbox = null;
  let outboxError = null;

  try {
    queueOverview = await queueOverviewProvider();
  } catch (error) {
    queueError = {
      code: error.code || 'QUEUE_DIAGNOSTICS_UNAVAILABLE',
      message: error.message || 'Queue diagnostics unavailable.'
    };
  }

  try {
    outbox = await outboxSummaryProvider();
  } catch (error) {
    outboxError = {
      code: error.code || 'OUTBOX_DIAGNOSTICS_UNAVAILABLE',
      message: error.message || 'Outbox diagnostics unavailable.'
    };
  }

  const memoryUsage = process.memoryUsage();
  const queues = queueOverview?.queues || [];
  const failedJobs = queues.reduce((total, queue) => total + Number(queue.counts?.failed || 0), 0);
  const delayedJobs = queues.reduce((total, queue) => total + Number(queue.counts?.delayed || 0), 0);
  const activeJobs = queues.reduce((total, queue) => total + Number(queue.counts?.active || 0), 0);
  const deadLetterQueue = queues.find((queue) => queue.key === 'dead_letter');
  const deadLetterWaiting = Number(deadLetterQueue?.counts?.waiting || 0) + Number(deadLetterQueue?.counts?.delayed || 0);
  const degradedReasons = [];

  if (queueError) degradedReasons.push('queue_diagnostics_unavailable');
  if (failedJobs > 0) degradedReasons.push('queue_failed_jobs_present');
  if (deadLetterWaiting > 0) degradedReasons.push('dead_letter_jobs_waiting');
  if (outboxError) degradedReasons.push('outbox_diagnostics_unavailable');
  if (Number(outbox?.failed || 0) > 0) degradedReasons.push('outbox_terminal_failures_present');
  if (metrics.requests.errorRate >= 0.05 && metrics.requests.total >= 10) degradedReasons.push('api_error_rate_elevated');
  if (metrics.requests.latencyMs.average >= 1000) degradedReasons.push('api_latency_elevated');
  if (config.NODE_ENV === 'production' && config.INLINE_QUEUE_MODE) degradedReasons.push('queue_inline_mode_in_production');

  return {
    requestId,
    correlationId,
    generatedAt: new Date().toISOString(),
    status: degradedReasons.length > 0 ? 'degraded' : 'healthy',
    signals: {
      live: true,
      ready: degradedReasons.length === 0,
      degraded: degradedReasons.length > 0,
      unavailable: false
    },
    environment: {
      nodeEnv: config.NODE_ENV,
      releaseVersion: process.env.RELEASE_VERSION || process.env.npm_package_version || null,
      queueMode: config.INLINE_QUEUE_MODE ? 'inline' : 'redis'
    },
    runtime: {
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024)
      }
    },
    metrics,
    queues: {
      status: queueError ? 'unavailable' : 'available',
      error: queueError,
      activeJobs,
      failedJobs,
      delayedJobs,
      deadLetterWaiting,
      data: queues
    },
    outbox: {
      status: outboxError ? 'unavailable' : 'available',
      error: outboxError,
      counts: outbox
    },
    degradedReasons
  };
}

async function listDeadLetterJobs(limit = 50) {
  const { deadLetterRepository } = getDeadLetterPersistence();
  const records = await deadLetterRepository.findMany(limit);
  const persistentJobs = records.map(mapDeadLetterRecord);
  if (persistentJobs.length >= limit) {
    return persistentJobs.slice(0, limit);
  }

  const runtime = getQueueRuntime();
  let jobs;
  try {
    jobs = await runtime.deadLetterQueue.getJobs(
      ['waiting', 'delayed', 'active', 'completed', 'failed'],
      0,
      Math.max(limit - 1, 0),
      false
    );
  } catch (error) {
    const { logger } = require('../utils/logger');
    logger.warn({ err: error }, 'Unable to merge legacy Redis dead-letter jobs');
    return persistentJobs;
  }

  const persistentRecordIds = new Set(records.map((record) => record.id));
  const persistentQueueJobIds = new Set(
    records.filter((record) => record.deadLetterJobId).map((record) => String(record.deadLetterJobId))
  );
  const legacyJobs = jobs.filter((job) =>
    !persistentQueueJobIds.has(String(job.id)) &&
    !persistentRecordIds.has(String(job.data?.deadLetterRecordId || ''))
  );

  return persistentJobs.concat(legacyJobs.map(mapDeadLetterJob)).slice(0, limit);
}

function buildRecoveryResult(record) {
  return {
    dead_letter: mapDeadLetterRecord(record),
    recovery: {
      recovered_at: record.recoveredAt || null,
      recovered_by_actor_id: record.recoveredByActorId || null,
      note: record.recoveryNote || null,
      source_queue: record.sourceQueue,
      recovery_job_id: record.recoveryJobId || null,
      recovery_job_name: record.recoveryJobName || null,
      status: record.status
    }
  };
}

function isRecoveryClaimStale(record, now = Date.now()) {
  if (record.status !== DEAD_LETTER_STATUS.RECOVERY_PENDING) {
    return false;
  }

  const startedAt = Date.parse(record.recoveryStartedAt || '');
  return !Number.isFinite(startedAt) || startedAt <= now - RECOVERY_CLAIM_TIMEOUT_MS;
}

function validateRecoverablePayload(sourceQueue, payload, runtime) {
  const targetQueue = sourceQueue ? getQueueByName(runtime, sourceQueue) : null;
  if (!sourceQueue || sourceQueue === runtime.queueNames.deadLetter || !targetQueue) {
    throw new AppError(422, 'DEAD_LETTER_SOURCE_UNRECOVERABLE', 'Dead-letter job source queue cannot be recovered.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError(422, 'DEAD_LETTER_PAYLOAD_UNRECOVERABLE', 'Dead-letter job payload cannot be recovered.');
  }

  return targetQueue;
}

async function recoverPersistentDeadLetter(record, { runtime, adminActorId, note }) {
  const { auditLogService, deadLetterRepository, transaction } = getDeadLetterPersistence();
  if (record.status === DEAD_LETTER_STATUS.RECOVERED) {
    return buildRecoveryResult(record);
  }
  if (
    record.status === DEAD_LETTER_STATUS.RECOVERY_PENDING &&
    !isRecoveryClaimStale(record)
  ) {
    throw new AppError(409, 'DEAD_LETTER_RECOVERY_IN_PROGRESS', 'Dead-letter recovery is already in progress.');
  }

  const targetQueue = validateRecoverablePayload(record.sourceQueue, record.payload, runtime);
  const recoveryJobName = resolveRecoveryJobName(record.sourceQueue, { name: record.jobName });
  const recoveryToken = randomUUID();
  const startedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - RECOVERY_CLAIM_TIMEOUT_MS).toISOString();
  const claimed = await transaction((client) => deadLetterRepository.claimRecovery({
    id: record.id,
    recoveryToken,
    startedAt,
    staleBefore,
    adminActorId,
    note
  }, client));

  if (!claimed) {
    const current = await deadLetterRepository.findById(record.id);
    if (current?.status === DEAD_LETTER_STATUS.RECOVERED) {
      return buildRecoveryResult(current);
    }
    if (current?.status === DEAD_LETTER_STATUS.RECOVERY_PENDING) {
      throw new AppError(409, 'DEAD_LETTER_RECOVERY_IN_PROGRESS', 'Dead-letter recovery is already in progress.');
    }
    throw new AppError(409, 'DEAD_LETTER_RECOVERY_CONFLICT', 'Dead-letter recovery state changed.');
  }

  try {
    const recoveryJob = await targetQueue.add(recoveryJobName, record.payload, {
      jobId: buildQueueJobId('recovered', record.id)
    });
    const recoveredAt = new Date().toISOString();
    const recovered = await transaction(async (client) => {
      const updated = await deadLetterRepository.markRecovered({
        id: record.id,
        recoveryToken,
        recoveredAt,
        recoveryJobId: recoveryJob.id,
        recoveryJobName
      }, client);
      if (!updated) {
        throw new AppError(409, 'DEAD_LETTER_RECOVERY_CONFLICT', 'Dead-letter recovery state changed.');
      }

      await auditLogService.log({
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'dead_letter.recovered',
        entityType: 'dead_letter_record',
        entityId: record.id,
        metadata: {
          source_queue: record.sourceQueue,
          source_job_id: record.sourceJobId,
          recovery_job_id: recoveryJob.id,
          recovery_job_name: recoveryJobName,
          note: note || null
        }
      }, client);

      return updated;
    });

    return buildRecoveryResult(recovered);
  } catch (error) {
    try {
      await deadLetterRepository.markRecoveryFailed({
        id: record.id,
        recoveryToken,
        errorMessage: error.message
      });
    } catch (stateError) {
      const { logger } = require('../utils/logger');
      logger.error({ err: stateError, deadLetterRecordId: record.id }, 'Unable to persist dead-letter recovery failure');
    }
    throw error;
  }
}

async function recoverLegacyDeadLetterJob(deadLetterJob, { runtime, adminActorId, note }) {
  const { auditLogService } = getDeadLetterPersistence();
  const existingRecovery = deadLetterJob.data?.recovery;
  if (existingRecovery?.recoveryJobId) {
    return {
      dead_letter: mapDeadLetterJob(deadLetterJob),
      recovery: {
        recovered_at: existingRecovery.recoveredAt || null,
        recovered_by_actor_id: existingRecovery.recoveredByActorId || null,
        note: existingRecovery.note || null,
        source_queue: existingRecovery.sourceQueue || null,
        recovery_job_id: existingRecovery.recoveryJobId,
        recovery_job_name: existingRecovery.recoveryJobName || null
      }
    };
  }

  const sourceQueue = deadLetterJob.data?.sourceQueue || deadLetterJob.data?.source_queue || deadLetterJob.data?.queueName;
  const payload = deadLetterJob.data?.payload;
  const targetQueue = validateRecoverablePayload(sourceQueue, payload, runtime);

  const recoveredAt = new Date().toISOString();
  const recoveryJobName = resolveRecoveryJobName(sourceQueue, deadLetterJob);
  const recoveryJob = await targetQueue.add(recoveryJobName, payload, {
    jobId: buildQueueJobId('recovered', sourceQueue, deadLetterJob.id)
  });
  const recovery = {
    recovered_at: recoveredAt,
    recovered_by_actor_id: adminActorId || null,
    note: note || null,
    source_queue: sourceQueue,
    recovery_job_id: recoveryJob.id,
    recovery_job_name: recoveryJobName
  };

  const updatedDeadLetterData = {
    ...(deadLetterJob.data || {}),
    recovery: {
      recoveredAt,
      recoveredByActorId: adminActorId || null,
      note: note || null,
      recoveryJobId: recoveryJob.id,
      recoveryJobName,
      sourceQueue
    }
  };

  if (typeof deadLetterJob.updateData === 'function') {
    await deadLetterJob.updateData(updatedDeadLetterData);
  }
  deadLetterJob.data = updatedDeadLetterData;

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'dead_letter.recovered',
    entityType: 'dead_letter_job',
    entityId: String(deadLetterJob.id),
    metadata: {
      source_queue: sourceQueue,
      source_job_id: deadLetterJob.data?.sourceJobId || deadLetterJob.data?.source_job_id || null,
      recovery_job_id: recoveryJob.id,
      recovery_job_name: recoveryJobName,
      note: note || null
    }
  });

  return {
    dead_letter: mapDeadLetterJob(deadLetterJob),
    recovery
  };
}

async function recoverDeadLetterJob(jobId, { adminActorId, note } = {}) {
  const { deadLetterRepository } = getDeadLetterPersistence();
  const runtime = getQueueRuntime();
  const record = await deadLetterRepository.findByIdentifier(jobId);
  if (record) {
    return recoverPersistentDeadLetter(record, { runtime, adminActorId, note });
  }

  const deadLetterJob = await runtime.deadLetterQueue.getJob(jobId);
  if (!deadLetterJob) {
    throw new AppError(404, 'DEAD_LETTER_JOB_NOT_FOUND', 'Dead-letter job not found.');
  }

  return recoverLegacyDeadLetterJob(deadLetterJob, { runtime, adminActorId, note });
}

const opsService = {
  getOperationalDiagnostics,
  getQueueOverview,
  listDeadLetterJobs,
  recoverDeadLetterJob
};

module.exports = {
  opsService,
  QUEUE_COUNT_STATES,
  RECOVERY_CLAIM_TIMEOUT_MS,
  buildQueueRegistry,
  buildQueueSnapshot,
  getOperationalDiagnostics,
  getQueueOverview,
  listDeadLetterJobs,
  recoverDeadLetterJob,
  mapDeadLetterJob,
  mapDeadLetterRecord,
  isRecoveryClaimStale,
  recoverPersistentDeadLetter,
  resolveRecoveryJobName
};
