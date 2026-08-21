export const SERVICE_STATUS_VALUES = Object.freeze([
  'draft',
  'preview',
  'sandbox',
  'active',
  'maintenance',
  'disabled'
]);

export const AVAILABLE_SERVICE_STATUSES = Object.freeze(['active', 'sandbox']);

export const SANDBOX_REQUIRED_MARKINGS = Object.freeze([
  'SANDBOX / TEST',
  'TEST DATA ONLY',
  'NOT PROOF OF PAYMENT'
]);

export const SERVICE_CATALOGUE_POLICY = Object.freeze([
  { slug: 'transaction-record', title: 'Verified Transaction Record', category: 'Transaction Records', badge: 'Verified', status: 'active' },
  { slug: 'opay', title: 'Opay', category: 'Legacy Wallet Records', badge: 'Disabled', status: 'disabled' },
  { slug: 'kuda', title: 'Kuda', category: 'Legacy Wallet Records', badge: 'Disabled', status: 'disabled' },
  { slug: 'palmpay', title: 'Palmpay', category: 'Legacy Wallet Records', badge: 'Disabled', status: 'disabled' },
  { slug: 'paypal', title: 'PayPal', category: 'Payment Providers', badge: 'Live', status: 'active' },
  { slug: 'stripe', title: 'Stripe Connect', category: 'Payment Providers', badge: 'Adapter', status: 'active' },
  { slug: 'wise', title: 'Wise', category: 'Payment Providers', badge: 'Live', status: 'active' },
  { slug: 'paystack', title: 'Paystack', category: 'Payment Providers', badge: 'Adapter', status: 'active' },
  { slug: 'flutterwave', title: 'Flutterwave', category: 'Payment Providers', badge: 'Adapter', status: 'active' },
  { slug: 'crypto', title: 'Crypto Commerce', category: 'Payment Providers', badge: 'Adapter', status: 'active' },
  { slug: 'binance', title: 'Binance', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled' },
  { slug: 'bybit', title: 'Bybit', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled' },
  { slug: 'coinbase', title: 'Coinbase', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled' },
  { slug: 'crypto-com', title: 'Crypto.com', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled' },
  { slug: 'cash-app', title: 'Cash App', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled' },
  { slug: 'zelle', title: 'Zelle', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled' },
  { slug: 'venmo', title: 'Venmo', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled' },
  { slug: 'trust-wallet', title: 'Trust Wallet', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled' },
  { slug: 'gcash', title: 'GCash', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled' },
  { slug: 'crypto-receipts', title: 'Receipt Vault', category: 'Receipt Vault', badge: 'Live', status: 'active' },
  { slug: 'ai-reply', title: 'Support AI Reply', category: 'Featured', badge: 'Live', status: 'active' },
  { slug: 'articles', title: 'Ops Playbooks', category: 'Knowledge Library', badge: 'Live', status: 'active' },
  { slug: 'faker-data', title: 'Sandbox Test Data', category: 'Sandbox Tools', badge: 'Sandbox', status: 'sandbox' },
  { slug: 'support-sites', title: 'Support Desk', category: 'Support Desk', badge: 'Preview', status: 'preview' },
  { slug: 'pass-clone', title: 'Security Center', category: 'Legacy Security Tools', badge: 'Disabled', status: 'disabled' },
  { slug: 'wallet-tracker', title: 'Provider Balance Tracker', category: 'Provider Balance Tracker', badge: 'Preview', status: 'preview' },
  { slug: 'qr-code', title: 'Payment QR', category: 'Payment QR', badge: 'Preview', status: 'preview' },
  { slug: 'link-shortener', title: 'Payment Link Shortener', category: 'Legacy Payment Links', badge: 'Disabled', status: 'disabled' },
  { slug: 'investinnova', title: 'Workflow Templates', category: 'Template Marketplace', badge: 'Preview', status: 'preview' }
]);

export function isServiceAvailable(serviceOrStatus) {
  const status = typeof serviceOrStatus === 'string' ? serviceOrStatus : serviceOrStatus?.status;
  return AVAILABLE_SERVICE_STATUSES.includes(status);
}

export function isServiceLaunchable(service) {
  return Boolean(service?.launchTo) && isServiceAvailable(service);
}

export function getServiceStatusLabel(serviceOrStatus) {
  const status = typeof serviceOrStatus === 'string' ? serviceOrStatus : serviceOrStatus?.status;

  return {
    active: 'Available',
    sandbox: 'Sandbox',
    preview: 'Preview',
    maintenance: 'Maintenance',
    draft: 'Draft',
    disabled: 'Unavailable'
  }[status] || 'Unavailable';
}
