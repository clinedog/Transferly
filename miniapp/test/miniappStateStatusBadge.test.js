import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStatus, requiresReconciliationUI } from '../src/lib/statusNormalization.js';

test('normalizeStatus canonicalizes common financial aliases', () => {
  assert.equal(normalizeStatus('Action Required'), 'requires_action');
  assert.equal(normalizeStatus('RECONCILIATION REQUIRED'), 'reconciliation_required');
  assert.equal(normalizeStatus('Payment Instructions'), 'payment_instructions');
  assert.equal(normalizeStatus('Needs more information'), 'needs_more_information');
  assert.equal(normalizeStatus('points credited'), 'points_credited');
  assert.equal(normalizeStatus('coming soon'), 'coming_soon');
  assert.equal(normalizeStatus(undefined), 'pending');
});

test('requiresReconciliationUI flags unknown and reconciliation states without hiding them', () => {
  assert.equal(requiresReconciliationUI('UNKNOWN'), true);
  assert.equal(requiresReconciliationUI('Reconciliation Required'), true);
  assert.equal(requiresReconciliationUI('Action Required'), false);
  assert.equal(requiresReconciliationUI('Succeeded'), false);
});
