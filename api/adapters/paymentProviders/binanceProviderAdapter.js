const { createProviderAdapter } = require('./baseProviderAdapter');

// Discovery-only adapter. Binance operations remain unavailable until a
// reviewed custody, regional-compliance, and ledger-settlement design exists.
const binanceProviderAdapter = createProviderAdapter({
  key: 'binance',
  displayName: 'Binance',
  requiredEnv: ['BINANCE_API_KEY', 'BINANCE_API_SECRET'],
  capabilities: {
    invoices: false,
    payouts: false,
    balance: false,
    webhooks: false,
    crypto_assets: true
  },
  supportedOperations: [],
  docs: ['https://developers.binance.com/'],
  nextActions: [
    'Keep this provider disabled until jurisdiction, custody, transaction-monitoring, and settlement controls are approved.',
    'Implement signed client calls, idempotent order handling, and ledger reconciliation before enabling any money movement.'
  ],
  configuredNextActions: [
    'Credentials alone do not enable this provider. Complete the approved Binance integration design first.'
  ],
  notes: ['Discovery module only; no Binance API calls, webhooks, or custody actions are implemented.']
});

module.exports = { binanceProviderAdapter };
