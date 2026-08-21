const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { db } = require('../db');
const { AppError } = require('../utils/errors');
const { parseJson, serializeJson } = require('../utils/records');

function mapTransaction(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    entryKey: row.entry_key,
    entry_key: row.entry_key,
    userId: row.user_id,
    user_id: row.user_id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    referenceType: row.reference_type,
    reference_type: row.reference_type,
    referenceId: row.reference_id,
    reference_id: row.reference_id,
    balanceAfter: row.balance_after,
    balance_after: row.balance_after,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at
  };
}

function assertIdempotentEntryMatches(existing, data) {
  const expectedReferenceType = data.referenceType || null;
  const expectedReferenceId = data.referenceId || null;
  let matches =
    existing.userId === data.userId &&
    existing.type === data.type &&
    existing.amount === Number(data.amount) &&
    existing.referenceType === expectedReferenceType &&
    existing.referenceId === expectedReferenceId;

  if (data.description !== undefined) {
    matches = matches && existing.description === data.description;
  }
  if (data.metadata !== undefined) {
    matches = matches && isDeepStrictEqual(existing.metadata, data.metadata);
  }

  if (!matches) {
    throw new AppError(
      409,
      'POINT_TRANSACTION_ENTRY_CONFLICT',
      'Point transaction entry key already exists with different transaction details.'
    );
  }
}

async function create(data, client = db) {
  const id = data.id || randomUUID();
  const entryKey = data.entryKey || `point-transaction:${id}`;
  const createdAt = data.createdAt || new Date().toISOString();
  const existing = await findByEntryKey(entryKey, client);
  if (existing) {
    assertIdempotentEntryMatches(existing, data);
    return existing;
  }

  await client.run(
    `
      INSERT INTO points_transactions (
        id, entry_key, user_id, type, amount, description,
        reference_type, reference_id, balance_after, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      entryKey,
      data.userId,
      data.type,
      data.amount,
      data.description,
      data.referenceType || null,
      data.referenceId || null,
      data.balanceAfter ?? null,
      serializeJson(data.metadata || {}),
      createdAt
    ]
  );

  const row = await client.get('SELECT * FROM points_transactions WHERE id = ?', [id]);
  return mapTransaction(row);
}

async function findByEntryKey(entryKey, client = db) {
  const row = await client.get('SELECT * FROM points_transactions WHERE entry_key = ?', [entryKey]);
  return mapTransaction(row);
}

async function findByUserId(userId, client = db) {
  const rows = await client.all(
    'SELECT * FROM points_transactions WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(mapTransaction);
}

async function getBalanceByUserId(userId, client = db) {
  const row = await client.get(
    'SELECT COALESCE(SUM(amount), 0) AS balance FROM points_transactions WHERE user_id = ?',
    [userId]
  );
  return Number(row?.balance || 0);
}

async function getBalancesByUserIds(userIds, client = db) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  const balances = new Map(uniqueUserIds.map((userId) => [userId, 0]));

  // Stay below SQLite's default bind-parameter limit for large admin lists.
  for (let offset = 0; offset < uniqueUserIds.length; offset += 500) {
    const userIdChunk = uniqueUserIds.slice(offset, offset + 500);
    const placeholders = userIdChunk.map(() => '?').join(', ');
    const rows = await client.all(
      `
        SELECT user_id, COALESCE(SUM(amount), 0) AS balance
        FROM points_transactions
        WHERE user_id IN (${placeholders})
        GROUP BY user_id
      `,
      userIdChunk
    );

    for (const row of rows) {
      balances.set(row.user_id, Number(row.balance || 0));
    }
  }

  return balances;
}

module.exports = {
  pointTransactionRepository: {
    create,
    findByEntryKey,
    findByUserId,
    getBalancesByUserIds,
    getBalanceByUserId
  }
};
