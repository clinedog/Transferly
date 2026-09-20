'use strict';

const { AppError } = require('../utils/errors');

function requireOrganizationPermission(permission) {
  return (request, _response, next) => {
    const organizationId = request.organizationContext?.organization?.id || request.auth?.organizationId;

    if (!organizationId) {
      next();
      return;
    }

    const permissions = request.auth?.organizationPermissions || [];
    if (!permissions.includes(permission)) {
      next(new AppError(403, 'ORGANIZATION_PERMISSION_REQUIRED', `Organization permission ${permission} is required.`));
      return;
    }

    next();
  };
}

module.exports = {
  requireOrganizationPermission
};
