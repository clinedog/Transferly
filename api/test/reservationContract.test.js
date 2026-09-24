'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESERVATION_STATUS,
  assertReservationTransition,
  normalizeReservationInput,
  transitionReservation
} = require('../core/financial/reservationContract');

test('normalizes an idempotent reservation request', () => {
  const reservation = normalizeReservationInput({
    reservationKey: ' payout:1 ',
    amount: 100,
    currency: 'usd',
    resource: 'payout',
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });

  assert.equal(reservation.reservationKey, 'payout:1');
  assert.equal(reservation.currency, 'USD');
  assert.equal(reservation.amount, 100);
});

test('supports active, consumed, released, and expiry lifecycle transitions', () => {
  const active = {
    reservationKey: 'points:1',
    amount: 10,
    status: RESERVATION_STATUS.ACTIVE
  };
  const expired = transitionReservation(active, RESERVATION_STATUS.EXPIRED, { actorId: 'expiry-worker' });
  const released = transitionReservation(expired, RESERVATION_STATUS.RELEASED, { reason: 'funds returned' });

  assert.equal(expired.expiredAt !== null, true);
  assert.equal(released.status, RESERVATION_STATUS.RELEASED);
  assert.equal(released.reason, 'funds returned');
});

test('rejects release after consumption and invalid amounts', () => {
  assert.throws(
    () => normalizeReservationInput({ reservationKey: 'bad', amount: 0 }),
    (error) => error.code === 'FINANCIAL_RESERVATION_AMOUNT_INVALID'
  );
  assert.throws(
    () => assertReservationTransition(RESERVATION_STATUS.CONSUMED, RESERVATION_STATUS.RELEASED),
    (error) => error.code === 'FINANCIAL_RESERVATION_TRANSITION_INVALID'
  );
});
