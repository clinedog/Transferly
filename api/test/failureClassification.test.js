const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  FAILURE_CLASSES,
  buildRecoveryHint,
  classifyFailure
} = require('../core/reliability/failureClassification');

test('classifyFailure separates transient dependency failures from permanent client failures', () => {
  assert.deepEqual(classifyFailure({ statusCode: 422, code: 'INVALID_INPUT' }), {
    class: FAILURE_CLASSES.INVALID_INPUT,
    retryable: false,
    recoverable: false,
    status: 422,
    code: 'INVALID_INPUT'
  });

  assert.deepEqual(classifyFailure({ statusCode: 503, code: 'PROVIDER_UNAVAILABLE' }), {
    class: FAILURE_CLASSES.PROVIDER,
    retryable: true,
    recoverable: true,
    status: 503,
    code: 'PROVIDER_UNAVAILABLE'
  });

  assert.equal(classifyFailure({ code: 'SQLITE_BUSY' }).class, FAILURE_CLASSES.DATABASE);
  assert.equal(classifyFailure({ code: 'SQLITE_BUSY' }).retryable, true);
  assert.equal(classifyFailure({ code: 'ECONNRESET' }).class, FAILURE_CLASSES.NETWORK);
  assert.equal(classifyFailure({ code: 'ECONNRESET' }).retryable, true);
});

test('buildRecoveryHint gives bounded client recovery instructions', () => {
  assert.deepEqual(buildRecoveryHint(classifyFailure({ statusCode: 429 })), {
    retryable: true,
    retryAfter: 60,
    action: 'wait_then_retry'
  });

  assert.deepEqual(buildRecoveryHint(classifyFailure({ statusCode: 400 })), {
    retryable: false,
    retryAfter: null,
    action: 'contact_support_if_unexpected'
  });
});