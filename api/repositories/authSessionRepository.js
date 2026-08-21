const { db } = require('../db');

function mapAuthSession(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    telegramUserId: row.telegram_user_id,
    telegramExchangeHash: row.telegram_exchange_hash,
    currentTokenId: row.current_token_id,
    status: row.status,
    expiresAt: row.expires_at,
    lastRefreshedAt: row.last_refreshed_at,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function create(data, client = db) {
  const now = new Date().toISOString();

  await client.run(
    `
      INSERT INTO auth_sessions (
        id, user_id, telegram_user_id, telegram_exchange_hash, current_token_id,
        status, expires_at, last_refreshed_at, revoked_at, revoke_reason,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, NULL, NULL, NULL, ?, ?)
    `,
    [
      data.id,
      data.userId,
      String(data.telegramUserId),
      data.telegramExchangeHash,
      data.currentTokenId,
      data.expiresAt,
      now,
      now
    ]
  );

  return findById(data.id, client);
}

async function findById(sessionId, client = db) {
  const row = await client.get('SELECT * FROM auth_sessions WHERE id = ?', [sessionId]);
  return mapAuthSession(row);
}

async function rotateToken(sessionId, expectedTokenId, nextTokenId, client = db) {
  const now = new Date().toISOString();
  const result = await client.run(
    `
      UPDATE auth_sessions
      SET current_token_id = ?, last_refreshed_at = ?, updated_at = ?
      WHERE id = ?
        AND current_token_id = ?
        AND status = 'active'
        AND expires_at > ?
    `,
    [nextTokenId, now, now, sessionId, expectedTokenId, now]
  );

  return result.changes === 1;
}

async function revoke(sessionId, expectedTokenId, reason, client = db) {
  const now = new Date().toISOString();
  const result = await client.run(
    `
      UPDATE auth_sessions
      SET status = 'revoked', revoked_at = ?, revoke_reason = ?, updated_at = ?
      WHERE id = ?
        AND current_token_id = ?
        AND status = 'active'
    `,
    [now, reason, now, sessionId, expectedTokenId]
  );

  return result.changes === 1;
}

module.exports = {
  authSessionRepository: {
    create,
    findById,
    revoke,
    rotateToken
  }
};
