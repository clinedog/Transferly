'use strict';

const crypto = require('node:crypto');
const { AppError } = require('../../utils/errors');
const {
  RESERVATION_STATUS,
  normalizeReservationInput,
  transitionReservation
} = require('./reservationContract');

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requestHash(input) {
  return crypto.createHash('sha256').update(stableSerialize(input)).digest('hex');
}

function createReservationService({ repository, clock = () => new Date() } = {}) {
  if (!repository || typeof repository.findByKey !== 'function' ||
      typeof repository.create !== 'function' || typeof repository.update !== 'function') {
    throw new TypeError('A reservation repository with findByKey, create, and update methods is required.');
  }

  async function create(input = {}) {
    const normalized = normalizeReservationInput(input, { now: clock().getTime() });
    const actorId = String(input.actorId || '').trim() || null;
    const hash = requestHash({ ...normalized, actorId });
    const existing = await repository.findByKey(normalized.reservationKey);
    if (existing) {
      if (existing.requestHash !== hash) {
        throw new AppError(409, 'FINANCIAL_RESERVATION_KEY_CONFLICT',
          'Reservation key was already used with different request data.', {
            reservationKey: normalized.reservationKey
          });
      }
      return existing;
    }

    const now = clock().toISOString();
    const reservation = {
      ...normalized,
      id: input.id || `reservation:${normalized.reservationKey}`,
      actorId,
      requestHash: hash,
      status: RESERVATION_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
      consumedAt: null,
      releasedAt: null,
      expiredAt: null
    };

    try {
      return await repository.create(reservation);
    } catch (error) {
      const winner = await repository.findByKey(normalized.reservationKey);
      if (winner) {
        if (winner.requestHash !== hash) {
          throw new AppError(409, 'FINANCIAL_RESERVATION_KEY_CONFLICT',
            'Reservation key was already used with different request data.', {
              reservationKey: normalized.reservationKey
            });
        }
        return winner;
      }
      throw error;
    }
  }

  async function transition(id, nextStatus, options = {}) {
    const reservation = await repository.findById(id);
    if (!reservation) {
      throw new AppError(404, 'FINANCIAL_RESERVATION_NOT_FOUND', 'Reservation was not found.', { id });
    }
    if (reservation.status === nextStatus) return reservation;
    const updated = transitionReservation(reservation, nextStatus, {
      actorId: options.actorId || null,
      reason: options.reason || null,
      at: clock().toISOString()
    });
    await repository.update(id, updated, reservation.status);
    return updated;
  }

  async function commit(id, options) {
    return transition(id, RESERVATION_STATUS.CONSUMED, options);
  }

  async function release(id, options) {
    return transition(id, RESERVATION_STATUS.RELEASED, options);
  }

  async function expire(id, options = {}) {
    const reservation = await repository.findById(id);
    if (!reservation) {
      throw new AppError(404, 'FINANCIAL_RESERVATION_NOT_FOUND', 'Reservation was not found.', { id });
    }
    if (reservation.status !== RESERVATION_STATUS.ACTIVE) return reservation;
    if (reservation.expiresAt && new Date(reservation.expiresAt).getTime() > clock().getTime()) {
      throw new AppError(409, 'FINANCIAL_RESERVATION_NOT_EXPIRED', 'Reservation has not reached its expiry time.', { id });
    }
    return transition(id, RESERVATION_STATUS.EXPIRED, {
      ...options,
      reason: options.reason || 'reservation_expired'
    });
  }

  return Object.freeze({ create, commit, release, expire, transition });
}

module.exports = {
  createReservationService,
  requestHash
};
