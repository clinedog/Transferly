'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEventEnvelope } = require('../core/financial/eventEnvelope');

test('builds a canonical event envelope with stable identifiers', () => {
  const envelope = buildEventEnvelope({
    eventId: 'event-1',
    eventType: 'payout.processing',
    version: 2,
    occurredAt: '2026-01-01T00:00:00.000Z',
    correlationId: 'correlation-1',
    causationId: 'event-0',
    resourceId: 'payout-1',
    payload: { payoutId: 'payout-1' }
  });

  assert.deepEqual(envelope, {
    eventId: 'event-1',
    eventType: 'payout.processing',
    version: 2,
    occurredAt: '2026-01-01T00:00:00.000Z',
    tenantId: null,
    actorId: null,
    resourceId: 'payout-1',
    correlationId: 'correlation-1',
    causationId: 'event-0',
    payload: { payoutId: 'payout-1' }
  });
});

test('rejects invalid event identity and timestamps', () => {
  assert.throws(
    () => buildEventEnvelope({ eventType: 'payout', correlationId: 'c1' }),
    (error) => error.code === 'FINANCIAL_EVENT_TYPE_INVALID'
  );
  assert.throws(
    () => buildEventEnvelope({ eventType: 'payout.processing', correlationId: 'c1', occurredAt: 'invalid' }),
    (error) => error.code === 'FINANCIAL_EVENT_TIMESTAMP_INVALID'
  );
});
