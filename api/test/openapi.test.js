'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildOpenApiDocument } = require('../openapi');

test('OpenAPI document mirrors the versioned route groups and financial safety contract', () => {
  const document = buildOpenApiDocument({ baseUrl: 'https://api.example.test' });
  assert.equal(document.openapi, '3.0.3');
  assert.equal(document.servers[0].url, 'https://api.example.test');
  assert.ok(document.paths['/api/v1/invoices']);
  assert.ok(document.paths['/api/payouts']);
  assert.equal(document['x-transferly-api-versioning'].current, '/api/v1');
  assert.match(document['x-transferly-financial-safety'].idempotency, /Idempotency-Key/);
});
