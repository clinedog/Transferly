const config = require('../config');
const { AppError } = require('../utils/errors');
const { isAdminRole } = require('../utils/roles');

function requireAdminActor(request, _response, next) {
  if (!request.auth || !isAdminRole(request.auth.role)) {
    next(new AppError(401, 'ADMIN_AUTH_REQUIRED', 'A valid admin bearer token is required.'));
    return;
  }

  const headerActorId = request.headers['x-admin-actor-id'];
  const adminActorId =
    (request.auth.method === 'admin_api_token' && typeof headerActorId === 'string' && headerActorId) ||
    request.auth.actorId ||
    config.DEFAULT_ADMIN_ACTOR_ID;

  if (!adminActorId) {
    next(new AppError(400, 'ADMIN_ACTOR_ID_REQUIRED', 'x-admin-actor-id header is required.'));
    return;
  }

  request.adminActorId = adminActorId;
  next();
}

module.exports = {
  requireAdminActor
};
