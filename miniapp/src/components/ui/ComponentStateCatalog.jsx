/**
 * Component State Catalog
 * 
 * Every UI component in Transferly Mini App must support these state classes.
 * This ensures consistent, predictable UX across the entire platform.
 * 
 * State Classification:
 * - LOADING: Data or action in progress
 * - EMPTY: No data available
 * - SUCCESS: Operation completed successfully
 * - ERROR: Operation failed
 * - RETRY: User can retry after failure
 * - UNKNOWN: Financial state not yet confirmed
 * - RECONCILIATION_REQUIRED: Provider outcome needs review
 * - SESSION_EXPIRED: Auth session no longer valid
 * - RATE_LIMITED: Too many requests
 * - PERMISSION_DENIED: User lacks access
 * - COMING_SOON: Feature not yet available
 * - SANDBOX: Running in sandbox/test mode
 * - PROCESSING: Provider processing underway
 * - UNAVAILABLE: Service temporarily down
 * 
 * Every page should support loading, empty, error, and success states.
 * Financial transaction pages must also support unknown and reconciliation.
 */

export const ComponentStatePattern = {
  // Standard state that all components should support
  ALL_PAGES: ['loading', 'empty', 'error', 'success'],
  
  // Financial operations need explicit unknown/reconciliation handling
  FINANCIAL_PAGES: ['loading', 'empty', 'error', 'success', 'unknown', 'reconciliation'],
  
  // Admin operations need high-risk state handling
  ADMIN_PAGES: ['loading', 'empty', 'error', 'success', 'unknown', 'reconciliation', 'rate_limited', 'permission_denied'],
};

/**
 * Standard component state definitions.
 * Each state defines icon, color tone, title, description.
 * 
 * Usage in components:
 * 
 * function MyComponent({ isLoading, isEmpty, isError, data }) {
 *   if (isLoading) return <MiniAppState tone="loading" {...states.loading} />;
 *   if (isEmpty) return <MiniAppState tone="empty" {...states.empty} />;
 *   if (isError) return <MiniAppState tone="error" {...states.error} />;
 *   return <div>{data}</div>;
 * }
 */
export const StandardComponentStates = {
  // LOADING — Data or action in progress
  loading: {
    tone: 'loading',
    title: 'Loading',
    description: 'Preparing your data...',
    icon: 'Loader2',
    actionLabel: null,
  },

  // EMPTY — No data to display
  empty: {
    tone: 'empty',
    title: 'Nothing here yet',
    description: 'No data available. New activity will appear here as it becomes available.',
    icon: 'AlertCircle',
    actionLabel: null,
  },

  // SUCCESS — Operation completed
  success: {
    tone: 'success',
    title: 'Done',
    description: 'Your action was completed successfully.',
    icon: 'CheckCircle2',
    actionLabel: null,
  },

  // ERROR — Operation failed (recoverable)
  error: {
    tone: 'error',
    title: 'Unable to complete',
    description: 'Something went wrong. Try again or contact support if the problem persists.',
    icon: 'AlertCircle',
    actionLabel: 'Try again',
  },

  // RETRY — User can retry after failure
  retry: {
    tone: 'error',
    title: 'Ready to retry',
    description: 'The previous operation failed. You can try again.',
    icon: 'RotateCcw',
    actionLabel: 'Retry',
  },

  // UNKNOWN — Financial state not yet confirmed by provider
  unknown: {
    tone: 'unknown',
    title: 'State is still unknown',
    description: 'Transferly is waiting on authoritative provider or ledger confirmation. This should resolve within a few minutes.',
    icon: 'AlertTriangle',
    actionLabel: 'Refresh',
  },

  // RECONCILIATION_REQUIRED — Provider outcome needs manual review
  reconciliation: {
    tone: 'reconciling',
    title: 'Reconciliation required',
    description: 'This transaction needs review because the provider outcome is not yet confirmed. A human will review this shortly.',
    icon: 'RefreshCw',
    actionLabel: 'View details',
  },

  // SESSION_EXPIRED — Auth session no longer valid
  sessionExpired: {
    tone: 'auth',
    title: 'Secure session required',
    description: 'Your session has expired. Open Transferly from Telegram again or retry session verification.',
    icon: 'LockKeyhole',
    actionLabel: 'Reconnect',
  },

  // RATE_LIMITED — Too many requests
  rateLimited: {
    tone: 'rate-limited',
    title: 'Too many requests',
    description: 'Wait a moment before retrying this action.',
    icon: 'TimerReset',
    actionLabel: 'Retry in 30s',
  },

  // PERMISSION_DENIED — User lacks access
  permissionDenied: {
    tone: 'forbidden',
    title: 'Access restricted',
    description: 'This operation requires additional Transferly permissions.',
    icon: 'ShieldAlert',
    actionLabel: 'Request access',
  },

  // COMING_SOON — Feature not yet available
  comingSoon: {
    tone: 'provider',
    title: 'Coming soon',
    description: 'This feature is not yet available. Check back later.',
    icon: 'PlugZap',
    actionLabel: null,
  },

  // SANDBOX — Running in test/sandbox mode
  sandbox: {
    tone: 'provider',
    title: 'Sandbox mode',
    description: 'This operation is running in sandbox/test mode. Real funds are not affected.',
    icon: 'PlugZap',
    actionLabel: null,
  },

  // PROCESSING — Provider is processing the operation
  processing: {
    tone: 'processing',
    title: 'Processing',
    description: 'The financial operation is in progress. Transferly is waiting for provider confirmation.',
    icon: 'Loader2',
    actionLabel: null,
  },

  // UNAVAILABLE — Service temporarily down
  unavailable: {
    tone: 'unavailable',
    title: 'Temporarily unavailable',
    description: 'The service is not reachable right now. Retry when the connection recovers.',
    icon: 'ServerCrash',
    actionLabel: 'Retry',
  },

  // OFFLINE — Network connection lost
  offline: {
    tone: 'offline',
    title: 'You appear offline',
    description: 'Transferly will reconnect when your network is available again.',
    icon: 'WifiOff',
    actionLabel: null,
  },
};

/**
 * Financial Transaction State Machine
 * 
 * Every financial transaction progresses through explicit states:
 * 
 *   REQUESTED
 *     ↓
 *   VALIDATING → (fails) → ERROR
 *     ↓
 *   QUOTED → (expires) → EXPIRED
 *     ↓
 *   AUTHORIZED
 *     ↓
 *   RESERVED
 *     ↓
 *   PROCESSING → (unknown) → UNKNOWN
 *     ↓
 *   COMPLETED or FAILED
 *     ↓
 *   RECONCILIATION (if provider state unclear)
 * 
 * Never display UNKNOWN as SUCCESS.
 * Never hide RECONCILIATION_REQUIRED.
 * Always log transitions.
 */
export const FinancialTransactionStates = {
  REQUESTED: 'User has initiated the operation',
  VALIDATING: 'Input validation in progress',
  QUOTED: 'Quote provided to user',
  EXPIRED: 'Quote or reservation expired',
  AUTHORIZED: 'User has confirmed operation',
  RESERVED: 'Funds reserved in ledger',
  PROCESSING: 'Provider processing underway',
  UNKNOWN: 'Provider outcome not yet confirmed',
  COMPLETED: 'Operation successful (confirmed)',
  FAILED: 'Operation failed (confirmed)',
  RECONCILIATION: 'Provider state requires manual review',
  CANCELLED: 'User or system cancelled operation',
  REJECTED: 'Risk/compliance rejected operation',
};

/**
 * Status Badge States
 * 
 * All StatusBadge components must support these states.
 * Normalization converts various input formats to canonical lowercase_with_underscores.
 */
export const StatusBadgeStates = {
  // Core states
  UNKNOWN: { label: 'Reconciling', meaning: 'Final state is not confirmed' },
  RECONCILIATION_REQUIRED: { label: 'Reconciliation required', meaning: 'Provider outcome requires review' },
  RECONCILING: { label: 'Reconciling', meaning: 'Reconciliation in progress' },
  REQUIRES_ACTION: { label: 'Action required', meaning: 'Human review needed' },
  REQUIRES_USER_ACTION: { label: 'Action required', meaning: 'Human review needed' },

  // Transaction states
  PENDING: { label: 'Pending', meaning: 'Awaiting confirmation' },
  PROCESSING: { label: 'Processing', meaning: 'In progress' },
  SUCCEEDED: { label: 'Succeeded', meaning: 'Completed successfully' },
  COMPLETED: { label: 'Completed', meaning: 'Completed successfully' },
  FAILED: { label: 'Failed', meaning: 'Operation failed' },

  // Funding states
  PAYMENT_INSTRUCTIONS: { label: 'Awaiting Payment', meaning: 'Make payment to receive points' },
  PAYMENT_REPORTED: { label: 'Under Review', meaning: 'Payment evidence is being verified' },
  UNDER_REVIEW: { label: 'Under Review', meaning: 'Verification in progress' },
  POINTS_CREDITED: { label: 'Credited', meaning: 'Points added to your wallet' },

  // Approval states
  APPROVED: { label: 'Approved', meaning: 'Approved and ready' },
  AUTO_APPROVED: { label: 'Auto-approved', meaning: 'Passed policy checks' },
  REJECTED: { label: 'Rejected', meaning: 'Rejected' },
  REQUESTED: { label: 'Requested', meaning: 'Request received' },

  // Processing states
  SUBMITTED: { label: 'Submitted', meaning: 'Submitted to the provider' },
  RESERVED: { label: 'Reserved', meaning: 'Funds are reserved while processing' },
  RISK_CHECK: { label: 'Risk check', meaning: 'Risk and policy checks in progress' },

  // Terminal states
  CANCELLED: { label: 'Cancelled', meaning: 'Order cancelled' },
  EXPIRED: { label: 'Expired', meaning: 'Order expired' },

  // Draft state
  DRAFT: { label: 'Draft', meaning: 'Not yet submitted' },

  // Operational states
  LIVE: { label: 'Live', meaning: 'Active and working' },
  COMING_SOON: { label: 'Coming Soon', meaning: 'Not yet available' },
};

/**
 * Helper: Normalize status string to canonical form
 * 
 * Handles:
 * - Uppercase → lowercase
 * - Spaces/hyphens → underscores
 * - Unknown values → 'pending'
 * 
 * @param {string|any} status - Input status
 * @returns {string} Normalized status key
 */
export function normalizeStatus(status) {
  if (!status) return 'pending';
  
  return String(status)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .trim();
}

/**
 * Helper: Get standard state config for any component
 * 
 * @param {string} stateName - One of StandardComponentStates keys
 * @returns {object} State config { tone, title, description, icon, actionLabel }
 */
export function getComponentStateConfig(stateName) {
  return StandardComponentStates[stateName] || StandardComponentStates.error;
}

/**
 * Helper: Check if a financial state requires reconciliation UI
 * 
 * @param {string} status - Financial status
 * @returns {boolean} True if reconciliation UI should be shown
 */
export function requiresReconciliationUI(status) {
  const normalized = normalizeStatus(status);
  return ['unknown', 'reconciliation_required', 'reconciling'].includes(normalized);
}

export default {
  ComponentStatePattern,
  StandardComponentStates,
  FinancialTransactionStates,
  StatusBadgeStates,
  normalizeStatus,
  getComponentStateConfig,
  requiresReconciliationUI,
};
