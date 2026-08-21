'use strict';

const { ROLES, isAdminRole, isOwnerRole, normalizeRole } = require('../../utils/roles');

function normalizeTelegramUserId(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  if (!/^\d+$/.test(text)) {
    return null;
  }

  return text;
}

function roleFromTelegramUserId(telegramUserId, config) {
  const normalizedId = normalizeTelegramUserId(telegramUserId);
  if (!normalizedId) {
    return ROLES.USER;
  }

  if (config.OWNER_TELEGRAM_USER_IDS?.has(normalizedId)) {
    return ROLES.OWNER;
  }

  if (config.ADMIN_TELEGRAM_USER_IDS?.has(normalizedId)) {
    return ROLES.ADMIN;
  }

  return ROLES.USER;
}

function reconcileTelegramRole(currentRole, telegramUserId, config) {
  const normalizedCurrentRole = normalizeRole(currentRole);
  const configuredRole = roleFromTelegramUserId(telegramUserId, config);

  if (configuredRole !== ROLES.USER) {
    return configuredRole;
  }

  if (normalizedCurrentRole === ROLES.OWNER || normalizedCurrentRole === ROLES.ADMIN) {
    return ROLES.USER;
  }

  return normalizedCurrentRole;
}

function buildTelegramRoleAuditMetadata(telegramUserId, previousRole, nextRole) {
  return {
    telegramUserId: normalizeTelegramUserId(telegramUserId) || String(telegramUserId || ''),
    previousRole: normalizeRole(previousRole),
    nextRole: normalizeRole(nextRole),
    reason: 'Reconciled backend Telegram owner/admin allowlists'
  };
}

function buildRoleClaims(role) {
  const normalizedRole = normalizeRole(role);
  const isAdmin = isAdminRole(normalizedRole);
  const isOwner = isOwnerRole(normalizedRole);

  return {
    role: normalizedRole,
    isAdmin,
    isOwner,
    is_admin: isAdmin,
    is_owner: isOwner
  };
}

module.exports = {
  buildRoleClaims,
  buildTelegramRoleAuditMetadata,
  normalizeTelegramUserId,
  reconcileTelegramRole,
  roleFromTelegramUserId
};