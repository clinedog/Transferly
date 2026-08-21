const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { describe, test } = require('node:test');

const { encodeBase64Url } = require('../utils/base64url');
const { signJwt, verifyJwt } = require('../utils/jwt');

const signingKey = 'test-jwt-secret-long-enough';

function signRaw(header, payload, secret = signingKey) {
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function assertJwtError(fn, code) {
  assert.throws(
    fn,
    (error) => {
      assert.equal(error.code, code);
      assert.equal(error.statusCode, 401);
      return true;
    }
  );
}

describe('JWT session tokens', () => {
  test('signs and verifies finite HS256 sessions', () => {
    const token = signJwt({ sub: 'user-1', role: 'admin' }, signingKey, 300);
    const payload = verifyJwt(token, signingKey);

    assert.equal(payload.sub, 'user-1');
    assert.equal(payload.role, 'admin');
    assert.equal(Number.isFinite(payload.iat), true);
    assert.equal(Number.isFinite(payload.exp), true);
  });

  test('rejects tampered signatures with timing-safe comparison', () => {
    const token = signJwt({ sub: 'user-1' }, signingKey, 300);
    const parts = token.split('.');
    const signature = parts[2];
    const tamperedSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    const tampered = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

    assertJwtError(() => verifyJwt(tampered, signingKey), 'INVALID_TOKEN');
  });

  test('rejects unsupported algorithms and malformed JSON parts', () => {
    const now = Math.floor(Date.now() / 1000);
    const algNoneToken = signRaw({ alg: 'none', typ: 'JWT' }, { sub: 'user-1', iat: now, exp: now + 300 });
    assertJwtError(() => verifyJwt(algNoneToken, signingKey), 'INVALID_TOKEN');

    const malformedToken = `${encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.not-json.signature`;
    assertJwtError(() => verifyJwt(malformedToken, signingKey), 'INVALID_TOKEN');
  });

  test('rejects sessions without required issued-at or expiration timestamps', () => {
    const now = Math.floor(Date.now() / 1000);
    assertJwtError(
      () => verifyJwt(signRaw({ alg: 'HS256', typ: 'JWT' }, { sub: 'user-1', exp: now + 300 }), signingKey),
      'INVALID_TOKEN'
    );
    assertJwtError(
      () => verifyJwt(signRaw({ alg: 'HS256', typ: 'JWT' }, { sub: 'user-1', iat: now }), signingKey),
      'INVALID_TOKEN'
    );
  });

  test('rejects not-before and expired sessions outside clock skew', () => {
    const futureToken = signJwt({ sub: 'user-1' }, signingKey, 300, { notBeforeSeconds: 60 });
    assertJwtError(() => verifyJwt(futureToken, signingKey, { clockSkewSeconds: 10 }), 'TOKEN_NOT_ACTIVE');

    const now = Math.floor(Date.now() / 1000);
    const expiredToken = signRaw({ alg: 'HS256', typ: 'JWT' }, { sub: 'user-1', iat: now - 600, exp: now - 120 });
    assertJwtError(() => verifyJwt(expiredToken, signingKey, { clockSkewSeconds: 30 }), 'TOKEN_EXPIRED');
  });
});
