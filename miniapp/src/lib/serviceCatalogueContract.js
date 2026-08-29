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
  { slug: 'transaction-record', title: 'Verified Transaction Record', category: 'Transaction Records', badge: 'Coming Soon', status: 'preview' },
  { slug: 'opay', title: 'Opay', category: 'Legacy Wallet Records', badge: 'Coming Soon', status: 'preview' },
  { slug: 'kuda', title: 'Kuda', category: 'Legacy Wallet Records', badge: 'Coming Soon', status: 'preview' },
  { slug: 'palmpay', title: 'Palmpay', category: 'Legacy Wallet Records', badge: 'Coming Soon', status: 'preview' },
  { slug: 'paypal', title: 'PayPal', category: 'Payment Providers', badge: 'Live', status: 'active' },
  { slug: 'stripe', title: 'Stripe Connect', category: 'Payment Providers', badge: 'Coming Soon', status: 'preview' },
  { slug: 'wise', title: 'Wise', category: 'Payment Providers', badge: 'Coming Soon', status: 'preview' },
  { slug: 'paystack', title: 'Paystack', category: 'Payment Providers', badge: 'Coming Soon', status: 'preview' },
  { slug: 'flutterwave', title: 'Flutterwave', category: 'Payment Providers', badge: 'Coming Soon', status: 'preview' },
  { slug: 'crypto', title: 'Crypto Commerce', category: 'Payment Providers', badge: 'Coming Soon', status: 'preview' },
  { slug: 'binance', title: 'Binance', category: 'Legacy Notifications', badge: 'Coming Soon', status: 'preview' },
  { slug: 'bybit', title: 'Bybit', category: 'Legacy Notifications', badge: 'Coming Soon', status: 'preview' },
  { slug: 'coinbase', title: 'Coinbase', category: 'Legacy Notifications', badge: 'Coming Soon', status: 'preview' },
  { slug: 'crypto-com', title: 'Crypto.com', category: 'Legacy Notifications', badge: 'Coming Soon', status: 'preview' },
  { slug: 'cash-app', title: 'Cash App', category: 'Legacy Notifications', badge: 'Coming Soon', status: 'preview' },
  { slug: 'zelle', title: 'Zelle', category: 'Legacy Notifications', badge: 'Coming Soon', status: 'preview' },
  { slug: 'venmo', title: 'Venmo', category: 'Legacy Notifications', badge: 'Coming Soon', status: 'preview' },
  { slug: 'trust-wallet', title: 'Trust Wallet', category: 'Legacy Notifications', badge: 'Coming Soon', status: 'preview' },
  { slug: 'gcash', title: 'GCash', category: 'Legacy Notifications', badge: 'Coming Soon', status: 'preview' },
  { slug: 'crypto-receipts', title: 'Receipt Vault', category: 'Receipt Vault', badge: 'Coming Soon', status: 'preview' },
  { slug: 'ai-reply', title: 'Support AI Reply', category: 'Featured', badge: 'Coming Soon', status: 'preview' },
  { slug: 'articles', title: 'Ops Playbooks', category: 'Knowledge Library', badge: 'Coming Soon', status: 'preview' },
  { slug: 'faker-data', title: 'Sandbox Test Data', category: 'Sandbox Tools', badge: 'Coming Soon', status: 'preview' },
  { slug: 'support-sites', title: 'Support Desk', category: 'Support Desk', badge: 'Coming Soon', status: 'preview' },
  { slug: 'pass-clone', title: 'Security Center', category: 'Legacy Security Tools', badge: 'Coming Soon', status: 'preview' },
  { slug: 'wallet-tracker', title: 'Provider Balance Tracker', category: 'Provider Balance Tracker', badge: 'Coming Soon', status: 'preview' },
  { slug: 'qr-code', title: 'Payment QR', category: 'Payment QR', badge: 'Coming Soon', status: 'preview' },
  { slug: 'link-shortener', title: 'Payment Link Shortener', category: 'Legacy Payment Links', badge: 'Coming Soon', status: 'preview' },
  { slug: 'investinnova', title: 'Workflow Templates', category: 'Template Marketplace', badge: 'Coming Soon', status: 'preview' }
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
    preview: 'Coming Soon',
    maintenance: 'Maintenance',
    draft: 'Draft',
    disabled: 'Unavailable'
  }[status] || 'Unavailable';
}
