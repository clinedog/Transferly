const config = require('../config');
const { buildRoleClaims, reconcileTelegramRole } = require('../core/auth/telegramAuthorization');
const { authSessionRepository } = require('../repositories/authSessionRepository');
const { apiKeyService } = require('../services/apiKeyService');
const { profileRepository } = require('../repositories/profileRepository');
const { userRepository } = require('../repositories/userRepository');
const { USER_STATUS } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { verifyJwt } = require('../utils/jwt');
const { ROLE_VALUES, isAdminRole, normalizeRole } = require('../utils/roles');
const { createRedisReplayStore } = require('../utils/serviceReplayStore');
const { verifyServiceRequestSignatureAsync } = require('../utils/serviceRequestAuth');

let botApiReplayStore = null;

function assertActiveAccount(user) {
  if (user && user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not active.');
  }
}

function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function parseCookieToken(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return null;
  }

  const target = `${config.AUTH_COOKIE_NAME}=`;
  const parts = cookieHeader.split(';').map((entry) => entry.trim());
  const match = parts.find((entry) => entry.startsWith(target));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(target.length));
}

function getBotApiReplayStore() {
  if (!config.BOT_API_HMAC_REPLAY_PROTECTION || config.BOT_API_HMAC_REPLAY_STORE !== 'redis') {
    return null;
  }

  if (!botApiReplayStore) {
    botApiReplayStore = createRedisReplayStore({
      redisUrl: config.REDIS_URL,
      keyPrefix: config.BOT_API_HMAC_REPLAY_KEY_PREFIX
    });
  }

  return botApiReplayStore;
}

async function authenticateRequestAsync(request, _response, next) {
  const token =
    parseBearerToken(request.headers.authorization) ||
    parseCookieToken(request.headers.cookie);
  request.auth = null;

  if (!token) {
    next();
    return;
  }

  if (token.startsWith('tl_live_')) {
    const apiKey = await apiKeyService.authenticate(token);
    if (!apiKey) {
      next(new AppError(401, 'INVALID_API_TOKEN', 'Invalid API token.'));
      return;
    }
    const user = await userRepository.findById(apiKey.userId);
    assertActiveAccount(user);
    request.auth = {
      role: 'USER',
      actorId: apiKey.userId,
      userId: apiKey.userId,
      apiKeyId: apiKey.id,
      organizationId: apiKey.organizationId || null,
      apiKeyScopes: apiKey.scopes,
      method: 'api_key'
    };
    next();
    return;
  }

  if (config.ADMIN_AUTH_ENABLED && token === config.ADMIN_API_TOKEN) {
    let serviceSignature = null;
    if (config.BOT_API_HMAC_ENABLED || config.BOT_API_HMAC_REQUIRED) {
      serviceSignature = await verifyServiceRequestSignatureAsync(request, {
        secret: config.BOT_API_HMAC_SECRET,
        maxAgeMs: config.BOT_API_HMAC_MAX_AGE_MS,
        replayProtection: config.BOT_API_HMAC_REPLAY_PROTECTION,
        replayStore: getBotApiReplayStore()
      });
    }
    request.auth = {
      role: 'ADMIN',
      actorId: config.DEFAULT_ADMIN_ACTOR_ID,
      userId: null,
      method: 'admin_api_token',
      serviceSignature
    };
    next();
    return;
  }

  const userId = config.USER_API_TOKEN_MAP[token];
  if (userId) {
    const user = await userRepository.findById(userId);
    assertActiveAccount(user);
    request.auth = {
      role: 'USER',
      actorId: userId,
      userId,
      method: 'user_api_token'
    };
    next();
    return;
  }

  if (config.JWT_AUTH_ENABLED) {
    try {
      const payload = verifyJwt(token, config.JWT_SECRET, {
        clockSkewSeconds: config.JWT_CLOCK_SKEW_SECONDS
      });
      if (!payload.sub || !payload.sid || !payload.jti) {
        throw new AppError(401, 'SESSION_INVALID', 'Authentication session is invalid.');
      }

      const session = await authSessionRepository.findById(payload.sid);
      if (
        !session ||
        session.userId !== payload.sub ||
        session.currentTokenId !== payload.jti ||
        session.status !== 'active'
      ) {
        throw new AppError(401, 'SESSION_INVALID', 'Authentication session is no longer active.');
      }

      if (Date.parse(session.expiresAt) <= Date.now()) {
        throw new AppError(401, 'SESSION_EXPIRED', 'Authentication session has expired.');
      }

      const user = await userRepository.findById(payload.sub);
      if (!user) {
        throw new AppError(401, 'USER_NOT_FOUND', 'Authenticated user no longer exists.');
      }
      assertActiveAccount(user);

      const currentRole = normalizeRole(user.profile?.role, { isAdmin: user.profile?.isAdmin });
      const role = reconcileTelegramRole(currentRole, session.telegramUserId, config);
      if (role !== currentRole) {
        await profileRepository.updateByUserId(user.id, { role });
      }
      const roleClaims = buildRoleClaims(role);
      request.auth = {
        role,
        actorId: payload.sub,
        userId: payload.sub,
        sessionId: session.id,
        tokenId: payload.jti,
        email: user.email || null,
        isAdmin: roleClaims.isAdmin,
        isOwner: roleClaims.isOwner,
        method: 'jwt'
      };
      next();
      return;
    } catch (error) {
      next(error);
      return;
    }
  }

  next(new AppError(401, 'INVALID_API_TOKEN', 'Invalid API token.'));
}

function authenticateRequest(request, response, next) {
  authenticateRequestAsync(request, response, next).catch(next);
}

function requireAuthenticatedUser(request, _response, next) {
  if (!isAuthenticatedUser(request)) {
    next(new AppError(401, 'USER_AUTH_REQUIRED', 'A valid user bearer token is required.'));
    return;
  }

  next();
}

function requireInteractiveSession(request, _response, next) {
  if (!isAuthenticatedUser(request) || request.auth.method !== 'jwt') {
    next(new AppError(401, 'SESSION_AUTH_REQUIRED', 'An interactive authentication session is required.'));
    return;
  }
  next();
}

function isAuthenticatedUser(request) {
  const role = String(request.auth?.role || '').trim().toUpperCase();
  return Boolean(
    request.auth?.userId &&
    request.auth?.method !== 'admin_api_token' &&
    ROLE_VALUES.includes(role)
  );
}

function resolveUserIdForRequest(request, requestedUserId) {
  if (!isAuthenticatedUser(request)) {
    throw new AppError(401, 'USER_AUTH_REQUIRED', 'A valid user bearer token is required.');
  }

  if (!isAdminRole(request.auth.role)) {
    if (requestedUserId && requestedUserId !== request.auth.userId) {
      throw new AppError(403, 'USER_SCOPE_VIOLATION', 'You cannot act on behalf of another user.');
    }

    return request.auth.userId;
  }

  return requestedUserId;
}

function assertCanAccessUserResource(request, resourceUserId) {
  if (!isAuthenticatedUser(request)) {
    throw new AppError(401, 'USER_AUTH_REQUIRED', 'A valid user bearer token is required.');
  }

  if (!isAdminRole(request.auth.role) && resourceUserId !== request.auth.userId) {
    throw new AppError(403, 'USER_SCOPE_VIOLATION', 'You cannot access another user resource.');
  }
}

module.exports = {
  authenticateRequest,
  requireAuthenticatedUser,
  requireInteractiveSession,
  resolveUserIdForRequest,
  assertCanAccessUserResource
};
