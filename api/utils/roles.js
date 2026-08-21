const ROLES = Object.freeze({
  USER: 'USER',
  SUPPORT: 'SUPPORT',
  ADMIN: 'ADMIN',
  OWNER: 'OWNER'
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

const PERMISSIONS = Object.freeze({
  ADMIN_ACCESS: 'admin:access',
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  SYSTEM_READ: 'system:read',
  SYSTEM_MANAGE: 'system:manage',
  PAYMENTS_OPERATE: 'payments:operate',
  CONTENT_MANAGE: 'content:manage'
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.USER]: Object.freeze([]),
  [ROLES.SUPPORT]: Object.freeze([
    PERMISSIONS.USERS_READ,
    PERMISSIONS.SYSTEM_READ
  ]),
  [ROLES.ADMIN]: Object.freeze([
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.SYSTEM_READ,
    PERMISSIONS.PAYMENTS_OPERATE,
    PERMISSIONS.CONTENT_MANAGE
  ]),
  [ROLES.OWNER]: Object.freeze([
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.SYSTEM_READ,
    PERMISSIONS.SYSTEM_MANAGE,
    PERMISSIONS.PAYMENTS_OPERATE,
    PERMISSIONS.CONTENT_MANAGE
  ])
});

const ROLE_RANK = Object.freeze({
  [ROLES.USER]: 0,
  [ROLES.SUPPORT]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.OWNER]: 3
});

function normalizeRole(value, fallback = {}) {
  const role = String(value || '').trim().toUpperCase();
  if (ROLE_VALUES.includes(role)) {
    return role;
  }

  return fallback.isAdmin ? ROLES.ADMIN : ROLES.USER;
}

function getRolePermissions(role) {
  return [...(ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS[ROLES.USER])];
}

function roleRank(role) {
  return ROLE_RANK[normalizeRole(role)] ?? ROLE_RANK[ROLES.USER];
}

function isOwnerRole(role) {
  return normalizeRole(role) === ROLES.OWNER;
}

function isAdminRole(role) {
  return [ROLES.ADMIN, ROLES.OWNER].includes(normalizeRole(role));
}

function hasPermission(actor, permission) {
  if (!permission) {
    return false;
  }

  const role = typeof actor === 'string' ? actor : actor?.role;
  return getRolePermissions(role).includes(permission);
}

function canManageRole({ actorRole, currentRole, nextRole, isSelf = false } = {}) {
  const actor = normalizeRole(actorRole);
  const current = normalizeRole(currentRole);
  const next = normalizeRole(nextRole);

  if (actor === ROLES.OWNER) {
    return !(isSelf && current === ROLES.OWNER && next !== ROLES.OWNER);
  }

  if (actor !== ROLES.ADMIN) {
    return false;
  }

  return roleRank(current) < roleRank(ROLES.ADMIN) && roleRank(next) < roleRank(ROLES.ADMIN);
}

module.exports = {
  PERMISSIONS,
  ROLES,
  ROLE_VALUES,
  canManageRole,
  getRolePermissions,
  hasPermission,
  isAdminRole,
  isOwnerRole,
  normalizeRole,
  roleRank
};
