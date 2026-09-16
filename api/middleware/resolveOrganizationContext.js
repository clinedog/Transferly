'use strict';

const { organizationService } = require('../services/organizationService');
const { AppError } = require('../utils/errors');

const ORGANIZATION_HEADER = 'x-organization-id';

async function resolveOrganizationContextAsync(request, _response, next) {
  const organizationId = request.headers[ORGANIZATION_HEADER] || request.auth?.organizationId;
  if (!organizationId) {
    next();
    return;
  }

  if (!request.auth?.userId) {
    next(new AppError(401, 'USER_AUTH_REQUIRED', 'A valid user bearer token is required for organization context.'));
    return;
  }

  if (request.auth.method === 'api_key' && request.auth.organizationId !== organizationId) {
    next(new AppError(403, 'ORGANIZATION_CONTEXT_MISMATCH', 'The API key is not bound to this organization.'));
    return;
  }

  try {
    const context = await organizationService.resolveContext({
      userId: request.auth.userId,
      organizationId
    });
    request.organizationContext = context;
    request.auth.organizationId = context.organization.id;
    request.auth.organizationPermissions = context.permissions;
    next();
  } catch (error) {
    next(error);
  }
}

function resolveOrganizationContext(request, response, next) {
  resolveOrganizationContextAsync(request, response, next).catch(next);
}

module.exports = {
  ORGANIZATION_HEADER,
  resolveOrganizationContext
};
