'use strict';

const { getRolePermissions, normalizeRole } = require('../utils/roles');

function buildContext({ user, profile } = {}) {
  const role = normalizeRole(profile?.role || user?.role, {
    isAdmin: profile?.isAdmin ?? user?.isAdmin
  });
  return {
    mode: 'individual',
    organization: {
      id: user?.id || null,
      name: profile?.name || user?.displayName || user?.email || 'Personal workspace',
      status: user?.status || 'active',
      role,
      permissions: getRolePermissions(role),
      membershipSource: 'current-user-account'
    },
    tenantIsolation: {
      enforcedBy: 'authenticated-user-scope',
      multiOrganizationMembership: false
    }
  };
}

module.exports = { organizationContextService: { buildContext } };
