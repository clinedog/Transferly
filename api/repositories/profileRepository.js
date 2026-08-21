const { db } = require('../db');
const { randomUUID } = require('node:crypto');
const {
  getRolePermissions,
  isAdminRole,
  isOwnerRole,
  normalizeRole
} = require('../utils/roles');

function mapProfile(row) {
  if (!row) {
    return null;
  }

  const role = normalizeRole(row.role, { isAdmin: Boolean(row.is_admin) });
  const isAdmin = isAdminRole(role);

  return {
    id: row.user_id,
    userId: row.user_id,
    name: row.name,
    role,
    permissions: getRolePermissions(role),
    isAdmin,
    is_admin: isAdmin,
    isOwner: isOwnerRole(role),
    is_owner: isOwnerRole(role),
    points: row.points,
    referralCode: row.referral_code,
    referral_code: row.referral_code,
    referredByUserId: row.referred_by_user_id,
    referred_by_user_id: row.referred_by_user_id,
    referralCount: row.referral_count,
    referral_count: row.referral_count,
    telegramChatId: row.telegram_chat_id,
    telegram_chat_id: row.telegram_chat_id,
    telegramUsername: row.telegram_username,
    telegram_username: row.telegram_username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function createReferralCode(userId) {
  return String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() + randomUUID().slice(0, 4).toUpperCase();
}

async function findByUserId(userId, client = db) {
  const row = await client.get('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  return mapProfile(row);
}

async function findByReferralCode(referralCode, client = db) {
  const row = await client.get('SELECT * FROM profiles WHERE referral_code = ?', [String(referralCode || '').toUpperCase()]);
  return mapProfile(row);
}

async function upsert(data, client = db) {
  const now = new Date().toISOString();
  const existing = await findByUserId(data.userId, client);
  const referralCode = data.referralCode || existing?.referralCode || createReferralCode(data.userId);
  const role = normalizeRole(data.role ?? existing?.role, {
    isAdmin: data.isAdmin ?? existing?.isAdmin
  });
  const isAdmin = isAdminRole(role);

  await client.run(
    `
      INSERT INTO profiles (
        user_id, name, is_admin, role, points, referral_code, referred_by_user_id, referral_count,
        telegram_chat_id, telegram_username, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        name = excluded.name,
        is_admin = excluded.is_admin,
        role = excluded.role,
        points = excluded.points,
        referral_code = excluded.referral_code,
        referred_by_user_id = excluded.referred_by_user_id,
        referral_count = excluded.referral_count,
        telegram_chat_id = excluded.telegram_chat_id,
        telegram_username = excluded.telegram_username,
        updated_at = excluded.updated_at
    `,
    [
      data.userId,
      data.name,
      isAdmin ? 1 : 0,
      role,
      data.points ?? existing?.points ?? 0,
      referralCode,
      data.referredByUserId || existing?.referredByUserId || null,
      data.referralCount ?? existing?.referralCount ?? 0,
      data.telegramChatId ?? existing?.telegramChatId ?? null,
      data.telegramUsername ?? existing?.telegramUsername ?? null,
      existing?.createdAt || now,
      now
    ]
  );

  return findByUserId(data.userId, client);
}

async function updateByUserId(userId, updates, client = db) {
  const existing = await findByUserId(userId, client);
  if (!existing) {
    return null;
  }

  return upsert(
    {
      userId,
      name: updates.name ?? existing.name,
      isAdmin: updates.isAdmin ?? existing.isAdmin,
      role: updates.role ?? existing.role,
      points: updates.points ?? existing.points,
      referralCode: updates.referralCode ?? existing.referralCode,
      referredByUserId: updates.referredByUserId ?? existing.referredByUserId,
      referralCount: updates.referralCount ?? existing.referralCount,
      telegramChatId: updates.telegramChatId ?? existing.telegramChatId,
      telegramUsername: updates.telegramUsername ?? existing.telegramUsername
    },
    client
  );
}

async function applyPointDelta(userId, amount, client = db) {
  const now = new Date().toISOString();
  const result = await client.run(
    `
      UPDATE profiles
      SET points = points + ?, updated_at = ?
      WHERE user_id = ? AND points + ? >= 0
    `,
    [amount, now, userId, amount]
  );

  if (result.changes !== 1) {
    return null;
  }

  return findByUserId(userId, client);
}

async function setPointProjection(userId, points, client = db) {
  const normalizedPoints = Number(points);
  if (!Number.isSafeInteger(normalizedPoints) || normalizedPoints < 0) {
    return null;
  }

  const now = new Date().toISOString();
  const result = await client.run(
    'UPDATE profiles SET points = ?, updated_at = ? WHERE user_id = ?',
    [normalizedPoints, now, userId]
  );

  if (result.changes !== 1) {
    return null;
  }

  return findByUserId(userId, client);
}

async function incrementReferralCount(userId, amount = 1, client = db) {
  const existing = await findByUserId(userId, client);
  if (!existing) {
    return null;
  }

  return updateByUserId(userId, {
    referralCount: existing.referralCount + amount
  }, client);
}

async function listReferredUsers(referrerUserId, client = db) {
  const rows = await client.all(
    `
      SELECT
        p.user_id,
        p.name,
        p.created_at,
        u.email
      FROM profiles p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.referred_by_user_id = ?
      ORDER BY p.created_at DESC
    `,
    [referrerUserId]
  );

  return rows.map((row) => ({
    id: row.user_id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    created_at: row.created_at
  }));
}

module.exports = {
  profileRepository: {
    applyPointDelta,
    findByUserId,
    findByReferralCode,
    upsert,
    updateByUserId,
    incrementReferralCount,
    listReferredUsers,
    setPointProjection
  }
};
