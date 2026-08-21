const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'auth-authorization-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'auth-authorization-webhook';
process.env.TRANSFERLY_OWNER_TELEGRAM_USER_IDS = '9001003';
process.env.TRANSFERLY_ADMIN_TELEGRAM_USER_IDS = '9001004';

const config = require('../config');
const { authSessionRepository } = require('../repositories/authSessionRepository');
const {
  buildRoleClaims,
  reconcileTelegramRole,
  roleFromTelegramUserId
} = require('../core/auth/telegramAuthorization');
const {
  authenticateRequest,
  assertCanAccessUserResource,
  resolveUserIdForRequest
} = require('../middleware/authenticateRequest');
const { requireAdminActor } = require('../middleware/requireAdminActor');
const { signJwt } = require('../utils/jwt');

function invokeMiddleware(middleware, request) {
  let nextError;
  middleware(request, {}, (error) => {
    nextError = error || null;
  });
  return nextError;
}

describe('authorization middleware', () => {
  test('JWT session auth rejects revoked and expired server-side sessions', async () => {
    const originalFindSession = authSessionRepository.findById;
    const token = signJwt(
      {
        sub: 'jwt-user-1',
        sid: 'jwt-session-1',
        jti: 'jwt-token-1'
      },
      config.JWT_SECRET,
      300
    );

    async function authenticateWithSession(session) {
      authSessionRepository.findById = async () => session;
      const request = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      return new Promise((resolve) => {
        authenticateRequest(request, {}, (error) => resolve(error || null));
      });
    }

    try {
      let error = await authenticateWithSession({
        id: 'jwt-session-1',
        userId: 'jwt-user-1',
        currentTokenId: 'jwt-token-1',
        status: 'revoked',
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      });
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, 'SESSION_INVALID');

      error = await authenticateWithSession({
        id: 'jwt-session-1',
        userId: 'jwt-user-1',
        currentTokenId: 'jwt-token-1',
        status: 'active',
        expiresAt: new Date(Date.now() - 60_000).toISOString()
      });
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, 'SESSION_EXPIRED');
    } finally {
      authSessionRepository.findById = originalFindSession;
    }
  });

  test('static admin API tokens are not accepted as user-scope identities even if mis-listed', async () => {
    const originalAdminToken = config.ADMIN_API_TOKEN;
    const originalAdminEnabled = config.ADMIN_AUTH_ENABLED;
    const originalTokenMap = config.USER_API_TOKEN_MAP;
    config.ADMIN_API_TOKEN = 'overlap-admin-token';
    config.ADMIN_AUTH_ENABLED = true;
    config.USER_API_TOKEN_MAP = {
      'overlap-admin-token': 'demo-user'
    };

    const request = {
      headers: {
        authorization: 'Bearer overlap-admin-token'
      }
    };

    try {
      await new Promise((resolve, reject) => {
        authenticateRequest(request, {}, (error) => (error ? reject(error) : resolve()));
      });

      assert.equal(request.auth.role, 'ADMIN');
      assert.equal(request.auth.userId, null);
      assert.throws(
        () => resolveUserIdForRequest(request, 'demo-user'),
        (error) => error.statusCode === 401 && error.code === 'USER_AUTH_REQUIRED'
      );
    } finally {
      config.ADMIN_API_TOKEN = originalAdminToken;
      config.ADMIN_AUTH_ENABLED = originalAdminEnabled;
      config.USER_API_TOKEN_MAP = originalTokenMap;
    }
  });

  test('admin routes fail closed even when the legacy admin-token flag is disabled', () => {
    const originalAdminAuthEnabled = config.ADMIN_AUTH_ENABLED;
    config.ADMIN_AUTH_ENABLED = false;

    try {
      const error = invokeMiddleware(requireAdminActor, {
        auth: null,
        headers: {
          'x-admin-actor-id': 'forged-actor'
        }
      });

      assert.equal(error.statusCode, 401);
      assert.equal(error.code, 'ADMIN_AUTH_REQUIRED');
    } finally {
      config.ADMIN_AUTH_ENABLED = originalAdminAuthEnabled;
    }
  });

  test('admin routes reject authenticated non-admin users', () => {
    const error = invokeMiddleware(requireAdminActor, {
      auth: {
        role: 'USER',
        actorId: 'user-1',
        userId: 'user-1',
        method: 'jwt'
      },
      headers: {}
    });

    assert.equal(error.statusCode, 401);
    assert.equal(error.code, 'ADMIN_AUTH_REQUIRED');
  });

  test('JWT administrators cannot override their audited actor identity with a header', () => {
    const request = {
      auth: {
        role: 'OWNER',
        actorId: 'owner-1',
        userId: 'owner-1',
        method: 'jwt'
      },
      headers: {
        'x-admin-actor-id': 'forged-actor'
      }
    };

    const error = invokeMiddleware(requireAdminActor, request);

    assert.equal(error, null);
    assert.equal(request.adminActorId, 'owner-1');
  });

  test('shared admin API tokens can retain an explicit operational actor ID', () => {
    const request = {
      auth: {
        role: 'ADMIN',
        actorId: 'default-admin',
        method: 'admin_api_token'
      },
      headers: {
        'x-admin-actor-id': 'operations-admin'
      }
    };

    const error = invokeMiddleware(requireAdminActor, request);

    assert.equal(error, null);
    assert.equal(request.adminActorId, 'operations-admin');
  });

  test('user-scope helpers fail closed without authenticated identity', () => {
    assert.throws(
      () => resolveUserIdForRequest({ auth: null }, 'user-1'),
      (error) => error.statusCode === 401 && error.code === 'USER_AUTH_REQUIRED'
    );
    assert.throws(
      () => assertCanAccessUserResource({ auth: null }, 'user-1'),
      (error) => error.statusCode === 401 && error.code === 'USER_AUTH_REQUIRED'
    );
  });

  test('Telegram owner and admin roles are resolved only from backend-controlled IDs', () => {
    assert.equal(roleFromTelegramUserId('9001003', config), 'OWNER');
    assert.equal(roleFromTelegramUserId(9001004, config), 'ADMIN');
    assert.equal(roleFromTelegramUserId('7777777', config), 'USER');
    assert.equal(roleFromTelegramUserId('@owner_username', config), 'USER');

    assert.deepEqual(buildRoleClaims('OWNER'), {
      role: 'OWNER',
      isAdmin: true,
      isOwner: true,
      is_admin: true,
      is_owner: true
    });
  });

  test('Telegram role reconciliation upgrades configured IDs and downgrades stale elevated roles', () => {
    assert.equal(reconcileTelegramRole('USER', '9001003', config), 'OWNER');
    assert.equal(reconcileTelegramRole('USER', '9001004', config), 'ADMIN');
    assert.equal(reconcileTelegramRole('OWNER', '7777777', config), 'USER');
    assert.equal(reconcileTelegramRole('ADMIN', '7777777', config), 'USER');
    assert.equal(reconcileTelegramRole('SUPPORT', '7777777', config), 'SUPPORT');
  });
});
