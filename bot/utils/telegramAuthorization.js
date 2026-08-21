'use strict';

const { ROLES } = require('./capabilities');

function normalizeTelegramUserId(value) {
  const text = String(value ?? '').trim();
  if (!text || !/^\d+$/.test(text)) {
    return null;
  }
  return text;
}

function parseTelegramUserIds(...values) {
  const ids = new Set();

  for (const value of values) {
    String(value || '')
      .split(',')
      .map((entry) => normalizeTelegramUserId(entry))
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  }

  return ids;
}

function resolveConfiguredTelegramRole(telegramUserId, options = {}) {
  const id = normalizeTelegramUserId(telegramUserId);
  if (!id) {
    return ROLES.GUEST;
  }

  if (options.ownerIds?.has(id)) {
    return ROLES.OWNER;
  }

  if (options.adminIds?.has(id)) {
    return ROLES.ADMIN;
  }

  return ROLES.GUEST;
}

module.exports = {
  normalizeTelegramUserId,
  parseTelegramUserIds,
  resolveConfiguredTelegramRole
};