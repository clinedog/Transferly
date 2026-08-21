const TRANSFERLY_STATUS = Object.freeze({
  LIVE: 'live',
  SANDBOX_READY: 'sandbox-ready',
  NEEDS_ENV: 'needs-env',
  NEEDS_WEBHOOK: 'needs-webhook',
  NEEDS_REVIEW: 'needs-review',
  PREVIEW: 'preview',
  DISABLED: 'disabled',
  UNSUPPORTED: 'unsupported'
});

const INVOICE_STATUS_MAP = Object.freeze({
  DRAFT: 'draft',
  SENT: 'pending',
  SCHEDULED: 'pending',
  PAID: 'settled',
  MARKED_AS_PAID: 'settled',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'needs-review',
  PARTIALLY_PAID: 'needs-review'
});

const PAYOUT_STATUS_MAP = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'settled',
  DENIED: 'failed',
  FAILED: 'failed',
  CANCELED: 'cancelled',
  UNCLAIMED: 'needs-review',
  RETURNED: 'needs-review',
  ONHOLD: 'needs-review',
  BLOCKED: 'needs-review',
  REFUNDED: 'refunded',
  REVERSED: 'needs-review'
});

const PAYMENT_STATUS_MAP = Object.freeze({
  CREATED: 'pending',
  SAVED: 'pending',
  APPROVED: 'pending',
  VOIDED: 'cancelled',
  COMPLETED: 'settled',
  PAYER_ACTION_REQUIRED: 'needs-review',
  DECLINED: 'failed',
  PARTIALLY_REFUNDED: 'needs-review',
  REFUNDED: 'refunded',
  DENIED: 'failed',
  EXPIRED: 'cancelled'
});

const ORDER_STATUS_MAP = Object.freeze({
  CREATED: 'pending',
  SAVED: 'pending',
  APPROVED: 'approved',
  VOIDED: 'cancelled',
  COMPLETED: 'settled',
  PAYER_ACTION_REQUIRED: 'needs-review'
});

const DISPUTE_STATUS_MAP = Object.freeze({
  OPEN: 'needs-review',
  WAITING_FOR_BUYER_RESPONSE: 'needs-review',
  WAITING_FOR_SELLER_RESPONSE: 'needs-review',
  UNDER_REVIEW: 'needs-review',
  RESOLVED: 'settled',
  OTHER: 'needs-review'
});

const SUBSCRIPTION_STATUS_MAP = Object.freeze({
  APPROVAL_PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'live',
  SUSPENDED: 'needs-review',
  CANCELLED: 'cancelled',
  EXPIRED: 'disabled'
});

function normalizeProviderStatus(status, mapping, fallback = 'unknown') {
  const key = String(status || '').trim().toUpperCase();
  return mapping[key] || fallback;
}

function mapPayPalInvoiceStatus(status) {
  return normalizeProviderStatus(status, INVOICE_STATUS_MAP);
}

function mapPayPalPayoutStatus(status) {
  return normalizeProviderStatus(status, PAYOUT_STATUS_MAP);
}

function mapPayPalPaymentStatus(status) {
  return normalizeProviderStatus(status, PAYMENT_STATUS_MAP);
}

function mapPayPalOrderStatus(status) {
  return normalizeProviderStatus(status, ORDER_STATUS_MAP);
}

function mapPayPalDisputeStatus(status) {
  return normalizeProviderStatus(status, DISPUTE_STATUS_MAP);
}

function mapPayPalSubscriptionStatus(status) {
  return normalizeProviderStatus(status, SUBSCRIPTION_STATUS_MAP);
}

module.exports = {
  TRANSFERLY_STATUS,
  mapPayPalDisputeStatus,
  mapPayPalInvoiceStatus,
  mapPayPalOrderStatus,
  mapPayPalPaymentStatus,
  mapPayPalPayoutStatus,
  mapPayPalSubscriptionStatus,
  normalizeProviderStatus
};
