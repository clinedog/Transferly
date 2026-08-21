const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { sanitizeRequestUrl } = require('../utils/sanitizeRequestUrl');

describe('sanitizeRequestUrl', () => {
  test('redacts security-sensitive query values while retaining useful request context', () => {
    const result = sanitizeRequestUrl(
      '/api/assets/asset-1/download?token=signed-secret&scope=download&API_KEY=provider-secret'
    );

    assert.equal(
      result,
      '/api/assets/asset-1/download?token=%5BREDACTED%5D&scope=download&API_KEY=%5BREDACTED%5D'
    );
    assert.equal(result.includes('signed-secret'), false);
    assert.equal(result.includes('provider-secret'), false);
  });

  test('drops the query string when an invalid request target cannot be parsed', () => {
    assert.equal(sanitizeRequestUrl('http://[invalid]?token=secret'), 'http://[invalid]');
  });
});
