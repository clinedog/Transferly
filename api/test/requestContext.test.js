const assert = require('node:assert/strict');
const { test } = require('node:test');

const { assignRequestId, normalizeRequestId } = require('../middleware/requestContext');

test('normalizeRequestId accepts safe correlation IDs', () => {
  assert.equal(normalizeRequestId(' req_123-abc.DEF:456 '), 'req_123-abc.DEF:456');
});

test('normalizeRequestId rejects unsafe or oversized correlation IDs', () => {
  assert.equal(normalizeRequestId(''), null);
  assert.equal(normalizeRequestId('request\nforged-header: true'), null);
  assert.equal(normalizeRequestId('request id with spaces'), null);
  assert.equal(normalizeRequestId('a'.repeat(129)), null);
  assert.equal(normalizeRequestId(['not-a-string']), null);
});

test('assignRequestId preserves safe client IDs and emits the response header', () => {
  const headers = {};
  const request = { headers: { 'x-request-id': 'client-request-123' } };
  const response = {
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    }
  };
  let nextCalled = false;

  assignRequestId(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(request.id, 'client-request-123');
  assert.equal(request.correlationId, 'client-request-123');
  assert.equal(headers['x-request-id'], 'client-request-123');
  assert.equal(headers['x-correlation-id'], 'client-request-123');
});

test('assignRequestId preserves a separate safe correlation ID', () => {
  const headers = {};
  const request = {
    headers: {
      'x-request-id': 'client-request-123',
      'x-correlation-id': 'flow-456'
    }
  };
  const response = {
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    }
  };

  assignRequestId(request, response, () => {});

  assert.equal(request.id, 'client-request-123');
  assert.equal(request.correlationId, 'flow-456');
  assert.equal(headers['x-request-id'], 'client-request-123');
  assert.equal(headers['x-correlation-id'], 'flow-456');
});

test('assignRequestId replaces unsafe client IDs with generated UUIDs', () => {
  const headers = {};
  const request = { headers: { 'x-request-id': 'bad\nheader' } };
  const response = {
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    }
  };

  assignRequestId(request, response, () => {});

  assert.match(request.id, /^[0-9a-f-]{36}$/i);
  assert.equal(request.correlationId, request.id);
  assert.equal(headers['x-request-id'], request.id);
  assert.equal(headers['x-correlation-id'], request.id);
});