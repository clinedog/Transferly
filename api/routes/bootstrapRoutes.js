const express = require('express');

const {
  getBootstrapController,
  getCurrentUserCommandCenterController,
  getCurrentUserController
} = require('../controllers/bootstrapController');
const {
  createApiKeyController,
  listApiKeysController,
  revokeApiKeyController,
  rotateApiKeyController
} = require('../controllers/apiKeyController');
const { listSessionsController, revokeSessionController } = require('../controllers/sessionController');
const { organizationService } = require('../services/organizationService');
const {
  createOrganizationController,
  createOrganizationInvitationController,
  acceptOrganizationInvitationController,
  listOrganizationInvitationsController,
  listOrganizationMembersController,
  removeOrganizationMemberController,
  revokeOrganizationInvitationController,
  updateOrganizationMemberRoleController
} = require('../controllers/organizationController');
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  requireAuthenticatedUser,
  requireInteractiveSession
} = require('../middleware/authenticateRequest');

const bootstrapRouter = express.Router();
const meRouter = express.Router();
const workspaceRouter = express.Router();

bootstrapRouter.get('/', asyncHandler(getBootstrapController));
meRouter.get('/command-center', requireAuthenticatedUser, asyncHandler(getCurrentUserCommandCenterController));
meRouter.get('/', requireAuthenticatedUser, asyncHandler(getCurrentUserController));
meRouter.get('/api-keys', requireInteractiveSession, asyncHandler(listApiKeysController));
meRouter.post('/api-keys', requireInteractiveSession, asyncHandler(createApiKeyController));
meRouter.post('/api-keys/:id/rotate', requireInteractiveSession, asyncHandler(rotateApiKeyController));
meRouter.delete('/api-keys/:id', requireInteractiveSession, asyncHandler(revokeApiKeyController));
meRouter.get('/sessions', requireInteractiveSession, asyncHandler(listSessionsController));
meRouter.delete('/sessions/:id', requireInteractiveSession, asyncHandler(revokeSessionController));
meRouter.get('/organizations', requireAuthenticatedUser, asyncHandler(async (request, response) => {
  response.json({ data: await organizationService.listForUser(request.auth.userId) });
}));
meRouter.post('/organizations', requireInteractiveSession, asyncHandler(createOrganizationController));
meRouter.get('/organizations/:id/context', requireAuthenticatedUser, asyncHandler(async (request, response) => {
  response.json({ data: await organizationService.resolveContext({
    userId: request.auth.userId,
    organizationId: request.params.id
  }) });
}));
meRouter.get('/organizations/:id/members', requireAuthenticatedUser, asyncHandler(listOrganizationMembersController));
meRouter.patch('/organizations/:id/members/:userId', requireInteractiveSession, asyncHandler(updateOrganizationMemberRoleController));
meRouter.delete('/organizations/:id/members/:userId', requireInteractiveSession, asyncHandler(removeOrganizationMemberController));
meRouter.get('/organizations/:id/invitations', requireInteractiveSession, asyncHandler(listOrganizationInvitationsController));
meRouter.post('/organizations/:id/invitations', requireInteractiveSession, asyncHandler(createOrganizationInvitationController));
meRouter.delete('/organizations/:id/invitations/:invitationId', requireInteractiveSession, asyncHandler(revokeOrganizationInvitationController));
meRouter.post('/organization-invitations/accept', requireInteractiveSession, asyncHandler(acceptOrganizationInvitationController));
workspaceRouter.get('/', requireAuthenticatedUser, asyncHandler(getCurrentUserController));

module.exports = {
  bootstrapRoutes: bootstrapRouter,
  meRoutes: meRouter,
  workspaceRoutes: workspaceRouter
};
