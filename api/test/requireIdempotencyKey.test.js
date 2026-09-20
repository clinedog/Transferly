'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { requireIdempotencyKey } = require('../middleware/requireIdempotencyKey');

function run(request) {
  let nextError = null;
  let nextCalled = false;
  requireIdempotencyKey(request, {}, (error) => {
    nextError = error || null;
    nextCalled = true;
  });
  return { nextCalled, nextError, request };
}

test('requires and normalizes idempotency keys for financial requests', () => {
  const missing = run({ headers: {}, body: {} });
  assert.equal(missing.nextCalled, true);
  assert.equal(missing.nextError.code, 'IDEMPOTENCY_KEY_REQUIRED');

  const valid = run({
    headers: { 'idempotency-key': '  payout-123  ' },
    body: {}
  });
  assert.equal(valid.nextError, null);
  assert.equal(valid.request.idempotencyKey, 'payout-123');
});

test('rejects blank and oversized idempotency keys', () => {
  assert.equal(
    run({ headers: { 'idempotency-key': '   ' }, body: {} }).nextError.code,
    'IDEMPOTENCY_KEY_INVALID'
  );
  assert.equal(
    run({ headers: { 'idempotency-key': 'x'.repeat(201) }, body: {} }).nextError.code,
    'IDEMPOTENCY_KEY_INVALID'
  );
});

test('does not weaken the guard for non-PayPal providers when MVP mode is enabled', () => {
  const result = run({
    headers: {},
    body: { provider: 'stripe' }
  });

  assert.equal(result.nextError.code, 'IDEMPOTENCY_KEY_REQUIRED');
});
