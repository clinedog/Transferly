import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  Copy,
  CreditCard,
  FileText,
  Gauge,
  History,
  Layers3,
  LifeBuoy,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Smartphone,
  UserRound,
  WalletCards
} from 'lucide-react';

export const paypalWalletQuickAccessItems = [
  { label: 'Business Tools', to: '/miniapp/services/paypal', icon: Layers3 },
  { label: 'Invoicing', to: '/miniapp/services/paypal/invoices', icon: Receipt },
  { label: 'Request money', to: '/miniapp/services/paypal/invoices?action=create', icon: CreditCard },
  { label: 'Send money', to: '/miniapp/services/paypal/payouts', icon: Send },
  { label: 'PayPal.Me', to: '/miniapp/services/paypal/settings', icon: UserRound },
  { label: 'PayPal Checkout', to: '/miniapp/services/paypal/developer', icon: ShieldCheck },
  { label: 'PayPal Working Capital', to: '/miniapp/wallet?service=paypal', icon: WalletCards },
  { label: 'Payment Links & Buttons', to: '/miniapp/services/paypal/invoices?action=payment-link', icon: Copy },
  { label: 'Business Debit Card', to: '/miniapp/wallet?service=paypal', icon: CreditCard },
  { label: 'Store Sync', to: '/miniapp/services/paypal/transactions', icon: History }
];

export const paypalWalletMailTasks = [
  {
    label: 'Custom Mail',
    body: 'Build PayPal flash mail with custom recipient, amount, note, and delivery context.',
    to: '/miniapp/studio?type=email&service=paypal&mode=custom-mail',
    icon: FileText,
    badge: 'Flash'
  },
  {
    label: 'Deposit Mail',
    body: 'Prepare a deposit notification path with PayPal-specific payment and funding fields.',
    to: '/miniapp/studio?type=email&service=paypal&mode=deposit-mail',
    icon: CreditCard,
    badge: 'Deposit'
  },
  {
    label: 'Mail History',
    body: 'Search, duplicate, and export PayPal mail records from the Transferly vault.',
    to: '/miniapp/vault?service=paypal',
    icon: History,
    badge: 'Vault'
  },
  {
    label: 'Open PayPal provider workspace',
    body: 'Review PayPal provider health, webhook events, invoices, payouts, and recovery actions.',
    to: '/miniapp/services/paypal',
    icon: ShieldCheck,
    badge: 'Ops'
  }
];

export const paypalWalletDeveloperTasks = [
  { label: 'API credentials', to: '/miniapp/services/paypal/developer', detail: 'Client status and setup checks' },
  { label: 'Webhooks', to: '/miniapp/services/paypal/developer', detail: 'Delivery health, replay, and dead-letter recovery' },
  { label: 'Invoices', to: '/miniapp/services/paypal/invoices', detail: 'Create, remind, and reconcile PayPal invoices' },
  { label: 'Payouts', to: '/miniapp/services/paypal/payouts', detail: 'Review and release payout requests' }
];

export const paypalWalletMenuItems = [
  { label: 'Home', to: '/miniapp/services/paypal', icon: Gauge },
  { label: 'Activity', to: '/miniapp/services/paypal/transactions', icon: Activity, hasPanel: true },
  { label: 'Sales', to: '/miniapp/services/paypal/transactions', icon: BarChart3, hasPanel: true },
  { label: 'Finance', to: '/miniapp/wallet?service=paypal', icon: WalletCards, hasPanel: true },
  { label: 'Operations', to: '/miniapp/services/paypal/settings', icon: ShieldCheck, hasPanel: true },
  { label: 'Pay & Get Paid', to: '/miniapp/services/paypal/invoices?action=create', icon: Send, hasPanel: true },
  { label: 'Business Tools', to: '/miniapp/services/paypal', icon: Sparkles },
  { label: 'Developer', to: '/miniapp/services/paypal/developer', icon: ShieldCheck },
  { label: 'Profile', to: '/miniapp/profile', icon: UserRound },
  { label: 'Settings', to: '/miniapp/services/paypal/settings', icon: Settings },
  { label: 'Message Center (0)', to: '/miniapp/services/paypal/transactions', icon: Bell },
  { label: 'Help', to: '/miniapp/support', icon: LifeBuoy },
  { label: 'Log out', to: '/miniapp', icon: ArrowLeft }
];

export const paypalWalletMenuPanels = {
  Activity: [
    { label: 'All transactions', to: '/miniapp/services/paypal/transactions' },
    { label: 'Statements', to: '/miniapp/services/paypal/transactions?view=statements' },
    { label: 'Disputes', to: '/miniapp/services/paypal/disputes' }
  ],
  Sales: [
    { label: 'Sales insights', to: '/miniapp/services/paypal/transactions?view=sales' },
    { label: 'Customer list', to: '/miniapp/clients?provider=paypal' },
    { label: 'Reports', to: '/miniapp/analytics?provider=paypal&view=sales' }
  ],
  Finance: [
    { label: 'Balance', to: '/miniapp/services/paypal' },
    { label: 'Banks and cards', to: '/miniapp/wallet?service=paypal' },
    { label: 'Currencies', to: '/miniapp/ops?provider=paypal' }
  ],
  Operations: [
    { label: 'Business setup', to: '/miniapp/services/paypal/settings' },
    { label: 'Provider health', to: '/miniapp/services/paypal/developer' },
    { label: 'Security checks', to: '/miniapp/security?provider=paypal' }
  ],
  'Pay & Get Paid': [
    { label: 'Create an Invoice', to: '/miniapp/services/paypal/invoices?action=create' },
    { label: 'Request Money', to: '/miniapp/services/paypal/invoices?action=create' },
    { label: 'PayPal.Me', to: '/miniapp/services/paypal/settings' },
    { label: 'QR Code', to: '/miniapp/services/paypal/invoices?action=qr' },
    { label: 'Virtual Terminal', to: '/miniapp/ops?provider=paypal&tool=terminal' },
    { label: 'Payment Links and Buttons', to: '/miniapp/services/paypal/invoices?action=payment-link' },
    { label: 'Shopping Cart Buttons', to: '/miniapp/services/paypal/invoices?action=payment-link' },
    { label: 'Send Money', to: '/miniapp/services/paypal/payouts' },
    { label: 'Payouts', to: '/miniapp/services/paypal/payouts' },
    { label: 'Payment links', to: '/miniapp/services/paypal/invoices?action=payment-link' },
    { label: 'Custom mail', to: '/miniapp/studio?type=email&service=paypal&mode=custom-mail' },
    { label: 'Deposit mail', to: '/miniapp/studio?type=email&service=paypal&mode=deposit-mail' }
  ]
};

export const paypalWalletCreateItems = [
  { label: 'P2P Request', to: '/miniapp/services/paypal/invoices?action=create', icon: UserRound },
  { label: 'Invoice', to: '/miniapp/services/paypal/invoices', icon: Receipt },
  { label: 'Payment Link or Button', to: '/miniapp/services/paypal/invoices?action=payment-link', icon: Copy },
  { label: 'QR Code', to: '/miniapp/services/paypal/invoices?action=qr', icon: Smartphone },
  { label: 'P2P Payment', to: '/miniapp/services/paypal/payouts', icon: Send },
  { label: 'Transfer to Bank', to: '/miniapp/wallet?service=paypal', icon: CreditCard }
];

export const paypalWalletFooterLinks = ['Help', 'Contact', 'Sitemap', 'Fees', 'Security', 'About', 'Developers', 'Partners'];

export const paypalWalletLanguageLinks = ['English'];

export const paypalOperationTabs = [
  { id: 'send', label: 'Send payment', icon: Send },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'payouts', label: 'Payouts', icon: CreditCard },
  { id: 'tracking', label: 'Track', icon: Search }
];

export const paypalSendNavigationTabs = ['Send', 'Request', 'Contacts', 'Pools', 'More'];
