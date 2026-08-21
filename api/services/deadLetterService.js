const { createHash } = require('node:crypto');

const { deadLetterRepository } = require('../repositories/deadLetterRepository');
const { DEAD_LETTER_STATUS } = require('../utils/constants');
const { buildQueueJobId } = require('../utils/queueJobId');
const { classifyWorkerFailure } = require('../jobs/workerHelpers');

function hashJobData(job) {
  return createHash('sha256')
    .update(JSON.stringify({ name: job?.name || null, data: job?.data || null }))
    .digest('hex');
}

function buildDeadLetterSourceKey(queueName, job) {
  const sourceJobId = job?.id ? String(job.id) : `anonymous-${hashJobData(job)}`;
  return buildQueueJobId('dead-letter-source', queueName, sourceJobId);
}

function buildPersistentDeadLetterPayload(queueName, job, error, record, classification) {
  return {
    sourceQueue: queueName,
    sourceJobId: job.id || null,
    payload: job.data,
    error: error?.message || 'Worker processing failed.',
    errorCode: classification.code,
    failureClassification: classification.classification,
    retryable: classification.retryable,
    attemptsMade: Number(job.attemptsMade || 0),
    correlationId: job.data?.correlationId || job.id || null,
    deadLetterRecordId: record.id
  };
}

function createDeadLetterService({ repository = deadLetterRepository } = {}) {
  async function recordExhaustedJob({ queueName, deadLetterQueue, job, error }) {
    if (!job) {
      return null;
    }

    const classification = classifyWorkerFailure(error);
    const failureMessage = error?.message || 'Worker processing failed.';
    const sourceKey = buildDeadLetterSourceKey(queueName, job);
    const record = await repository.createOrGet({
      sourceKey,
      sourceQueue: queueName,
      sourceJobId: job.id ? String(job.id) : null,
      jobName: `${queueName}-dead-letter`,
      payload: job.data || {},
      failureCode: classification.code,
      failureMessage,
      failureClassification: classification.classification,
      retryable: classification.retryable,
      attemptsMade: Number(job.attemptsMade || 0),
      status: DEAD_LETTER_STATUS.OPEN,
      correlationId: job.data?.correlationId || job.id || null,
      metadata: {
        configuredAttempts: Number(job.opts?.attempts || 1),
        workerJobName: job.name || null
      }
    });

    const payload = buildPersistentDeadLetterPayload(
      queueName,
      job,
      error,
      record,
      classification
    );
    const deadLetterJob = await deadLetterQueue.add(record.jobName, payload, {
      jobId: buildQueueJobId('dead-letter', record.id)
    });

    return repository.attachDeadLetterJob(record.id, deadLetterJob.id);
  }

  return {
    recordExhaustedJob
  };
}

const deadLetterService = createDeadLetterService();

module.exports = {
  buildDeadLetterSourceKey,
  buildPersistentDeadLetterPayload,
  createDeadLetterService,
  deadLetterService
};
