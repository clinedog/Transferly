'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createReservationService } = require('../core/financial/reservationService');

function createRepository() {
  const records = new Map();
  return {
    records,
    async findByKey(key) {
      return [...records.values()].find((record) => record.reservationKey === key) || null;
    },
    async findById(id) {
      return records.get(id) || null;
    },
    async create(record) {
      if ([...records.values()].some((item) => item.reservationKey === record.reservationKey)) {
        throw new Error('unique reservation key');
      }
      records.set(record.id, record);
      return record;
    },
    async update(id, record, expectedStatus) {
      const current = records.get(id);
      assert.equal(current.status, expectedStatus);
      records.set(id, record);
    }
  };
}

test('replays the same reservation key and rejects a conflicting request', async () => {
  const repository = createRepository();
  const service = createReservationService({
    repository,
    clock: () => new Date('2026-01-01T00:00:00.000Z')
  });
  const input = { reservationKey: 'wallet:1', amount: 100, actorId: 'user-1' };
  const first = await service.create(input);
  const replay = await service.create(input);

  assert.equal(replay.id, first.id);
  await assert.rejects(
    service.create({ ...input, amount: 101 }),
    (error) => error.code === 'FINANCIAL_RESERVATION_KEY_CONFLICT'
  );
});

test('commit and release are idempotent while illegal transitions remain rejected', async () => {
  const repository = createRepository();
  const service = createReservationService({ repository });
  const reservation = await service.create({ reservationKey: 'points:1', amount: 10 });
  const committed = await service.commit(reservation.id);
  assert.equal((await service.commit(reservation.id)).status, 'CONSUMED');
  assert.equal(committed.status, 'CONSUMED');
  await assert.rejects(service.release(reservation.id), (error) =>
    error.code === 'FINANCIAL_RESERVATION_TRANSITION_INVALID'
  );
});

test('expires only after the expiry timestamp and remains replay-safe', async () => {
  const repository = createRepository();
  let now = new Date('2026-01-01T00:00:00.000Z');
  const service = createReservationService({
    repository,
    clock: () => now
  });
  const reservation = await service.create({
    reservationKey: 'payout:1',
    amount: 25,
    expiresAt: '2026-01-01T00:01:00.000Z'
  });
  now = new Date('2026-01-01T00:02:00.000Z');
  const expired = await service.expire(reservation.id);
  assert.equal(expired.status, 'EXPIRED');
  assert.equal((await service.expire(reservation.id)).status, 'EXPIRED');
});
