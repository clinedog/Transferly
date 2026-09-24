const { db } = require('../db');

const DEFAULT_PREFERENCES = Object.freeze({
  channels: { in_app: true, telegram: true, email: false, webhook: false },
  categories: { funding: true, operations: true, security: true }
});

function cloneDefaults() {
  return {
    channels: { ...DEFAULT_PREFERENCES.channels },
    categories: { ...DEFAULT_PREFERENCES.categories }
  };
}

function mapPreferences(row) {
  if (!row) return null;
  let channels = {};
  let categories = {};
  try { channels = JSON.parse(row.channels_json || '{}'); } catch { channels = {}; }
  try { categories = JSON.parse(row.categories_json || '{}'); } catch { categories = {}; }
  return {
    channels: { ...DEFAULT_PREFERENCES.channels, ...channels },
    categories: { ...DEFAULT_PREFERENCES.categories, ...categories },
    updatedAt: row.updated_at
  };
}

async function getForUser(userId, client = db) {
  const row = await client.get('SELECT * FROM notification_preferences WHERE user_id = ?', [userId]);
  return mapPreferences(row) || cloneDefaults();
}

async function upsertForUser(userId, preferences, client = db) {
  const current = await getForUser(userId, client);
  const next = {
    channels: { ...current.channels, ...(preferences.channels || {}) },
    categories: { ...current.categories, ...(preferences.categories || {}) }
  };
  const updatedAt = new Date().toISOString();
  await client.run(`
    INSERT INTO notification_preferences (user_id, channels_json, categories_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      channels_json = excluded.channels_json,
      categories_json = excluded.categories_json,
      updated_at = excluded.updated_at
  `, [userId, JSON.stringify(next.channels), JSON.stringify(next.categories), updatedAt]);
  return { ...next, updatedAt };
}

module.exports = {
  DEFAULT_PREFERENCES,
  notificationPreferencesRepository: { getForUser, upsertForUser }
};
