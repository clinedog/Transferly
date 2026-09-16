'use strict';

const { AppError } = require('../utils/errors');

function requireApiKeyScope(resource) {
  return function apiKeyScopeMiddleware(request, _response, next) {
    if (request.auth?.method !== 'api_key') {
      next();
      return;
    }

    const operation = request.method === 'GET' || request.method === 'HEAD' ? 'read' : 'write';
    const requiredScope = `${resource}:${operation}`;
    const scopes = Array.isArray(request.auth.apiKeyScopes) ? request.auth.apiKeyScopes : [];
    if (!scopes.includes(requiredScope)) {
      next(new AppError(403, 'API_KEY_SCOPE_REQUIRED', `API key scope ${requiredScope} is required.`));
      return;
    }
    next();
  };
}

module.exports = { requireApiKeyScope };
