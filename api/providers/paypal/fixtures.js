const fixtures = Object.freeze({
  sandbox: {
    enabled: false,
    note: 'PayPal fixtures are intentionally disabled by default and never contain live credentials or raw provider payloads.',
    workspace_resources: [
      'overview',
      'invoices',
      'payouts',
      'payments',
      'orders',
      'transactions',
      'webhooks',
      'disputes',
      'subscriptions',
      'tokens',
      'currency-exchange',
      'developer',
      'settings'
    ],
    sandbox_record_policy: 'Fixtures may describe resource shapes, but must never be presented as real PayPal payment proof.'
  }
});

module.exports = {
  fixtures
};
