const STATUS_ALIASES = {
  'action_required': 'requires_action',
  'action required': 'requires_action',
  'requires_action': 'requires_action',
  'requires user action': 'requires_action',
  'requires_user_action': 'requires_action',
  'manual review': 'requires_action',
  'manual_review': 'requires_action',
  'needs attention': 'requires_action',
  'needs_attention': 'requires_action',
  'requiring_attention': 'requires_action',

  'reconciliation required': 'reconciliation_required',
  'reconciliation_required': 'reconciliation_required',
  'reconciliation': 'reconciliation',
  'reconciling': 'reconciling',
  'unknown': 'unknown',
  'state_unknown': 'unknown',
  'state unknown': 'unknown',

  'payment instructions': 'payment_instructions',
  'payment_instructions': 'payment_instructions',
  'payment instruction': 'payment_instructions',
  'needs more information': 'needs_more_information',
  'needs_more_information': 'needs_more_information',
  'needs information': 'needs_more_information',
  'under review': 'under_review',
  'under_review': 'under_review',
  'payment reported': 'payment_reported',
  'payment_reported': 'payment_reported',
  'points credited': 'points_credited',
  'points_credited': 'points_credited',
  'coming soon': 'coming_soon',
  'coming_soon': 'coming_soon',
  'comingsoon': 'coming_soon',
};

export function normalizeStatus(status) {
  if (status === null || status === undefined || status === '') {
    return 'pending';
  }

  const compact = String(status)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (!compact) {
    return 'pending';
  }

  return STATUS_ALIASES[compact] || compact;
}

export function requiresReconciliationUI(status) {
  const normalized = normalizeStatus(status);
  return ['unknown', 'reconciling', 'reconciliation_required'].includes(normalized);
}

export function isActionRequiredState(status) {
  const normalized = normalizeStatus(status);
  return normalized === 'requires_action';
}
