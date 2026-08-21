export const paypalSandboxSenderAccount = {
  name: 'Transferly Business Account',
  email: 'merchant@transferly.test',
  accountId: 'PAYPAL-BUSINESS-771904',
  country: 'United States',
  accountType: 'Business Account',
  fundingSource: 'PayPal balance',
  balance: 5000
};

export const paypalSandboxRecipients = [
  {
    email: 'sb-buyer@personal.paypal.com',
    name: 'Sandbox Personal Buyer',
    accountId: 'PAYPAL-PERSONAL-548219',
    country: 'United States',
    accountType: 'Personal Account',
    status: 'Verified',
    route: 'PayPal balance eligible'
  },
  {
    email: 'recipient@example.com',
    name: 'Recipient Account',
    accountId: 'PAYPAL-BUSINESS-302144',
    country: 'United Kingdom',
    accountType: 'Business Account',
    status: 'Verified',
    route: 'Instant sandbox payout'
  },
  {
    email: 'buyer@example.com',
    name: 'Customer Account',
    accountId: 'PAYPAL-PERSONAL-884201',
    country: 'United States',
    accountType: 'Personal Account',
    status: 'Verified',
    route: 'Invoice and goods payment eligible'
  }
];

export const paypalSandboxInvoices = [
  {
    id: 'INV2-PAYP-1001',
    customer: 'Customer Account',
    email: 'buyer@example.com',
    amount: 150,
    currency: 'USD',
    status: 'Sent',
    due: 'Jun 12, 2026',
    reference: 'INV-1001'
  },
  {
    id: 'INV2-PAYP-1002',
    customer: 'Recipient Account',
    email: 'recipient@example.com',
    amount: 550,
    currency: 'USD',
    status: 'Paid',
    due: 'Jun 02, 2026',
    reference: 'INV-1002'
  },
  {
    id: 'INV2-PAYP-1003',
    customer: 'Sandbox Personal Buyer',
    email: 'sb-buyer@personal.paypal.com',
    amount: 75,
    currency: 'USD',
    status: 'Draft',
    due: 'Jun 18, 2026',
    reference: 'INV-1003'
  }
];

export const paypalSandboxPayoutBatches = [
  {
    id: 'BATCH-PAYPAL-783912',
    senderBatchId: 'batch_1001',
    receiver: 'recipient@example.com',
    amount: 75,
    currency: 'USD',
    batchStatus: 'Processing',
    itemStatus: 'Pending',
    itemId: 'ITEM-PAYPAL-48102'
  },
  {
    id: 'BATCH-PAYPAL-903455',
    senderBatchId: 'batch_1002',
    receiver: 'sb-buyer@personal.paypal.com',
    amount: 125,
    currency: 'USD',
    batchStatus: 'Success',
    itemStatus: 'Completed',
    itemId: 'ITEM-PAYPAL-90211'
  }
];

export const paypalSandboxTimeline = [
  { label: 'Created', detail: 'Payment object created from the wallet service page.' },
  { label: 'Recipient validated', detail: 'Recipient details matched through the sandbox account directory.' },
  { label: 'Funding checked', detail: 'Sender balance and payout route passed sandbox validation.' },
  { label: 'Payment completed', detail: 'Sandbox transaction confirmation generated for testing.' }
];

export const paypalSandboxApiChecks = [
  { label: 'OAuth token', detail: 'Client credentials requested from the PayPal Sandbox API.', status: 'Ready' },
  { label: 'Invoices API', detail: 'Draft and send calls use /v2/invoicing/invoices.', status: 'Configured' },
  { label: 'Payouts API', detail: 'Batch and item status calls use /v1/payments/payouts.', status: 'Configured' },
  { label: 'Webhook verification', detail: 'Events require PayPal transmission headers and webhook ID.', status: 'Protected' }
];

export const paypalSandboxPayoutFaqs = [
  ['How do payout files work?', 'Upload a sandbox CSV or TXT with recipient email, amount, currency, and note columns.'],
  ['When can I continue?', 'The acknowledgement is required before submitting the sandbox payout batch.'],
  ['How are payout records tracked?', 'Batch IDs and item IDs are stored with their sandbox status for later lookup.']
];

export const paypalSandboxTransactions = [
  {
    id: 'PAYPAL-TXN-1001',
    date: 'Jun 5, 2026, 10:24 AM',
    type: 'Payment sent',
    party: 'Sandbox Personal Buyer',
    email: 'sb-buyer@personal.paypal.com',
    amount: -125,
    currency: 'USD',
    status: 'Completed',
    reference: 'REF-PAYPAL-1001',
    source: 'Payouts API',
    details: 'Sandbox payment completed with zero fee.'
  },
  {
    id: 'PAYPAL-TXN-1002',
    date: 'Jun 5, 2026, 9:10 AM',
    type: 'Invoice paid',
    party: 'Customer Account',
    email: 'buyer@example.com',
    amount: 150,
    currency: 'USD',
    status: 'Completed',
    reference: 'INV2-PAYP-1001',
    source: 'Invoicing API',
    details: 'Sandbox invoice payment matched to recipient_view_url.'
  },
  {
    id: 'PAYPAL-TXN-1003',
    date: 'Jun 4, 2026, 4:42 PM',
    type: 'Payout item',
    party: 'Recipient Account',
    email: 'recipient@example.com',
    amount: -75,
    currency: 'USD',
    status: 'Pending',
    reference: 'ITEM-PAYPAL-48102',
    source: 'Payouts item API',
    details: 'Sandbox payout item remains pending until the batch processor completes.'
  }
];
