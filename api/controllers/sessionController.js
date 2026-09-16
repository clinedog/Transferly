'use strict';

const { sessionManagementService } = require('../services/sessionManagementService');

async function listSessionsController(request, response) {
  response.json({
    sessions: await sessionManagementService.list({
      userId: request.auth.userId,
      currentSessionId: request.auth.sessionId
    })
  });
}

async function revokeSessionController(request, response) {
  response.json(await sessionManagementService.revoke({
    userId: request.auth.userId,
    actorId: request.auth.actorId,
    sessionId: request.params.id
  }));
}

module.exports = { listSessionsController, revokeSessionController };
