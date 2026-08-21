const { createHash, randomUUID } = require('node:crypto');

const config = require('../config');
const { transaction } = require('../db');
const { authSessionRepository } = require('../repositories/authSessionRepository');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { telegramRepository } = require('../repositories/telegramRepository');
const { userRepository } = require('../repositories/userRepository');
const { walletRepository } = require('../repositories/walletRepository');
const { auditLogService } = require('./auditLogService');
const { pointLedgerService } = require('./pointLedgerService');
const {
  AUDIT_ACTOR_TYPE,
  POINT_TRANSACTION_TYPE,
  USER_STATUS
} = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { signJwt } = require('../utils/jwt');
const {
  buildRoleClaims,
  buildTelegramRoleAuditMetadata,
  reconcileTelegramRole,
  roleFromTelegramUserId
} = require('../core/auth/telegramAuthorization');
const {
  getRolePermissions,
  normalizeRole
} = require('../utils/roles');
const { validateTelegramMiniAppInitData } = require('../utils/telegramMiniAppAuth');

function getTokenLifetimeSeconds(session) {
  const remainingSeconds = Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000);
  return Math.max(1, Math.min(config.JWT_EXPIRES_IN_SECONDS, remainingSeconds));
}

async function buildAuthPayload(user, session, client) {
  const role = normalizeRole(user.profile?.role, {
    isAdmin: user.profile?.isAdmin
  });
  const roleClaims = buildRoleClaims(role);
  const expiresInSeconds = getTokenLifetimeSeconds(session);
  const points = await pointLedgerService.getBalance(user.id, client);

  const token = signJwt(
    {
      sub: user.id,
      sid: session.id,
      jti: session.currentTokenId,
      email: user.email,
      role,
      isAdmin: roleClaims.isAdmin,
      isOwner: roleClaims.isOwner
    },
    config.JWT_SECRET,
    expiresInSeconds
  );

  return {
    token,
    token_type: 'Bearer',
    expires_in: expiresInSeconds,
    session_expires_at: session.expiresAt,
    user: {
      ...user,
      points,
      profile: {
        ...user.profile,
        points
      },
      role,
      permissions: getRolePermissions(role),
      ...roleClaims
    }
  };
}

function hashTelegramExchange(initData) {
  return createHash('sha256').update(initData, 'utf8').digest('hex');
}

function assertActiveAccount(user) {
  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not active.');
  }

  return user;
}

function isTelegramExchangeReplay(error) {
  return error?.code === 'SQLITE_CONSTRAINT' &&
    String(error.message || '').includes('auth_sessions.telegram_exchange_hash');
}

function buildTelegramDisplayName(telegramUser) {
  return [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') ||
    telegramUser.username ||
    `Telegram User ${telegramUser.id}`;
}

function buildTelegramEmail(telegramUserId) {
  return `telegram-${telegramUserId}@telegram.transferly.local`;
}

function resolveTelegramRole(telegramUserId) {
  return roleFromTelegramUserId(telegramUserId, config);
}

async function createTelegramUser(telegramUser, client) {
  const platformConfig = await platformConfigRepository.get(client);
  const userId = randomUUID();
  const displayName = buildTelegramDisplayName(telegramUser);
  const role = resolveTelegramRole(telegramUser.id);

  await userRepository.upsert(
    {
      id: userId,
      email: buildTelegramEmail(telegramUser.id),
      displayName,
      countryCode: 'US'
    },
    client
  );

  await walletRepository.getOrCreate(client, userId, 'USD');

  await profileRepository.upsert(
    {
      userId,
      name: displayName,
      role,
      points: 0,
      telegramChatId: String(telegramUser.id),
      telegramUsername: telegramUser.username || null
    },
    client
  );

  if (platformConfig.signup_bonus > 0) {
    await pointLedgerService.applyEntry(
      {
        entryKey: `point-ledger:signup:${userId}`,
        userId,
        type: POINT_TRANSACTION_TYPE.SIGNUP_BONUS,
        amount: platformConfig.signup_bonus,
        description: 'Signup bonus credited.',
        referenceType: 'USER_SIGNUP',
        referenceId: userId,
        metadata: {
          source: 'auth.telegram_mini_app'
        }
      },
      client
    );
  }

  await platformConfigRepository.update(
    {
      total_users: Number(platformConfig.total_users || 0) + 1
    },
    client
  );

  await auditLogService.log(
    {
      actorType: AUDIT_ACTOR_TYPE.USER,
      actorId: userId,
      action: 'auth.telegram_mini_app_register',
      entityType: 'user',
      entityId: userId,
      metadata: {
        telegramUserId: String(telegramUser.id),
        username: telegramUser.username || null,
        role,
        ...buildRoleClaims(role)
      }
    },
    client
  );

  return userRepository.findById(userId, client);
}

async function reconcileTelegramProfileRole(user, telegramUser, client) {
  const currentRole = normalizeRole(user.profile?.role, {
    isAdmin: user.profile?.isAdmin
  });
  const nextRole = reconcileTelegramRole(currentRole, telegramUser.id, config);

  if (currentRole === nextRole) {
    return user;
  }

  await profileRepository.updateByUserId(
    user.id,
    { role: nextRole },
    client
  );
  await auditLogService.log(
    {
      actorType: AUDIT_ACTOR_TYPE.USER,
      actorId: user.id,
      action: 'profile.role_reconciled',
      entityType: 'user',
      entityId: user.id,
      metadata: buildTelegramRoleAuditMetadata(telegramUser.id, currentRole, nextRole)
    },
    client
  );

  return userRepository.findById(user.id, client);
}

async function resolveTelegramUser(telegramUser, client) {
  const existingAccount = await telegramRepository.findAccountByTelegramUserId(telegramUser.id, client);
  if (existingAccount?.userId) {
    const linkedUser = await userRepository.findById(existingAccount.userId, client);
    if (linkedUser) {
      return reconcileTelegramProfileRole(assertActiveAccount(linkedUser), telegramUser, client);
    }
  }

  const existingUser = await userRepository.findByEmail(buildTelegramEmail(telegramUser.id), client);
  if (existingUser) {
    return reconcileTelegramProfileRole(assertActiveAccount(existingUser), telegramUser, client);
  }

  return createTelegramUser(telegramUser, client);
}

async function loginWithTelegramMiniApp(input) {
  const verified = validateTelegramMiniAppInitData(input.initData, {
    botToken: config.TELEGRAM_BOT_TOKEN,
    expiresInSeconds: config.TELEGRAM_MINI_APP_AUTH_EXPIRES_IN_SECONDS
  });
  const telegramUser = verified.user;

  try {
    return await transaction(async (client) => {
      const user = await resolveTelegramUser(telegramUser, client);
      const chatId = verified.chatInstance || telegramUser.id;

      await telegramRepository.upsertAccount(
        {
          userId: user.id,
          telegramUserId: telegramUser.id,
          chatId,
          username: telegramUser.username || null,
          firstName: telegramUser.first_name || null,
          lastName: telegramUser.last_name || null,
          languageCode: telegramUser.language_code || null
        },
        client
      );

      await profileRepository.updateByUserId(user.id, {
        telegramChatId: String(chatId),
        telegramUsername: telegramUser.username || null
      }, client);

      const session = await authSessionRepository.create(
        {
          id: randomUUID(),
          userId: user.id,
          telegramUserId: telegramUser.id,
          telegramExchangeHash: hashTelegramExchange(input.initData),
          currentTokenId: randomUUID(),
          expiresAt: new Date(Date.now() + config.AUTH_SESSION_TTL_SECONDS * 1000).toISOString()
        },
        client
      );

      await auditLogService.log(
        {
          actorType: AUDIT_ACTOR_TYPE.USER,
          actorId: user.id,
          action: 'auth.telegram_mini_app_login',
          entityType: 'auth_session',
          entityId: session.id,
          metadata: {
            telegramUserId: String(telegramUser.id),
            username: telegramUser.username || null,
            startParam: input.startParam || verified.startParam || null,
            expiresAt: session.expiresAt
          }
        },
        client
      );

      return buildAuthPayload(await userRepository.findById(user.id, client), session, client);
    });
  } catch (error) {
    if (isTelegramExchangeReplay(error)) {
      throw new AppError(
        409,
        'TELEGRAM_INIT_DATA_REPLAYED',
        'Telegram Mini App init data has already been exchanged. Reopen the Mini App and try again.'
      );
    }

    throw error;
  }
}

async function refreshSession(auth) {
  if (auth.method !== 'jwt' || !auth.sessionId || !auth.tokenId) {
    throw new AppError(400, 'SESSION_REFRESH_UNAVAILABLE', 'This authentication method cannot be refreshed.');
  }

  return transaction(async (client) => {
    const user = await userRepository.findById(auth.userId, client);
    if (!user) {
      throw new AppError(401, 'USER_NOT_FOUND', 'Authenticated user no longer exists.');
    }
    assertActiveAccount(user);

    const nextTokenId = randomUUID();
    const rotated = await authSessionRepository.rotateToken(
      auth.sessionId,
      auth.tokenId,
      nextTokenId,
      client
    );
    if (!rotated) {
      throw new AppError(401, 'SESSION_INVALID', 'Authentication session is no longer active.');
    }

    const session = await authSessionRepository.findById(auth.sessionId, client);
    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: user.id,
        action: 'auth.session_refreshed',
        entityType: 'auth_session',
        entityId: session.id,
        metadata: {
          expiresAt: session.expiresAt
        }
      },
      client
    );

    return buildAuthPayload(user, session, client);
  });
}

async function logoutSession(auth) {
  if (auth.method !== 'jwt' || !auth.sessionId || !auth.tokenId) {
    return { ok: true, revoked: false };
  }

  return transaction(async (client) => {
    const revoked = await authSessionRepository.revoke(
      auth.sessionId,
      auth.tokenId,
      'user_logout',
      client
    );
    if (!revoked) {
      throw new AppError(401, 'SESSION_INVALID', 'Authentication session is no longer active.');
    }

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: auth.userId,
        action: 'auth.session_revoked',
        entityType: 'auth_session',
        entityId: auth.sessionId,
        metadata: {
          reason: 'user_logout'
        }
      },
      client
    );

    return { ok: true, revoked: true };
  });
}

module.exports = {
  authService: {
    loginWithTelegramMiniApp,
    logoutSession,
    refreshSession
  }
};
