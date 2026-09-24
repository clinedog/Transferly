'use strict';

const { AppError } = require('../../utils/errors');

const RESERVATION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  CONSUMED: 'CONSUMED',
  RELEASED: 'RELEASED',
  EXPIRED: 'EXPIRED'
});

const RESERVATION_TRANSITIONS = Object.freeze({
  [RESERVATION_STATUS.ACTIVE]: [
    RESERVATION_STATUS.CONSUMED,
    RESERVATION_STATUS.RELEASED,
    RESERVATION_STATUS.EXPIRED
  ],
  [RESERVATION_STATUS.CONSUMED]: [],
  [RESERVATION_STATUS.RELEASED]: [],
  [RESERVATION_STATUS.EXPIRED]: [RESERVATION_STATUS.RELEASED]
});

function normalizeReservationInput(input = {}, { now = Date.now() } = {}) {
  const amount = Number(input.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new AppError(422, 'FINANCIAL_RESERVATION_AMOUNT_INVALID',
      'Reservation amount must be a positive safe integer.');
  }

  const reservationKey = String(input.reservationKey || '').trim();
  if (!reservationKey) {
    throw new AppError(422, 'FINANCIAL_RESERVATION_KEY_REQUIRED',
      'Reservation key is required for idempotent reservation creation.');
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now)) {
    throw new AppError(422, 'FINANCIAL_RESERVATION_EXPIRY_INVALID',
      'Reservation expiry must be a valid future timestamp.');
  }

  return Object.freeze({
    reservationKey,
    amount,
    currency: input.currency ? String(input.currency).trim().toUpperCase() : null,
    resource: String(input.resource || '').trim() || null,
    referenceType: String(input.referenceType || '').trim() || null,
    referenceId: String(input.referenceId || '').trim() || null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    metadata: Object.freeze({ ...(input.metadata || {}) })
  });
}

function assertReservationTransition(from, to) {
  const allowed = RESERVATION_TRANSITIONS[from];
  if (!allowed || !RESERVATION_TRANSITIONS[to]) {
    throw new AppError(409, 'FINANCIAL_RESERVATION_STATUS_UNKNOWN',
      `Unknown reservation status transition: ${from} to ${to}.`, { from, to });
  }
  if (!allowed.includes(to)) {
    throw new AppError(409, 'FINANCIAL_RESERVATION_TRANSITION_INVALID',
      `Cannot transition reservation from ${from} to ${to}.`, { from, to, allowed });
  }
}

function transitionReservation(reservation, nextStatus, { actorId = null, reason = null, at = new Date().toISOString() } = {}) {
  assertReservationTransition(reservation.status, nextStatus);
  return Object.freeze({
    ...reservation,
    status: nextStatus,
    actorId,
    reason,
    updatedAt: at,
    consumedAt: nextStatus === RESERVATION_STATUS.CONSUMED ? at : reservation.consumedAt || null,
    releasedAt: nextStatus === RESERVATION_STATUS.RELEASED ? at : reservation.releasedAt || null,
    expiredAt: nextStatus === RESERVATION_STATUS.EXPIRED ? at : reservation.expiredAt || null
  });
}

module.exports = {
  RESERVATION_STATUS,
  RESERVATION_TRANSITIONS,
  normalizeReservationInput,
  assertReservationTransition,
  transitionReservation
};
