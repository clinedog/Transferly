'use strict';

const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { organizationRepository } = require('../repositories/organizationRepository');
const { auditLogService } = require('./auditLogService');
const { AppError } = require('../utils/errors');

const ROLE_PERMISSIONS = Object.freeze({
  OWNER: ['VIEW_TRANSACTIONS', 'CREATE_PAYMENT', 'CREATE_INVOICE', 'CREATE_PAYOUT', 'APPROVE_PAYOUT', 'MANAGE_PROVIDERS', 'MANAGE_USERS', 'MANAGE_API_KEYS', 'VIEW_REPORTS', 'MANAGE_AUTOMATIONS', 'MANAGE_SECURITY', 'MANAGE_SETTINGS'],
  ADMINISTRATOR: ['VIEW_TRANSACTIONS', 'CREATE_PAYMENT', 'CREATE_INVOICE', 'CREATE_PAYOUT', 'APPROVE_PAYOUT', 'MANAGE_PROVIDERS', 'MANAGE_USERS', 'MANAGE_API_KEYS', 'VIEW_REPORTS', 'MANAGE_AUTOMATIONS', 'MANAGE_SECURITY'],
  FINANCE_MANAGER: ['VIEW_TRANSACTIONS', 'CREATE_PAYMENT', 'CREATE_INVOICE', 'CREATE_PAYOUT', 'APPROVE_PAYOUT', 'VIEW_REPORTS'],
  OPERATIONS: ['VIEW_TRANSACTIONS', 'CREATE_PAYMENT', 'CREATE_INVOICE', 'VIEW_REPORTS'],
  ACCOUNTANT: ['VIEW_TRANSACTIONS', 'VIEW_REPORTS'],
  VIEWER: ['VIEW_TRANSACTIONS', 'VIEW_REPORTS']
});

async function listForUser(userId, repository = organizationRepository) {
  return repository.listForUser(userId);
}

async function create({
  userId,
  actorId = userId,
  name,
  repository = organizationRepository,
  audit = auditLogService
}) {
  const organization = await repository.create({ userId, name, role: 'OWNER' });
  await audit.log({
    actorType: 'user',
    actorId,
    action: 'organization.created',
    entityType: 'organization',
    entityId: organization.id,
    metadata: { role: organization.role }
  });
  return organization;
}

async function resolveContext({ userId, organizationId }, repository = organizationRepository) {
  const organizations = await repository.listForUser(userId);
  const selected = organizationId
    ? organizations.find((organization) => organization.id === organizationId)
    : organizations[0];
  if (!selected) {
    throw new AppError(403, 'ORGANIZATION_ACCESS_DENIED', 'You do not have access to this organization.');
  }
  return {
    organization: selected,
    permissions: [...(ROLE_PERMISSIONS[selected.role] || [])],
    tenantIsolation: { enforcedBy: 'organization-membership', userId, organizationId: selected.id }
  };
}

async function listMembers({ userId, organizationId, repository = organizationRepository }) {
  await resolveContext({ userId, organizationId }, repository);
  return repository.listMembers(organizationId);
}

async function updateMemberRole({
  userId,
  actorId = userId,
  organizationId,
  memberUserId,
  role,
  repository = organizationRepository,
  audit = auditLogService
}) {
  const context = await resolveContext({ userId, organizationId }, repository);
  if (!['OWNER', 'ADMINISTRATOR'].includes(context.organization.role)) {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', 'Only organization owners and administrators can manage members.');
  }
  if (memberUserId === userId && context.organization.role !== 'OWNER') {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', 'Administrators cannot change their own role.');
  }
  if (role === 'OWNER' && context.organization.role !== 'OWNER') {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', 'Only the organization owner can assign ownership.');
  }
  const target = await repository.findMembership(memberUserId, organizationId);
  if (!target) throw new AppError(404, 'ORGANIZATION_MEMBER_NOT_FOUND', 'Organization member not found.');
  if (target.role === 'OWNER' && role !== 'OWNER' && await repository.countOwners(organizationId) <= 1) {
    throw new AppError(409, 'ORGANIZATION_LAST_OWNER', 'An organization must retain at least one owner.');
  }
  const updated = await repository.updateMemberRole(organizationId, memberUserId, role);
  if (!updated) throw new AppError(404, 'ORGANIZATION_MEMBER_NOT_FOUND', 'Organization member not found.');
  await audit.log({
    actorType: 'user',
    actorId,
    action: 'organization.member_role_updated',
    entityType: 'organization_membership',
    entityId: target.id,
    metadata: { organizationId, memberUserId, fromRole: target.role, toRole: role }
  });
  return repository.findMembership(memberUserId, organizationId);
}

async function removeMember({
  userId,
  actorId = userId,
  organizationId,
  memberUserId,
  repository = organizationRepository,
  audit = auditLogService
}) {
  const context = await resolveContext({ userId, organizationId }, repository);
  if (!['OWNER', 'ADMINISTRATOR'].includes(context.organization.role)) {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', 'Only organization owners and administrators can manage members.');
  }

  const target = await repository.findMembership(memberUserId, organizationId);
  if (!target) throw new AppError(404, 'ORGANIZATION_MEMBER_NOT_FOUND', 'Organization member not found.');
  if (target.role === 'OWNER' && await repository.countOwners(organizationId) <= 1) {
    throw new AppError(409, 'ORGANIZATION_LAST_OWNER', 'An organization must retain at least one owner.');
  }
  if (target.role === 'OWNER' && context.organization.role !== 'OWNER') {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', 'Only the organization owner can remove an owner.');
  }
  const removed = await repository.removeMember(organizationId, memberUserId);
  if (!removed) throw new AppError(404, 'ORGANIZATION_MEMBER_NOT_FOUND', 'Organization member not found.');
  await audit.log({
    actorType: 'user',
    actorId,
    action: 'organization.member_removed',
    entityType: 'organization_membership',
    entityId: target.id,
    metadata: { organizationId, memberUserId, role: target.role }
  });
  return { removed: true, organizationId, memberUserId };
}

async function createInvitation({
  userId, actorId = userId, organizationId, email, role, expiresInDays = 7,
  repository = organizationRepository, audit = auditLogService
}) {
  const context = await resolveContext({ userId, organizationId }, repository);
  if (!['OWNER', 'ADMINISTRATOR'].includes(context.organization.role)) {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', 'Only owners and administrators can invite members.');
  }
  if (role === 'ADMINISTRATOR' && context.organization.role !== 'OWNER') {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', 'Only the owner can invite administrators.');
  }
  const token = `tl_invite_${randomBytes(24).toString('base64url')}`;
  const invitation = await repository.createInvitation({
    id: randomUUID(), organizationId, email: email.toLowerCase(), role,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    invitedBy: userId,
    expiresAt: new Date(Date.now() + expiresInDays * 86400000).toISOString()
  });
  await audit.log({ actorType: 'user', actorId, action: 'organization.invitation_created', entityType: 'organization_invitation', entityId: invitation.id, metadata: { organizationId, email: invitation.email, role } });
  return { ...invitation, token };
}

async function listInvitations({ userId, organizationId, repository = organizationRepository }) {
  const context = await resolveContext({ userId, organizationId }, repository);
  if (!['OWNER', 'ADMINISTRATOR'].includes(context.organization.role)) {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', 'Only owners and administrators can view invitations.');
  }
  return repository.listInvitations(organizationId);
}

async function revokeInvitation({ userId, actorId = userId, organizationId, invitationId, repository = organizationRepository, audit = auditLogService }) {
  const context = await resolveContext({ userId, organizationId }, repository);
  if (!['OWNER', 'ADMINISTRATOR'].includes(context.organization.role)) {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', 'Only owners and administrators can revoke invitations.');
  }
  const invitation = (await repository.listInvitations(organizationId)).find((item) => item.id === invitationId);
  if (!invitation) throw new AppError(404, 'ORGANIZATION_INVITATION_NOT_FOUND', 'Invitation not found.');
  if (invitation.status !== 'PENDING') throw new AppError(409, 'ORGANIZATION_INVITATION_USED', 'Invitation is no longer active.');
  const revoked = await repository.updateInvitation(invitationId, { status: 'REVOKED' });
  await audit.log({ actorType: 'user', actorId, action: 'organization.invitation_revoked', entityType: 'organization_invitation', entityId: invitationId, metadata: { organizationId } });
  return revoked;
}

async function acceptInvitation({ userId, actorId = userId, token, repository = organizationRepository, audit = auditLogService }) {
  const tokenHash = createHash('sha256').update(String(token || '')).digest('hex');
  const invitation = await repository.findInvitationByTokenHash(tokenHash);
  if (!invitation) throw new AppError(404, 'ORGANIZATION_INVITATION_NOT_FOUND', 'Invitation not found.');
  if (invitation.status !== 'PENDING') throw new AppError(409, 'ORGANIZATION_INVITATION_USED', 'Invitation is no longer active.');
  if (Date.parse(invitation.expiresAt) <= Date.now()) {
    await repository.updateInvitation(invitation.id, { status: 'EXPIRED' });
    throw new AppError(410, 'ORGANIZATION_INVITATION_EXPIRED', 'Invitation has expired.');
  }
  const user = await repository.findUserByEmail(invitation.email);
  if (!user || user.id !== userId) throw new AppError(403, 'ORGANIZATION_INVITATION_EMAIL_MISMATCH', 'This invitation belongs to a different account.');
  await repository.addMembership({ organizationId: invitation.organizationId, userId, role: invitation.role });
  const accepted = await repository.updateInvitation(invitation.id, { status: 'ACCEPTED', acceptedBy: userId, acceptedAt: new Date().toISOString() });
  await audit.log({ actorType: 'user', actorId, action: 'organization.invitation_accepted', entityType: 'organization_invitation', entityId: invitation.id, metadata: { organizationId: invitation.organizationId, role: invitation.role } });
  return accepted;
}

function assertPermission(context, permission) {
  if (!context?.permissions?.includes(permission)) {
    throw new AppError(403, 'ORGANIZATION_PERMISSION_DENIED', `Organization permission required: ${permission}.`);
  }
  return true;
}

module.exports = {
  organizationService: {
    assertPermission,
    create,
    createInvitation,
    acceptInvitation,
    listForUser,
    listInvitations,
    revokeInvitation,
    listMembers,
    removeMember,
    resolveContext,
    updateMemberRole,
    ROLE_PERMISSIONS
  }
};
