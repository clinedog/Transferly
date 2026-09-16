import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appContextPath = new URL('../src/context/AppContext.jsx', import.meta.url);
const apiPath = new URL('../src/lib/api.js', import.meta.url);
const shellPath = new URL('../src/components/MiniAppShell.jsx', import.meta.url);

test('organization context persists only the selected organization id', async () => {
  const source = await readFile(appContextPath, 'utf8');
  assert.match(source, /transferly\.selected-organization-id/);
  assert.match(source, /getMyOrganizationContext/);
  assert.match(source, /window\.localStorage\.setItem\(ORGANIZATION_PREFERENCE_KEY/);
});

test('API requests propagate selected organization context', async () => {
  const source = await readFile(apiPath, 'utf8');
  assert.match(source, /X-Organization-Id/);
  assert.match(source, /getSelectedOrganizationId/);
});

test('the shell exposes a labeled organization switcher for multi-organization users', async () => {
  const source = await readFile(shellPath, 'utf8');
  assert.match(source, /miniapp-organization-switcher/);
  assert.match(source, /aria-label="Switch organization"/);
  assert.match(source, /organizations\?\.length > 1/);
});
