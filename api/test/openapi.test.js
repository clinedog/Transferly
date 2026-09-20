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
  assert.equal(document.paths['/api/v1/payouts'].post.parameters[0].$ref, '#/components/parameters/IdempotencyKey');
  assert.ok(document.paths['/api/v1/webhooks'].post);
  assert.ok(document.paths['/api/v1/invoices/payment-links'].get);
  assert.ok(document.paths['/api/v1/admin/finance/analytics.csv'].get);
  assert.ok(document.paths['/api/v1/admin/finance/analytics.pdf'].get);
  assert.ok(document.components.schemas.Collection);
  assert.ok(document.components.responses.Conflict);
  assert.equal(document['x-transferly-api-versioning'].current, '/api/v1');
  assert.match(document['x-transferly-financial-safety'].idempotency, /Idempotency-Key/);
});
