const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  buildSignature,
  normalizeBody,
  stableStringify,
  verifyServiceRequestSignature,
  verifyServiceRequestSignatureAsync
} = require('../utils/serviceRequestAuth');
const { hashCanonicalJson } = require('../utils/canonicalJson');

const hmacKey = 'test-bot-api-hmac-secret';
const now = 1_750_000_000_000;

function makeRequest({
  method = 'GET',
  originalUrl = '/api/admin/status?scope=bot',
  body,
  rawBody,
  timestamp = now,
  signature
} = {}) {
  const normalizedBody = normalizeBody(rawBody ?? body, method);
  const headers = {
    [TIMESTAMP_HEADER]: String(timestamp),
    [SIGNATURE_HEADER]: signature || buildSignature(hmacKey, String(timestamp), method, originalUrl, normalizedBody)
  };

  return {
    method,
    originalUrl,
    body,
    rawBody,
    headers,
    get(name) {
      return this.headers[String(name).toLowerCase()] || this.headers[name];
    }
  };
}

function assertServiceAuthError(fn, code) {
  assert.throws(
    fn,
    (error) => {
      assert.equal(error.code, code);
      assert.equal(error.statusCode, 401);
      return true;
    }
  );
}

async function assertServiceAuthRejects(fn, code, statusCode = 401) {
  await assert.rejects(
    fn,
    (error) => {
      assert.equal(error.code, code);
      assert.equal(error.statusCode, statusCode);
      return true;
    }
  );
}

describe('bot-to-API service request authentication', () => {
  test('normalizes JSON bodies deterministically before signing', () => {
    assert.equal(stableStringify({ b: 2, a: 1, skip: undefined }), '{"a":1,"b":2}');
    assert.equal(normalizeBody({ b: 2, a: 1 }, 'POST'), '{"a":1,"b":2}');
    assert.equal(normalizeBody('{"b":2,"a":1}', 'POST'), '{"a":1,"b":2}');
    assert.equal(normalizeBody({ ignored: true }, 'GET'), '');
  });

  test('hashes equivalent canonical JSON identically and changed requests differently', () => {
    const first = hashCanonicalJson({
      serviceSlug: 'opay',
      input: { reference: 'ORDER-001', details: { amount: 25, currency: 'USD' } }
    });
    const reordered = hashCanonicalJson({
      input: { details: { currency: 'USD', amount: 25 }, reference: 'ORDER-001' },
      serviceSlug: 'opay'
    });
    const changed = hashCanonicalJson({
      serviceSlug: 'opay',
      input: { reference: 'ORDER-002', details: { amount: 25, currency: 'USD' } }
    });

    assert.match(first, /^[a-f0-9]{64}$/);
    assert.equal(reordered, first);
    assert.notEqual(changed, first);
  });

  test('accepts a fresh signed GET request', () => {
    const request = makeRequest();
    const result = verifyServiceRequestSignature(request, {
      secret: hmacKey,
      now,
      replayProtection: false
    });

    assert.equal(result.method, 'GET');
    assert.equal(result.path, '/api/admin/status?scope=bot');
    assert.equal(result.timestampMs, now);
  });

  test('accepts signed POST requests using raw JSON body when present', () => {
    const request = makeRequest({
      method: 'POST',
      originalUrl: '/api/admin/jobs',
      rawBody: '{"type":"sync","meta":{"b":2,"a":1}}',
      body: {
        parsed: 'body should not change the signed raw payload'
      }
    });

    const result = verifyServiceRequestSignature(request, {
      secret: hmacKey,
      now,
      replayProtection: false
    });

    assert.equal(result.method, 'POST');
  });

  test('rejects missing, stale, invalid, and replayed signatures', () => {
    const missing = makeRequest();
    delete missing.headers[SIGNATURE_HEADER];
    assertServiceAuthError(
      () => verifyServiceRequestSignature(missing, { secret: hmacKey, now }),
      'BOT_API_SIGNATURE_MISSING'
    );

    assertServiceAuthError(
      () => verifyServiceRequestSignature(makeRequest({ timestamp: now - 301_000 }), { secret: hmacKey, now }),
      'BOT_API_TIMESTAMP_EXPIRED'
    );

    assertServiceAuthError(
      () => verifyServiceRequestSignature(makeRequest({ signature: '0'.repeat(64) }), { secret: hmacKey, now }),
      'BOT_API_SIGNATURE_INVALID'
    );

    const replayed = makeRequest({ timestamp: now + 1000 });
    verifyServiceRequestSignature(replayed, { secret: hmacKey, now });
    assertServiceAuthError(
      () => verifyServiceRequestSignature(replayed, { secret: hmacKey, now }),
      'BOT_API_REPLAY_REJECTED'
    );
  });

  test('uses an async replay store when one is provided', async () => {
    const seen = new Set();
    const replayStore = {
      async checkAndStore(key, ttlMs) {
        assert.equal(ttlMs, 300000);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      }
    };
    const replayed = makeRequest({ timestamp: now + 2000 });

    const result = await verifyServiceRequestSignatureAsync(replayed, {
      secret: hmacKey,
      now,
      replayStore
    });

    assert.equal(result.replayKey, `${now + 2000}:${replayed.headers[SIGNATURE_HEADER]}`);
    await assertServiceAuthRejects(
      () => verifyServiceRequestSignatureAsync(replayed, { secret: hmacKey, now, replayStore }),
      'BOT_API_REPLAY_REJECTED'
    );
  });

  test('fails closed when async replay store is unavailable', async () => {
    const replayStore = {
      async checkAndStore() {
        throw new Error('redis offline');
      }
    };

    await assertServiceAuthRejects(
      () => verifyServiceRequestSignatureAsync(makeRequest({ timestamp: now + 3000 }), {
        secret: hmacKey,
        now,
        replayStore
      }),
      'BOT_API_REPLAY_STORE_UNAVAILABLE',
      503
    );
  });
});
