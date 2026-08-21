const PAYMENT_PROVIDER_SLUGS = new Set(['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']);

const SERVICE_STATUS_VALUES = Object.freeze([
  'draft',
  'preview',
  'sandbox',
  'active',
  'maintenance',
  'disabled'
]);

const AVAILABLE_SERVICE_STATUSES = Object.freeze(['active', 'sandbox']);

const SANDBOX_REQUIRED_MARKINGS = Object.freeze([
  'SANDBOX / TEST',
  'TEST DATA ONLY',
  'NOT PROOF OF PAYMENT'
]);

const SERVICE_CATALOGUE_SEED = Object.freeze([
  {
    slug: 'transaction-record',
    title: 'Verified Transaction Record',
    category: 'Transaction Records',
    description: 'Create a record only from an existing authoritative Transferly transaction.',
    badge: 'Verified',
    status: 'active',
    permissions: ['authenticated'],
    receiptType: 'transaction-record'
  },
  { slug: 'opay', title: 'Opay', category: 'Legacy Wallet Records', badge: 'Disabled', status: 'disabled', receiptType: 'bank' },
  { slug: 'kuda', title: 'Kuda', category: 'Legacy Wallet Records', badge: 'Disabled', status: 'disabled', receiptType: 'bank' },
  { slug: 'palmpay', title: 'Palmpay', category: 'Legacy Wallet Records', badge: 'Disabled', status: 'disabled', receiptType: 'bank' },
  { slug: 'paypal', title: 'PayPal', category: 'Payment Providers', badge: 'Live', status: 'active', permissions: ['authenticated'], receiptType: 'email' },
  { slug: 'stripe', title: 'Stripe Connect', category: 'Payment Providers', badge: 'Adapter', status: 'active', permissions: ['authenticated'], receiptType: 'email' },
  { slug: 'wise', title: 'Wise', category: 'Payment Providers', badge: 'Live', status: 'active', permissions: ['authenticated'], receiptType: 'email' },
  { slug: 'paystack', title: 'Paystack', category: 'Payment Providers', badge: 'Adapter', status: 'active', permissions: ['authenticated'], receiptType: 'email' },
  { slug: 'flutterwave', title: 'Flutterwave', category: 'Payment Providers', badge: 'Adapter', status: 'active', permissions: ['authenticated'], receiptType: 'email' },
  { slug: 'crypto', title: 'Crypto Commerce', category: 'Payment Providers', badge: 'Adapter', status: 'active', permissions: ['authenticated'], receiptType: 'email' },
  { slug: 'binance', title: 'Binance', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled', receiptType: 'email' },
  { slug: 'bybit', title: 'Bybit', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled', receiptType: 'email' },
  { slug: 'coinbase', title: 'Coinbase', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled', receiptType: 'email' },
  { slug: 'crypto-com', title: 'Crypto.com', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled', receiptType: 'email' },
  { slug: 'cash-app', title: 'Cash App', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled', receiptType: 'email' },
  { slug: 'zelle', title: 'Zelle', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled', receiptType: 'email' },
  { slug: 'venmo', title: 'Venmo', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled', receiptType: 'email' },
  { slug: 'trust-wallet', title: 'Trust Wallet', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled', receiptType: 'email' },
  { slug: 'gcash', title: 'GCash', category: 'Legacy Notifications', badge: 'Disabled', status: 'disabled', receiptType: 'email' },
  { slug: 'crypto-receipts', title: 'Receipt Vault', category: 'Receipt Vault', badge: 'Live', status: 'active', permissions: ['authenticated'], receiptType: 'email' },
  { slug: 'ai-reply', title: 'Support AI Reply', category: 'Featured', badge: 'Live', status: 'active', permissions: ['authenticated'] },
  { slug: 'articles', title: 'Ops Playbooks', category: 'Knowledge Library', badge: 'Live', status: 'active', permissions: ['authenticated'] },
  {
    slug: 'faker-data',
    title: 'Sandbox Test Data',
    category: 'Sandbox Tools',
    badge: 'Sandbox',
    status: 'sandbox',
    permissions: ['authenticated'],
    executionMode: 'sandbox',
    metadata: {
      legacyReceiptGeneration: true,
      requiredMarkings: SANDBOX_REQUIRED_MARKINGS
    }
  },
  { slug: 'support-sites', title: 'Support Desk', category: 'Support Desk', badge: 'Preview', status: 'preview' },
  { slug: 'pass-clone', title: 'Security Center', category: 'Legacy Security Tools', badge: 'Disabled', status: 'disabled' },
  { slug: 'wallet-tracker', title: 'Provider Balance Tracker', category: 'Provider Balance Tracker', badge: 'Preview', status: 'preview' },
  { slug: 'qr-code', title: 'Payment QR', category: 'Payment QR', badge: 'Preview', status: 'preview' },
  { slug: 'link-shortener', title: 'Payment Link Shortener', category: 'Legacy Payment Links', badge: 'Disabled', status: 'disabled' },
  { slug: 'investinnova', title: 'Workflow Templates', category: 'Template Marketplace', badge: 'Preview', status: 'preview' }
]);

module.exports = {
  AVAILABLE_SERVICE_STATUSES,
  PAYMENT_PROVIDER_SLUGS,
  SANDBOX_REQUIRED_MARKINGS,
  SERVICE_STATUS_VALUES,
  SERVICE_CATALOGUE_SEED
};
