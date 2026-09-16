'use strict';

const {
  organizationCreateSchema,
  organizationInvitationAcceptSchema,
  organizationInvitationSchema,
  organizationRoleSchema
} = require('../schemas/organizationSchemas');
const { organizationService } = require('../services/organizationService');

async function createOrganizationController(request, response) {
  const input = organizationCreateSchema.parse(request.body || {});
  const organization = await organizationService.create({
    userId: request.auth.userId,
    actorId: request.auth.actorId,
    name: input.name
  });
  response.status(201).json({ data: organization });
}

async function listOrganizationMembersController(request, response) {
  response.json({
    data: await organizationService.listMembers({
      userId: request.auth.userId,
      organizationId: request.params.id
    })
  });
}

async function updateOrganizationMemberRoleController(request, response) {
  const input = organizationRoleSchema.parse(request.body || {});
  response.json({
    data: await organizationService.updateMemberRole({
      userId: request.auth.userId,
      actorId: request.auth.actorId,
      organizationId: request.params.id,
      memberUserId: request.params.userId,
      role: input.role
    })
  });
}

async function removeOrganizationMemberController(request, response) {
  response.json({
    data: await organizationService.removeMember({
      userId: request.auth.userId,
      actorId: request.auth.actorId,
      organizationId: request.params.id,
      memberUserId: request.params.userId
    })
  });
}

async function createOrganizationInvitationController(request, response) {
  const input = organizationInvitationSchema.parse(request.body || {});
  const result = await organizationService.createInvitation({
    userId: request.auth.userId,
    actorId: request.auth.actorId,
    organizationId: request.params.id,
    ...input
  });
  response.status(201).json({ data: result });
}

async function listOrganizationInvitationsController(request, response) {
  response.json({
    data: await organizationService.listInvitations({
      userId: request.auth.userId,
      organizationId: request.params.id
    })
  });
}

async function revokeOrganizationInvitationController(request, response) {
  response.json({
    data: await organizationService.revokeInvitation({
      userId: request.auth.userId,
      actorId: request.auth.actorId,
      organizationId: request.params.id,
      invitationId: request.params.invitationId
    })
  });
}

async function acceptOrganizationInvitationController(request, response) {
  const input = organizationInvitationAcceptSchema.parse(request.body || {});
  response.json({
    data: await organizationService.acceptInvitation({
      userId: request.auth.userId,
      actorId: request.auth.actorId,
      token: input.token
    })
  });
}

module.exports = {
  createOrganizationController,
  createOrganizationInvitationController,
  acceptOrganizationInvitationController,
  listOrganizationInvitationsController,
  listOrganizationMembersController,
  removeOrganizationMemberController,
  revokeOrganizationInvitationController,
  updateOrganizationMemberRoleController
};
