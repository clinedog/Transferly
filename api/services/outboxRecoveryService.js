const { transaction } = require('../db');
const {
  OUTBOX_STATUS,
  outboxEventRepository
} = require('../repositories/outboxEventRepository');
const { auditLogService } = require('./auditLogService');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { AppError } = require('../utils/errors');

function createOutboxRecoveryService({
  repository = outboxEventRepository,
  auditService = auditLogService,
  transact = transaction,
  dispatchEvent = async () => null,
  now = () => new Date().toISOString()
} = {}) {
  async function listEvents(options = {}) {
    return repository.findMany(options);
  }

  async function replayFailedEvent({ eventId, adminActorId, reason }) {
    const replayedAt = now();
    const event = await transact(async (client) => {
      const existing = await repository.findById(eventId, client);
      if (!existing) {
        throw new AppError(404, 'OUTBOX_EVENT_NOT_FOUND', 'Outbox event not found.');
      }
      if (existing.status !== OUTBOX_STATUS.FAILED) {
        throw new AppError(
          409,
          'OUTBOX_EVENT_NOT_REPLAYABLE',
          'Only terminally failed outbox events can be replayed.'
        );
      }

      const replayed = await repository.resetFailedForReplay({ id: existing.id, replayedAt }, client);
      if (!replayed) {
        throw new AppError(409, 'OUTBOX_EVENT_REPLAY_CONFLICT', 'The outbox event changed before replay.');
      }
      await auditService.log({
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'outbox.replay_requested',
        entityType: 'outbox_event',
        entityId: existing.id,
        metadata: {
          reason,
          previousAttemptCount: existing.attemptCount,
          previousErrorCode: existing.lastErrorCode,
          aggregateType: existing.aggregateType,
          aggregateId: existing.aggregateId,
          correlationId: existing.correlationId
        }
      }, client);
      return replayed;
    });

    try {
      const dispatched = await dispatchEvent(event.id);
      return { event: dispatched?.event || event, dispatchPending: !dispatched };
    } catch (_error) {
      return {
        event: await repository.findById(event.id),
        dispatchPending: true
      };
    }
  }

  return { listEvents, replayFailedEvent };
}

module.exports = {
  createOutboxRecoveryService
};