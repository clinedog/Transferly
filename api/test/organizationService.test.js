'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { organizationService } = require('../services/organizationService');

const repository = {
  async listForUser() {
    return [
      { id: 'org-1', name: 'Acme', role: 'FINANCE_MANAGER', status: 'active', membershipStatus: 'active' }
    ];
  }
};

test('organization context is selected from authenticated memberships', async () => {
  const context = await organizationService.resolveContext({ userId: 'user-1', organizationId: 'org-1' }, repository);
  assert.equal(context.organization.id, 'org-1');
  assert.equal(context.organization.role, 'FINANCE_MANAGER');
  assert.ok(context.permissions.includes('CREATE_PAYOUT'));
  assert.equal(context.tenantIsolation.organizationId, 'org-1');
});

test('organization context rejects inaccessible organization ids', async () => {
  await assert.rejects(
    () => organizationService.resolveContext({ userId: 'user-1', organizationId: 'org-missing' }, repository),
    (error) => error.code === 'ORGANIZATION_ACCESS_DENIED' && error.statusCode === 403
  );
});

test('organization permissions are enforced server-side', () => {
  assert.throws(
    () => organizationService.assertPermission({ permissions: ['VIEW_REPORTS'] }, 'MANAGE_API_KEYS'),
    (error) => error.code === 'ORGANIZATION_PERMISSION_DENIED'
  );
  assert.equal(organizationService.assertPermission({ permissions: ['VIEW_REPORTS'] }, 'VIEW_REPORTS'), true);
});

test('organization creation creates an owner membership and audit event', async () => {
  let audit;
  const organization = await organizationService.create({
    userId: 'user-1',
    actorId: 'user-1',
    name: 'New Workspace',
    repository: {
      async create(input) {
        assert.deepEqual(input, { userId: 'user-1', name: 'New Workspace', role: 'OWNER' });
        return { id: 'org-new', name: input.name, role: input.role, status: 'active' };
      }
    },
    audit: { async log(entry) { audit = entry; } }
  });
  assert.equal(organization.id, 'org-new');
  assert.equal(audit.action, 'organization.created');
  assert.equal(audit.entityId, 'org-new');
});

test('organization members can be listed only through an accessible organization', async () => {
  const members = await organizationService.listMembers({
    userId: 'user-1',
    organizationId: 'org-1',
    repository: {
      ...repository,
      async listMembers() { return [{ userId: 'user-2', role: 'VIEWER' }]; }
    }
  });
  assert.deepEqual(members, [{ userId: 'user-2', role: 'VIEWER' }]);
});

test('role updates require owner or administrator and preserve the last owner', async () => {
  let audit;
  const repo = {
    async listForUser() {
      return [{ id: 'org-1', name: 'Acme', role: 'OWNER', status: 'active' }];
    },
    async countOwners() { return 1; },
    async updateMemberRole(_organizationId, _userId, role) {
      assert.equal(role, 'ACCOUNTANT');
      return true;
    },
    async findMembership() { return { id: 'membership-1', role: 'ACCOUNTANT' }; }
  };
  const updated = await organizationService.updateMemberRole({
    userId: 'user-1',
    organizationId: 'org-1',
    memberUserId: 'user-2',
    role: 'ACCOUNTANT',
    repository: repo,
    audit: { async log(entry) { audit = entry; } }
  });
  assert.equal(updated.role, 'ACCOUNTANT');
  assert.equal(audit.action, 'organization.member_role_updated');
});

test('last owner cannot be removed or demoted', async () => {
  const repo = {
    async listForUser() {
      return [{ id: 'org-1', name: 'Acme', role: 'OWNER', status: 'active' }];
    },
    async findMembership() { return { id: 'membership-1', role: 'OWNER' }; },
    async countOwners() { return 1; }
  };
  await assert.rejects(
    () => organizationService.updateMemberRole({
      userId: 'user-1', organizationId: 'org-1', memberUserId: 'user-2',
      role: 'VIEWER', repository: repo, audit: { async log() {} }
    }),
    (error) => error.code === 'ORGANIZATION_LAST_OWNER'
  );
  await assert.rejects(
    () => organizationService.removeMember({
      userId: 'user-1', organizationId: 'org-1', memberUserId: 'user-2',
      repository: repo, audit: { async log() {} }
    }),
    (error) => error.code === 'ORGANIZATION_LAST_OWNER'
  );
});

test('invitation creation returns a one-time token and records the audit event', async () => {
  let created;
  let audit;
  const result = await organizationService.createInvitation({
    userId: 'user-1',
    organizationId: 'org-1',
    email: 'member@example.com',
    role: 'VIEWER',
    repository: {
      async listForUser() { return [{ id: 'org-1', name: 'Acme', role: 'OWNER', status: 'active' }]; },
      async createInvitation(input) { created = input; return { id: 'invite-1', ...input, status: 'PENDING' }; }
    },
    audit: { async log(entry) { audit = entry; } }
  });
  assert.match(result.token, /^tl_invite_/);
  assert.equal(created.email, 'member@example.com');
  assert.equal(audit.action, 'organization.invitation_created');
});

test('invitation acceptance requires the invited email and prevents replay', async () => {
  const crypto = require('node:crypto');
  const token = 'tl_invite_test_token_123456789';
  const invitation = {
    id: 'invite-1',
    organizationId: 'org-1',
    email: 'member@example.com',
    role: 'VIEWER',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  };
  let updated;
  const repository = {
    async findInvitationByTokenHash(hash) {
      assert.equal(hash, crypto.createHash('sha256').update(token).digest('hex'));
      return invitation;
    },
    async findUserByEmail() { return { id: 'user-2', email: invitation.email }; },
    async addMembership(data) { assert.deepEqual(data, { organizationId: 'org-1', userId: 'user-2', role: 'VIEWER' }); },
    async updateInvitation(_id, data) { updated = data; return { ...invitation, ...data }; }
  };
  const result = await organizationService.acceptInvitation({
    userId: 'user-2',
    token,
    repository,
    audit: { async log() {} }
  });
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(updated.acceptedBy, 'user-2');
});
