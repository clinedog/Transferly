import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentPath = new URL('../src/components/OrganizationTeamSection.jsx', import.meta.url);
const suitePath = new URL('../src/components/MiniAppFinanceSuite.jsx', import.meta.url);
const apiPath = new URL('../src/lib/api.js', import.meta.url);

test('organization team UI covers members, roles, invitations, and removal', async () => {
  const source = await readFile(componentPath, 'utf8');
  assert.match(source, /listMyOrganizationMembers/);
  assert.match(source, /updateMyOrganizationMemberRole/);
  assert.match(source, /removeMyOrganizationMember/);
  assert.match(source, /createMyOrganizationInvitation/);
  assert.match(source, /revokeMyOrganizationInvitation/);
  assert.match(source, /OWNER.*ADMINISTRATOR/);
});

test('security surface includes the organization team controls', async () => {
  const source = await readFile(suitePath, 'utf8');
  assert.match(source, /<OrganizationTeamSection \/>/);
});

test('organization team API helpers remain available', async () => {
  const source = await readFile(apiPath, 'utf8');
  assert.match(source, /export function listMyOrganizationMembers/);
  assert.match(source, /export function createMyOrganizationInvitation/);
  assert.match(source, /export function acceptMyOrganizationInvitation/);
});
