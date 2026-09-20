'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { releaseInvoiceFundsSchema } = require('../schemas/adminSchemas');

test('invoice fund release requires a non-empty reason', () => {
  assert.throws(
    () => releaseInvoiceFundsSchema.parse({ amount: 10 }),
    (error) => error.issues?.some((issue) => issue.path[0] === 'reason' && issue.code === 'invalid_type')
  );
  assert.throws(
    () => releaseInvoiceFundsSchema.parse({ amount: 10, reason: '  ' }),
    (error) => error.issues?.some((issue) => issue.path[0] === 'reason' && issue.code === 'too_small')
  );
  assert.deepEqual(
    releaseInvoiceFundsSchema.parse({ amount: 10, reason: '  Settlement completed  ' }),
    { amount: 10, reason: 'Settlement completed' }
  );
});
