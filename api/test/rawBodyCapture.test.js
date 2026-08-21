const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  JSON_BODY_LIMIT,
  buildJsonBodyParserOptions,
  captureRawBody
} = require('../core/webhooks/rawBodyCapture');

test('captureRawBody stores the exact UTF-8 request payload for webhook signatures', () => {
  const request = {};
  const payload = '{"event":"payment.succeeded","nested":{"amount":1250}}';

  captureRawBody(request, {}, Buffer.from(payload, 'utf8'));

  assert.equal(request.rawBody, payload);
});

test('captureRawBody preserves provider payload whitespace and key order', () => {
  const request = {};
  const payload = '{\n  "b": 2,\n  "a": 1\n}';

  captureRawBody(request, {}, Buffer.from(payload, 'utf8'));

  assert.equal(request.rawBody, payload);
  assert.notEqual(request.rawBody, JSON.stringify(JSON.parse(payload)));
});

test('buildJsonBodyParserOptions keeps raw body capture and parser limit centralized', () => {
  const options = buildJsonBodyParserOptions();
  const request = {};

  assert.equal(JSON_BODY_LIMIT, '1mb');
  assert.equal(options.limit, '1mb');
  assert.equal(options.verify, captureRawBody);

  options.verify(request, {}, Buffer.from('{"ok":true}', 'utf8'));
  assert.equal(request.rawBody, '{"ok":true}');
});