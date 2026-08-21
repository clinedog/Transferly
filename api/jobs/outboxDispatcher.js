const { randomUUID } = require('node:crypto');

const { transaction } = require('../db');
const { outboxEventRepository } = require('../repositories/outboxEventRepository');
const { buildQueueJobId } = require('../utils/queueJobId');

const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 5_000;

function addMilliseconds(isoTimestamp, milliseconds) {
  return new Date(new Date(isoTimestamp).getTime() + milliseconds).toISOString();
}

function safeErrorMessage(error) {
  return String(error?.message || 'Outbox dispatch failed.').slice(0, 1000);
}

function createOutboxDispatcher({
  resolveQueue,
  repository = outboxEventRepository,
  transact = transaction,
  now = () => new Date().toISOString(),
  leaseMs = DEFAULT_LEASE_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS
}) {
  async function claim(eventId) {
    const claimedAt = now();
    const data = {
      now: claimedAt,
      leaseToken: randomUUID(),
      leaseExpiresAt: addMilliseconds(claimedAt, leaseMs)
    };
    return transact((client) => eventId
      ? repository.claimById({ ...data, id: eventId }, client)
      : repository.claimNext(data, client));
  }

  async function dispatchOne(eventId) {
    const event = await claim(eventId);
    if (!event) return null;

    try {
      const queue = resolveQueue(event.queueName);
      if (!queue) {
        const error = new Error(`No queue is registered for outbox destination ${event.queueName}.`);
        error.code = 'OUTBOX_QUEUE_NOT_REGISTERED';
        throw error;
      }
      const job = await queue.add(
        event.jobName,
        { ...event.payload, outboxEventId: event.id, correlationId: event.correlationId },
        { jobId: buildQueueJobId('outbox', event.id) }
      );
      const dispatchedAt = now();
      const completed = await transact((client) => repository.markDispatched({
        id: event.id,
        leaseToken: event.leaseToken,
        fenceToken: event.fenceToken,
        queueJobId: job.id,
        dispatchedAt
      }, client));
      return completed ? { event: completed, job } : null;
    } catch (error) {
      const failedAt = now();
      await transact((client) => repository.markFailedAttempt({
        id: event.id,
        leaseToken: event.leaseToken,
        fenceToken: event.fenceToken,
        nextAttemptAt: addMilliseconds(failedAt, retryDelayMs),
        failedAt,
        errorCode: error.code || 'OUTBOX_DISPATCH_FAILED',
        errorMessage: safeErrorMessage(error)
      }, client));
      throw error;
    }
  }

  async function drain({ limit = 25 } = {}) {
    const results = [];
    for (let index = 0; index < limit; index += 1) {
      try {
        const result = await dispatchOne();
        if (!result) break;
        results.push(result);
      } catch (error) {
        results.push({ error });
      }
    }
    return results;
  }

  return { dispatchOne, drain };
}

module.exports = {
  DEFAULT_LEASE_MS,
  DEFAULT_RETRY_DELAY_MS,
  createOutboxDispatcher
};