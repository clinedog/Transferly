const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { buildQueueJobId } = require('../utils/queueJobId');

describe('queue job IDs', () => {
  test('builds deterministic BullMQ-safe IDs from arbitrary provider identifiers', () => {
    const first = buildQueueJobId('webhook', 'WH:event/123');
    const second = buildQueueJobId('webhook', 'WH:event/123');

    assert.equal(first, second);
    assert.equal(first, 'q-7-webhook-16-WH%3Aevent%2F123');
    assert.equal(first.includes(':'), false);
    assert.notEqual(`${parseInt(first, 10)}`, first);
  });

  test('length-prefixes parts so distinct logical identities cannot collapse', () => {
    assert.notEqual(
      buildQueueJobId('payout', 'a-b', 'c'),
      buildQueueJobId('payout', 'a', 'b-c')
    );
  });

  test('rejects missing and empty identity parts', () => {
    assert.throws(() => buildQueueJobId(), /At least one/);
    assert.throws(() => buildQueueJobId('webhook', ''), /must not be empty/);
    assert.throws(() => buildQueueJobId('webhook', null), /must be defined/);
  });
});
