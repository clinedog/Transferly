import test from 'node:test';
import assert from 'node:assert/strict';
import { getProviderManifest } from '../src/lib/providerManifests.js';
import {
  getRuntimeLaneCapability,
  isProviderOperationImplemented,
  mergeProviderManifestCapability,
  normalizeProviderCapability
} from '../src/lib/providerWorkspaceContract.js';

test('normalizes provider capability identifiers and lane records', () => {
  const capability = normalizeProviderCapability({ id: ' Stripe ', lanes: [{ id: 'payments' }] });
  assert.equal(capability.slug, 'stripe');
  assert.deepEqual(capability.lanes, [{ id: 'payments' }]);
});

test('filters disabled and unsupported runtime lanes while preserving preview lanes', () => {
  const manifest = getProviderManifest('stripe');
  const merged = mergeProviderManifestCapability(manifest, {
    slug: 'stripe',
    display_name: 'Stripe Runtime',
    capabilities: ['Payments'],
    lanes: [
      { id: 'overview', status: 'live' },
      { id: 'payments', status: 'preview', command_label: 'Collect', summary: 'Preview payments' },
      { id: 'connect', status: 'unsupported' },
      { id: 'wallet', status: 'disabled' }
    ]
  });
  assert.equal(merged.displayName, 'Stripe Runtime');
  assert.deepEqual(merged.supportedLanes, ['overview', 'payments']);
  assert.equal(merged.lanes[1].shortLabel, 'Collect');
  assert.equal(merged.lanes[1].runtimeStatus, 'preview');
});

test('falls back to static manifest when capability data is unavailable or mismatched', () => {
  const manifest = getProviderManifest('paypal');
  assert.equal(mergeProviderManifestCapability(manifest, null), manifest);
  assert.equal(mergeProviderManifestCapability(manifest, { slug: 'stripe', lanes: [] }), manifest);
});

test('distinguishes executable operation statuses from setup and unsupported states', () => {
  assert.equal(isProviderOperationImplemented('live'), true);
  assert.equal(isProviderOperationImplemented('sandbox-ready'), true);
  assert.equal(isProviderOperationImplemented('preview'), true);
  assert.equal(isProviderOperationImplemented('needs-env'), false);
  assert.equal(isProviderOperationImplemented('unsupported'), false);
});

test('reads the runtime lane capability without inferring unsupported lanes', () => {
  const capability = { slug: 'paypal', lanes: [{ id: 'payouts', status: 'needs-env' }] };
  assert.deepEqual(getRuntimeLaneCapability(capability, 'payouts'), capability.lanes[0]);
  assert.equal(getRuntimeLaneCapability(capability, 'invoices'), null);
});
