const config = require('../config');
const { pointReservationRepository } = require('../repositories/pointReservationRepository');
const {
  AUDIT_ACTOR_TYPE,
  POINT_RESERVATION_STATUS,
  POINT_TRANSACTION_TYPE
} = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { auditLogService } = require('./auditLogService');
const { pointLedgerService } = require('./pointLedgerService');

function ensurePositivePointAmount(amount) {
  const normalizedAmount = Number(amount);
  if (!Number.isSafeInteger(normalizedAmount) || normalizedAmount <= 0) {
    throw new AppError(400, 'INVALID_POINT_AMOUNT', 'Point amount must be a positive integer.');
  }

  return normalizedAmount;
}

function normalizeExpiration(value, now = new Date()) {
  const expiration = value === undefined || value === null
    ? new Date(now.getTime() + config.POINT_RESERVATION_TTL_MS)
    : new Date(value);

  if (!Number.isFinite(expiration.getTime()) || expiration.getTime() <= now.getTime()) {
    throw new AppError(
      400,
      'POINT_RESERVATION_EXPIRY_INVALID',
      'Point reservation expiry must be a valid future timestamp.'
    );
  }

  return expiration.toISOString();
}

async function recordReservationEntry(input, client) {
  const entry = {
    entryKey: `point-reservation:${input.reservation.id}:${input.event}`,
    userId: input.reservation.userId,
    type: input.type,
    amount: input.amount,
    description: input.description,
    referenceType: input.reservation.referenceType,
    referenceId: input.reservation.referenceId,
    metadata: {
      ...input.reservation.metadata,
      pointReservationId: input.reservation.id,
      pointReservationKey: input.reservation.reservationKey,
      reservationEvent: input.event,
      ...(input.metadata || {})
    }
  };

  return input.amount === 0
    ? pointLedgerService.recordEvent(entry, client)
    : pointLedgerService.applyEntry(entry, client);
}

function assertExistingReservationMatches(existing, input, amount) {
  const matches =
    existing.userId === input.userId &&
    Number(existing.amount) === amount &&
    existing.referenceType === input.referenceType &&
    existing.referenceId === (input.referenceId || null);

  if (!matches) {
    throw new AppError(
      409,
      'POINT_RESERVATION_KEY_CONFLICT',
      'Point reservation key already exists with different reservation details.'
    );
  }
}

async function reservePoints(input, client) {
  const amount = ensurePositivePointAmount(input.amount);
  const existingReservation = await pointReservationRepository.findByReservationKey(input.reservationKey, client);
  if (existingReservation) {
    assertExistingReservationMatches(existingReservation, input, amount);
    return existingReservation;
  }

  const now = new Date();
  const expiresAt = normalizeExpiration(input.expiresAt, now);
  const availablePointsBefore = await pointLedgerService.getBalance(input.userId, client);
  const availablePointsAfter = availablePointsBefore - amount;
  if (availablePointsAfter < 0) {
    throw new AppError(400, 'INSUFFICIENT_POINTS', 'Not enough points to reserve for this action.', {
      requiredPoints: amount,
      availablePoints: availablePointsBefore,
      shortfallPoints: amount - availablePointsBefore
    });
  }

  const reservation = await pointReservationRepository.create(
    {
      reservationKey: input.reservationKey,
      userId: input.userId,
      status: POINT_RESERVATION_STATUS.RESERVED,
      amount,
      availablePointsBefore,
      availablePointsAfter,
      referenceType: input.referenceType,
      referenceId: input.referenceId || null,
      metadata: input.metadata || {},
      reservedAt: now.toISOString(),
      expiresAt
    },
    client
  );

  await recordReservationEntry(
    {
      reservation,
      event: 'hold',
      type: input.transactionType || POINT_TRANSACTION_TYPE.POINT_RESERVATION_HOLD,
      amount: -amount,
      description: input.transactionDescription || 'Points reserved for a pending action.'
    },
    client
  );

  await auditLogService.log(
    {
      actorType: AUDIT_ACTOR_TYPE.USER,
      actorId: input.userId,
      action: 'points.reserve',
      entityType: 'point_reservation',
      entityId: reservation.id,
      metadata: {
        amount,
        referenceType: input.referenceType,
        referenceId: input.referenceId || null,
        expiresAt
      }
    },
    client
  );

  return reservation;
}

async function commitReservation(input, client) {
  const reservation = await pointReservationRepository.findById(input.reservationId, client);
  if (!reservation) {
    throw new AppError(404, 'POINT_RESERVATION_NOT_FOUND', 'Point reservation not found.');
  }

  if (reservation.status === POINT_RESERVATION_STATUS.COMMITTED) {
    return reservation;
  }

  if (reservation.status !== POINT_RESERVATION_STATUS.RESERVED) {
    throw new AppError(409, 'POINT_RESERVATION_NOT_COMMITTABLE', 'Point reservation cannot be committed.');
  }

  const nextReservation = await pointReservationRepository.update(
    reservation.id,
    {
      status: POINT_RESERVATION_STATUS.COMMITTED,
      referenceId: input.referenceId ?? reservation.referenceId,
      metadata: {
        ...reservation.metadata,
        ...(input.metadata || {})
      },
      committedAt: new Date().toISOString()
    },
    client
  );

  await recordReservationEntry(
    {
      reservation: nextReservation,
      event: 'commit',
      type: POINT_TRANSACTION_TYPE.POINT_RESERVATION_COMMIT,
      amount: 0,
      description: 'Point reservation committed.'
    },
    client
  );

  await auditLogService.log(
    {
      actorType: AUDIT_ACTOR_TYPE.SYSTEM,
      actorId: 'point-reservation-service',
      action: 'points.commit',
      entityType: 'point_reservation',
      entityId: reservation.id,
      metadata: {
        amount: reservation.amount,
        referenceType: reservation.referenceType,
        referenceId: nextReservation.referenceId
      }
    },
    client
  );

  return nextReservation;
}

async function releaseReservation(input, client) {
  const reservation = await pointReservationRepository.findById(input.reservationId, client);
  if (!reservation) {
    throw new AppError(404, 'POINT_RESERVATION_NOT_FOUND', 'Point reservation not found.');
  }

  if (reservation.status === POINT_RESERVATION_STATUS.RELEASED) {
    return reservation;
  }

  if (reservation.status !== POINT_RESERVATION_STATUS.RESERVED) {
    throw new AppError(409, 'POINT_RESERVATION_NOT_RELEASABLE', 'Point reservation cannot be released.');
  }

  const nextReservation = await pointReservationRepository.update(
    reservation.id,
    {
      status: POINT_RESERVATION_STATUS.RELEASED,
      metadata: {
        ...reservation.metadata,
        releaseReason: input.reason || null
      },
      releasedAt: new Date().toISOString()
    },
    client
  );

  await recordReservationEntry(
    {
      reservation: nextReservation,
      event: 'release',
      type: POINT_TRANSACTION_TYPE.POINT_RESERVATION_RELEASE,
      amount: reservation.amount,
      description: 'Point reservation released.',
      metadata: {
        releaseReason: input.reason || null
      }
    },
    client
  );

  await auditLogService.log(
    {
      actorType: AUDIT_ACTOR_TYPE.SYSTEM,
      actorId: 'point-reservation-service',
      action: 'points.release',
      entityType: 'point_reservation',
      entityId: reservation.id,
      metadata: {
        amount: reservation.amount,
        reason: input.reason || null
      }
    },
    client
  );

  return nextReservation;
}

async function expireReservation(input, client) {
  const reservation = await pointReservationRepository.findById(input.reservationId, client);
  if (!reservation) {
    throw new AppError(404, 'POINT_RESERVATION_NOT_FOUND', 'Point reservation not found.');
  }

  if (reservation.status === POINT_RESERVATION_STATUS.EXPIRED) {
    return reservation;
  }

  if (reservation.status !== POINT_RESERVATION_STATUS.RESERVED) {
    throw new AppError(409, 'POINT_RESERVATION_NOT_EXPIRABLE', 'Point reservation cannot be expired.');
  }

  const cutoff = new Date(input.before || new Date());
  const expiresAt = Date.parse(reservation.expiresAt);
  if (!Number.isFinite(cutoff.getTime()) || !Number.isFinite(expiresAt) || expiresAt > cutoff.getTime()) {
    throw new AppError(409, 'POINT_RESERVATION_NOT_DUE', 'Point reservation is not due to expire.');
  }

  const expiredAt = cutoff.toISOString();
  const nextReservation = await pointReservationRepository.update(
    reservation.id,
    {
      status: POINT_RESERVATION_STATUS.EXPIRED,
      metadata: {
        ...reservation.metadata,
        expirationReason: input.reason || 'reservation_ttl_elapsed'
      },
      releasedAt: expiredAt,
      expiredAt
    },
    client
  );

  await recordReservationEntry(
    {
      reservation: nextReservation,
      event: 'expire',
      type: POINT_TRANSACTION_TYPE.POINT_RESERVATION_RELEASE,
      amount: reservation.amount,
      description: 'Point reservation expired and was released.',
      metadata: {
        expirationReason: input.reason || 'reservation_ttl_elapsed'
      }
    },
    client
  );

  await auditLogService.log(
    {
      actorType: AUDIT_ACTOR_TYPE.SYSTEM,
      actorId: input.actorId || 'point-reservation-service',
      action: 'points.expire',
      entityType: 'point_reservation',
      entityId: reservation.id,
      metadata: {
        amount: reservation.amount,
        expiresAt: reservation.expiresAt,
        expiredAt,
        reason: input.reason || 'reservation_ttl_elapsed'
      }
    },
    client
  );

  return nextReservation;
}

module.exports = {
  pointReservationService: {
    commitReservation,
    expireReservation,
    releaseReservation,
    reservePoints
  }
};
