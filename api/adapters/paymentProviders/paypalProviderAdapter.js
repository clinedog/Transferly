const config = require('../../config');
const { createProviderAdapter } = require('./baseProviderAdapter');

const paypalProviderAdapter = createProviderAdapter({
  key: 'paypal',
  displayName: 'PayPal',
  mode: config.PAYPAL_ENVIRONMENT,
  requiredEnv: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
  capabilities: {
    invoices: true,
    hosted_payment_links: true,
    payouts: true,
    balance: false,
    webhooks: true,
    payments: false,
    orders: true,
    transaction_search: true,
    refunds: false,
    disputes: false,
    subscriptions: false,
    payment_method_tokens: false,
    currency_exchange: false,
    recipients: false,
    quotes: false,
    crypto_payments: false
  },
  invoiceFeatures: {
    supported: true,
    provider_resource: 'invoice',
    collection_method: 'hosted_invoice',
    workflow: 'create_draft_then_send',
    hosted_payment_link: true,
    draft_preview: true,
    line_items: true,
    taxes: true,
    due_date: true,
    customer_notification: true,
    pdf: true,
    manual_finalize: false,
    crypto_settlement: false,
    settlement_flow: 'provider_paid_event_to_internal_pending_balance_then_admin_release',
    required_fields: ['recipient_email', 'currency', 'line_items'],
    optional_fields: ['memo', 'terms', 'due_date', 'taxes', 'discounts'],
    provider_link_field: 'recipient_view_url',
    provider_status_events: [
      'INVOICING.INVOICE.PAID',
      'INVOICING.INVOICE.CANCELLED',
      'INVOICING.INVOICE.REFUNDED',
      'INVOICING.INVOICE.UPDATED'
    ],
    admin_actions: ['refresh', 'release_funds', 'open_hosted_link']
  },
  supportedOperations: [
    'invoice.create',
    'invoice.preview',
    'invoice.send',
    'invoice.refresh',
    'invoice.release_funds',
    'invoice.cancel',
    'invoice.remind',
    'payout.preview',
    'payout.create',
    'payout.approve',
    'payout.reject',
    'payout.cancel_unclaimed',
    'payout.refresh',
    'payment.capture.lookup',
    'payment.authorization.lookup',
    'payment.refund.lookup',
    'payment.void.lookup',
    'order.lookup',
    'order.create.readiness',
    'order.capture.readiness',
    'transaction.search',
    'webhook.verify',
    'webhook.list',
    'dispute.list.readiness',
    'subscription.list.readiness',
    'payment_method_token.list.readiness',
    'currency_exchange.preview.readiness'
  ],
  docs: [
    'https://developer.paypal.com/docs/api/invoicing/v2/',
    'https://developer.paypal.com/docs/api/payments.payouts-batch/v1/',
    'https://developer.paypal.com/docs/api/payments/v2/',
    'https://developer.paypal.com/docs/api/orders/v2/',
    'https://developer.paypal.com/docs/api/transaction-search/v1/',
    'https://developer.paypal.com/docs/api/webhooks/v1/',
    'https://developer.paypal.com/docs/api/customer-disputes/v1/',
    'https://developer.paypal.com/docs/api/subscriptions/v1/',
    'https://developer.paypal.com/docs/api/payment-tokens/v3/',
    'https://developer.paypal.com/docs/api/pricing/v2/'
  ],
  configuredNextActions: [
    'Keep PayPal as the live provider for current invoice and payout workflows.',
    'Use provider state mapping instead of raw PayPal status strings in user-facing flows.',
    'Use PayPal Orders lookup and Transaction Search as read-only reconciliation/support tools until mutating order flows are fully audited.'
  ],
  nextActions: [
    'Set PayPal OAuth and webhook environment variables.',
    'Run the PayPal sandbox smoke check before enabling live traffic.'
  ],
  notes: [
    'This adapter describes the existing PayPal integration; it does not replace the current PayPal services.'
  ]
});

module.exports = {
  paypalProviderAdapter
};
