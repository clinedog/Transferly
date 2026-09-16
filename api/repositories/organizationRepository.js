'use strict';

const { randomUUID } = require('node:crypto');
const { db } = require('../db');

function mapInvitation(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    expiresAt: row.expires_at,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function map(row) {
  if (!row) return null;
  return {
    id: row.organization_id || row.id,
    name: row.name,
    status: row.organization_status || row.status,
    role: row.role,
    membershipStatus: row.membership_status || row.membershipStatus || null,
    createdAt: row.organization_created_at || row.created_at,
    updatedAt: row.organization_updated_at || row.updated_at
  };
}

async function listForUser(userId, client = db) {
  const rows = await client.all(
    `SELECT o.id AS organization_id, o.name, o.status AS organization_status,
            o.created_at AS organization_created_at, o.updated_at AS organization_updated_at,
            m.role, m.status AS membership_status
       FROM organizations o
       JOIN organization_memberships m ON m.organization_id = o.id
      WHERE m.user_id = ? AND m.status = 'active'
      ORDER BY o.created_at ASC`,
    [userId]
  );
  return rows.map(map);
}

async function findMembership(userId, organizationId, client = db) {
  return map(await client.get(
    `SELECT o.id AS organization_id, o.name, o.status AS organization_status,
            o.created_at AS organization_created_at, o.updated_at AS organization_updated_at,
            m.role, m.status AS membership_status
       FROM organizations o
       JOIN organization_memberships m ON m.organization_id = o.id
      WHERE m.user_id = ? AND m.organization_id = ? AND m.status = 'active'`,
    [userId, organizationId]
  ));
}

async function create({ userId, name, role = 'OWNER' }, client = db) {
  const now = new Date().toISOString();
  const id = randomUUID();
  await client.run(
    `INSERT INTO organizations (id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, name, userId, now, now]
  );
  await client.run(
    `INSERT INTO organization_memberships (id, organization_id, user_id, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), id, userId, role, now, now]
  );
  return findMembership(userId, id, client);
}

async function listMembers(organizationId, client = db) {
  const rows = await client.all(
    `SELECT m.id AS membership_id, m.user_id, m.role, m.status AS membership_status,
            m.created_at AS membership_created_at, m.updated_at AS membership_updated_at,
            u.email, u.display_name, u.status AS user_status
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = ? AND m.status = 'active'
      ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'ADMINISTRATOR' THEN 1 ELSE 2 END, m.created_at ASC`,
    [organizationId]
  );
  return rows.map((row) => ({
    id: row.membership_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    userStatus: row.user_status,
    role: row.role,
    status: row.membership_status,
    createdAt: row.membership_created_at,
    updatedAt: row.membership_updated_at
  }));
}

async function updateMemberRole(organizationId, userId, role, client = db) {
  const result = await client.run(
    `UPDATE organization_memberships
        SET role = ?, updated_at = ?
      WHERE organization_id = ? AND user_id = ? AND status = 'active'`,
    [role, new Date().toISOString(), organizationId, userId]
  );
  return result.changes === 1;
}

async function countOwners(organizationId, client = db) {
  const row = await client.get(
    `SELECT COUNT(*) AS count FROM organization_memberships
      WHERE organization_id = ? AND role = 'OWNER' AND status = 'active'`,
    [organizationId]
  );
  return Number(row?.count || 0);
}

async function removeMember(organizationId, userId, client = db) {
  const result = await client.run(
    `UPDATE organization_memberships
        SET status = 'removed', updated_at = ?
      WHERE organization_id = ? AND user_id = ? AND status = 'active'`,
    [new Date().toISOString(), organizationId, userId]
  );
  return result.changes === 1;
}

async function createInvitation(data, client = db) {
  const now = new Date().toISOString();
  await client.run(
    `INSERT INTO organization_invitations
      (id, organization_id, email, role, token_hash, status, invited_by, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
    [data.id, data.organizationId, data.email, data.role, data.tokenHash, data.invitedBy, data.expiresAt, now, now]
  );
  return mapInvitation(await client.get('SELECT * FROM organization_invitations WHERE id = ?', [data.id]));
}

async function listInvitations(organizationId, client = db) {
  return (await client.all(
    `SELECT * FROM organization_invitations WHERE organization_id = ? ORDER BY created_at DESC`,
    [organizationId]
  )).map(mapInvitation);
}

async function findInvitationByTokenHash(tokenHash, client = db) {
  return mapInvitation(await client.get(
    'SELECT * FROM organization_invitations WHERE token_hash = ?',
    [tokenHash]
  ));
}

async function updateInvitation(id, data, client = db) {
  const fields = [];
  const values = [];
  for (const field of ['status', 'acceptedBy', 'acceptedAt']) {
    if (data[field] !== undefined) {
      fields.push(`${field === 'acceptedBy' ? 'accepted_by' : field === 'acceptedAt' ? 'accepted_at' : 'status'} = ?`);
      values.push(data[field]);
    }
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  await client.run(`UPDATE organization_invitations SET ${fields.join(', ')} WHERE id = ?`, values);
  return mapInvitation(await client.get('SELECT * FROM organization_invitations WHERE id = ?', [id]));
}

async function findUserByEmail(email, client = db) {
  return client.get('SELECT id, email FROM users WHERE lower(email) = lower(?)', [email]);
}

async function addMembership({ organizationId, userId, role }, client = db) {
  const now = new Date().toISOString();
  await client.run(
    `INSERT INTO organization_memberships
      (id, organization_id, user_id, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)
     ON CONFLICT(organization_id, user_id) DO UPDATE SET role = excluded.role, status = 'active', updated_at = excluded.updated_at`,
    [randomUUID(), organizationId, userId, role, now, now]
  );
}

module.exports = {
  organizationRepository: {
    countOwners,
    addMembership,
    create,
    createInvitation,
    findMembership,
    findInvitationByTokenHash,
    findUserByEmail,
    listInvitations,
    listForUser,
    listMembers,
    removeMember,
    updateMemberRole,
    updateInvitation
  }
};
