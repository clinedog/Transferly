const { createProviderAdapter } = require('./baseProviderAdapter');

// Cash App product/API availability varies by approved integration model.
// Keep this module dark until a supported contract is selected and reviewed.
const cashappProviderAdapter = createProviderAdapter({
  key: 'cashapp',
  displayName: 'Cash App',
  requiredEnv: ['CASH_APP_API_KEY'],
  capabilities: {
    invoices: false,
    payouts: false,
    balance: false,
    webhooks: false,
    merchant_payments: true
  },
  supportedOperations: [],
  docs: ['https://developers.cash.app/'],
  nextActions: [
    'Keep this provider disabled until an approved Cash App integration contract and merchant workflow are selected.',
    'Implement verified webhooks, idempotency, reconciliation, and ledger transitions before enabling payment actions.'
  ],
  configuredNextActions: [
    'Credentials alone do not enable this provider. Complete the approved Cash App integration design first.'
  ],
  notes: ['Discovery module only; no Cash App API calls, webhooks, or payment actions are implemented.']
});

module.exports = { cashappProviderAdapter };
