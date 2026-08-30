import React, { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  Gauge,
  History,
  Layers3,
  LifeBuoy,
  LockKeyhole,
  Maximize2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Smartphone,
  UserRound,
  Vibrate,
  WalletCards,
  X,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import MiniAppShell from '../components/MiniAppShell';
import { SessionHealthStrip, TelegramLaunchNotice } from '../components/miniapp/MiniAppSessionStatus';
import ServiceLogo from '../components/ServiceLogo';
// Lazy-load heavy miniapp sections and feature components for route-based code-splitting
const MiniAppPointsWallet = lazy(() => import('../components/MiniAppPointsWallet'));
const MiniAppReceiptStudio = lazy(() => import('../components/MiniAppReceiptStudio'));
const MiniAppReceiptVault = lazy(() => import('../components/MiniAppReceiptVault'));
const ProviderWorkspaceFoundation = lazy(() => import('../components/ProviderWorkspaceFoundation'));

// Named exports from MiniAppFinanceSuite are lazy-wrapped so each section becomes a separate chunk
const ActivitySection = lazy(() => import('../components/MiniAppFinanceSuite').then((m) => ({ default: m.ActivitySection })));
const AnalyticsSection = lazy(() => import('../components/MiniAppFinanceSuite').then((m) => ({ default: m.AnalyticsSection })));
const ClientsSection = lazy(() => import('../components/MiniAppFinanceSuite').then((m) => ({ default: m.ClientsSection })));
const InvoicesSection = lazy(() => import('../components/MiniAppFinanceSuite').then((m) => ({ default: m.InvoicesSection })));
const NotificationsSection = lazy(() => import('../components/MiniAppFinanceSuite').then((m) => ({ default: m.NotificationsSection })));
const PayoutsSection = lazy(() => import('../components/MiniAppFinanceSuite').then((m) => ({ default: m.PayoutsSection })));
const ProviderCommandCenter = lazy(() => import('../components/MiniAppFinanceSuite').then((m) => ({ default: m.ProviderCommandCenter })));
const RiskSection = lazy(() => import('../components/MiniAppFinanceSuite').then((m) => ({ default: m.RiskSection })));
const SecuritySection = lazy(() => import('../components/MiniAppFinanceSuite').then((m) => ({ default: m.SecuritySection })));

// Loading fallbacks
import LoadingFallback from '../components/ui/LoadingFallback';
import { BottomSheet } from '../components/ui';

// Prefetch helpers: dynamically import chunks on demand (hover or programmatic prefetch)
let _financePrefetched = false;
let _providerPrefetched = false;

function isConnectionFastEnough() {
  try {
    const nav = navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    if (!nav) return true; // unknown, allow
    const effective = nav.effectiveType || '';
    // effectiveType values: 'slow-2g', '2g', '3g', '4g'
    return !/^(slow-2g|2g)$/.test(effective);
  } catch {
    return true;
  }
}

function prefetchProviderWorkspace() {
  if (!isConnectionFastEnough() || _providerPrefetched) return;
  _providerPrefetched = true;
  import('../components/ProviderWorkspaceFoundation');
  import('../components/MiniAppFinanceSuite').then((m) => m.ProviderCommandCenter && m.ProviderCommandCenter);
}

function prefetchFinanceSections() {
  if (!isConnectionFastEnough() || _financePrefetched) return;
  _financePrefetched = true;
  import('../components/MiniAppFinanceSuite');
}

// IntersectionObserver-based prefetch for in-viewport links (improves mobile/keyboard coverage)
function setupPrefetchOnViewport(root = document) {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const prefetch = el.getAttribute && el.getAttribute('data-prefetch');
        if (!prefetch) return;
        if (prefetch === 'finance') prefetchFinanceSections();
        if (prefetch === 'provider') prefetchProviderWorkspace();
        observer.unobserve(el);
      });
    },
    { rootMargin: '300px' }
  );

  const els = Array.from(root.querySelectorAll('[data-prefetch]'));
  els.forEach((el) => observer.observe(el));

  return () => observer.disconnect();
}

import { useAppContext } from '../context/AppContext';
import { useTelegramMiniApp } from '../context/TelegramMiniAppContext';
import {
  dashboardPreviewSlugs,
  getRecommendedPointPacks,
  getRelatedServices,
  getServiceBySlug,
  getServiceEstimatedCost,
  getServicePreview
} from '../lib/servicesCatalog';
import {
  getServiceStatusLabel,
  isServiceAvailable,
  isServiceLaunchable
} from '../lib/serviceCatalogueContract';
import { getProviderDashboard, getProviderResource } from '../lib/api';
import {
  getProviderWorkspaceRoute,
  isProviderLaneSupported,
  isProviderManifestSlug
} from '../lib/providerManifests';
import {
  paypalOperationTabs,
  paypalSendNavigationTabs,
  paypalWalletCreateItems,
  paypalWalletDeveloperTasks,
  paypalWalletFooterLinks,
  paypalWalletLanguageLinks,
  paypalWalletMailTasks,
  paypalWalletMenuItems,
  paypalWalletMenuPanels,
  paypalWalletQuickAccessItems
} from '../components/providers/paypalWalletConfig';
import {
  paypalSandboxInvoices,
  paypalSandboxPayoutBatches,
  paypalSandboxPayoutFaqs,
  paypalSandboxSenderAccount,
  paypalSandboxTimeline,
  paypalSandboxTransactions
} from '../lib/paypalSandboxFixtures';
import {
  createPayPalSandboxReference,
  downloadBlob,
  downloadPaymentConfirmationImage,
  downloadPaymentConfirmationPdf,
  findPayPalSandboxRecipient,
  formatPayPalCurrency
} from '../lib/paypalSandboxExport';

const sectionMeta = {
  home: {
    title: 'Wallet Home',
    subtitle: 'Telegram-native workspace'
  },
  services: {
    title: 'Services',
    subtitle: 'Provider workspaces and service tools'
  },
  studio: {
    title: 'Receipt Studio',
    subtitle: 'Create polished receipts'
  },
  invoices: {
    title: 'Invoice Overview',
    subtitle: 'Cross-provider collection dashboard'
  },
  payouts: {
    title: 'Payout Overview',
    subtitle: 'Cross-provider sending dashboard'
  },
  activity: {
    title: 'Activity Feed',
    subtitle: 'Unified payment timeline'
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Revenue and operations'
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'Actionable alerts'
  },
  clients: {
    title: 'Clients',
    subtitle: 'Recipient intelligence'
  },
  risk: {
    title: 'Risk Command',
    subtitle: 'Operator safety controls'
  },
  security: {
    title: 'Security',
    subtitle: 'Session and audit posture'
  },
  vault: {
    title: 'Your transactions',
    subtitle: 'Search, duplicate, export'
  },
  orders: {
    title: 'Orders',
    subtitle: 'Point release history'
  },
  wallet: {
    title: 'Buy Points',
    subtitle: 'Funding methods'
  },
  ops: {
    title: 'Provider Command',
    subtitle: 'Aggregate provider readiness and health'
  },
  support: {
    title: 'Support Desk',
    subtitle: 'Guided Telegram support'
  },
  profile: {
    title: 'Referral',
    subtitle: 'Invite and profile'
  },
  settings: {
    title: 'Settings',
    subtitle: 'Preferences and safety'
  }
};

const startParamSections = {
  generate: 'studio',
  studio: 'studio',
  invoice: 'invoices',
  invoices: 'invoices',
  payout: 'payouts',
  payouts: 'payouts',
  activity: 'activity',
  feed: 'activity',
  analytics: 'analytics',
  catalog: 'services',
  marketplace: 'services',
  notifications: 'notifications',
  alerts: 'notifications',
  services: 'services',
  clients: 'clients',
  risk: 'risk',
  security: 'security',
  wallet: 'wallet',
  'buy-point': 'wallet',
  'buy-points': 'wallet',
  vault: 'vault',
  history: 'vault',
  orders: 'orders',
  order: 'orders',
  'flash-mails': 'studio',
  flashmail: 'studio',
  support: 'support',
  profile: 'profile',
  settings: 'settings',
  ops: 'ops'
};

const providerCollectionLanePriority = ['invoices', 'payments', 'receive', 'collections'];
const providerSendingLanePriority = ['payouts', 'send', 'transfers', 'connect'];

// Global invoice/payout routes remain available as aggregate views, while
// provider-scoped links move users into the matching provider workspace lane.
function getPreferredProviderLane(slug, lanePriority) {
  return lanePriority.find((laneId) => isProviderLaneSupported(slug, laneId)) || 'overview';
}

function buildProviderWorkspaceRedirect(search, target) {
  const params = new URLSearchParams(search);
  params.delete('provider');
  const query = params.toString();

  return `${target}${query ? `?${query}` : ''}`;
}

const DEFAULT_SCREEN_KEY = 'transferly_miniapp_default_screen';
const TELEGRAM_BOT_URL = 'https://t.me/TransferlyBot';

const defaultScreenOptions = [
  { id: 'home', label: 'Command', to: '/miniapp', icon: Gauge },
  { id: 'services', label: 'Services', to: '/miniapp/services', icon: Sparkles },
  { id: 'studio', label: 'Studio', to: '/miniapp/studio', icon: Zap },
  { id: 'paypal', label: 'PayPal', to: '/miniapp/services/paypal', icon: FileText },
  { id: 'analytics', label: 'Metrics', to: '/miniapp/analytics', icon: BarChart3 },
  { id: 'vault', label: 'Vault', to: '/miniapp/vault', icon: History },
  { id: 'orders', label: 'Orders', to: '/miniapp/orders', icon: CreditCard },
  { id: 'wallet', label: 'Wallet', to: '/miniapp/wallet', icon: WalletCards },
  { id: 'ops', label: 'Providers', to: '/miniapp/ops', icon: ShieldCheck },
  { id: 'support', label: 'Support', to: '/miniapp/support', icon: LifeBuoy }
];

const providerHighlights = ['paypal', 'stripe', 'paystack', 'flutterwave', 'crypto', 'wise']
  .map((slug) => getServiceBySlug(slug))
  .filter(Boolean);

const miniAppServiceHighlights = dashboardPreviewSlugs
  .map((slug) => getServiceBySlug(slug))
  .filter(Boolean)
  .slice(0, 10);

const miniAppServiceCategories = [
  { title: 'Provider Workspaces', slugs: ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto'] },
  { title: 'Transaction Records', slugs: ['transaction-record', 'crypto-receipts'] },
  { title: 'Operations', slugs: ['ai-reply', 'articles'] },
  { title: 'Sandbox Tools', slugs: ['faker-data'] }
];

const miniAppMailServiceSlugs = new Set();

const launchSteps = [
  {
    icon: Bot,
    title: 'Open the bot',
    body: 'Start in Telegram with /start or /miniapp so identity, access, and launch context stay native.'
  },
  {
    icon: Smartphone,
    title: 'Launch the miniapp',
    body: 'Jump directly into Studio, Vault, Wallet, Providers, or Support without web login screens.'
  },
  {
    icon: Layers3,
    title: 'Operate faster',
    body: 'Use receipt tools, points, provider status, activity, and support context from one mobile workspace.'
  }
];

const marketplaceLanes = [
  {
    title: 'Verified Transaction Records',
    body: 'Review auditable records backed by persisted Transferly activity instead of arbitrary payment claims.',
    to: '/miniapp/services/transaction-record',
    icon: FileText,
    badge: 'Records'
  },
  {
    title: 'Sandbox Test Data',
    body: 'Generate permanently marked test data for demos, QA, support rehearsals, and operator training.',
    to: '/miniapp/studio?service=faker-data',
    icon: CheckCircle2,
    badge: 'Sandbox'
  },
  {
    title: 'Receipt Vault',
    body: 'Search, duplicate, preview, export, and hand off generated receipts with support-ready context.',
    to: '/miniapp/vault',
    icon: History,
    badge: 'Archive'
  },
  {
    title: 'Support Desk',
    body: 'Launch guided help with current screen, Telegram identity, order, receipt, and provider context attached.',
    to: '/miniapp/support',
    icon: LifeBuoy,
    badge: 'Handoff'
  },
  {
    title: 'Security Center',
    body: 'Review session posture, account linking, export controls, audit posture, and sensitive workflow checks.',
    to: '/miniapp/security',
    icon: LockKeyhole,
    badge: 'Safe'
  },
  {
    title: 'Provider Command',
    body: 'Monitor readiness, balances, webhook health, issue triage, invoices, and payouts for supported rails.',
    to: '/miniapp/ops',
    icon: ShieldCheck,
    badge: 'Ops'
  },
  {
    title: 'Order History',
    body: 'Review point reservations, processing state, release history, and failed order attempts.',
    to: '/miniapp/orders',
    icon: CreditCard,
    badge: 'Orders'
  },
  {
    title: 'Activity Timeline',
    body: 'Track provider and order activity from the unified operational timeline.',
    to: '/miniapp/activity',
    icon: Activity,
    badge: 'Events'
  },
  {
    title: 'Knowledge Library',
    body: 'Open operational playbooks for provider setup, support handling, and release procedures.',
    to: '/miniapp/services/articles',
    icon: Star,
    badge: 'Guides'
  },
  {
    title: 'Provider Workspaces',
    body: 'Open supported provider lanes for invoices, payouts, balance review, and operational status.',
    to: '/miniapp/services',
    icon: WalletCards,
    badge: 'Providers'
  }
];

const supportFaqs = [
  {
    question: 'How do I open Transferly from Telegram?',
    answer: 'Use the Telegram bot launch buttons. The miniapp reads Telegram context and routes you into the right workspace.'
  },
  {
    question: 'Where do I top up or review points?',
    answer: 'Open Wallet from the miniapp. Support context includes latest order and point balance for faster follow-up.'
  },
  {
    question: 'Where are generated receipts stored?',
    answer: 'Open Vault for searchable history, duplication, preview, export, and support handoff details.'
  },
  {
    question: 'How do provider issues get escalated?',
    answer: 'Open Providers or Support. The support bundle includes runtime, account, order, receipt, and open issue counts.'
  }
];

const orderFilterOptions = [
  { id: 'all', label: 'All' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'pending-release', label: 'Pending release' },
  { id: 'completed', label: 'Completed' },
  { id: 'canceled', label: 'Canceled' },
  { id: 'failed', label: 'Failed' }
];

const profileTabs = ['Fees & pricing', 'Contact Telegram', 'Personal info', 'Security', 'Danger zone'];

function normalizeOrderStatus(status) {
  const value = String(status || '').toLowerCase().replace(/_/g, '-');

  if (['awaiting-confirmation', 'pending'].includes(value)) {
    return 'pending-release';
  }

  if (['processing', 'created', 'paid'].includes(value)) {
    return 'in-progress';
  }

  if (['completed', 'released', 'success', 'successful'].includes(value)) {
    return 'completed';
  }

  if (['cancelled', 'canceled'].includes(value)) {
    return 'canceled';
  }

  if (['failed', 'rejected'].includes(value)) {
    return 'failed';
  }

  return 'in-progress';
}

function formatOrderDate(value) {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return date.toLocaleString();
}

function readStoredMiniAppSetting(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  return window.localStorage.getItem(key) || fallback;
}

function StatCard({ icon: Icon, label, value, tone = 'default' }) {
  const toneClasses = {
    default: 'bg-[var(--tg-section-bg-color)]',
    accent: 'bg-[color-mix(in_srgb,var(--tg-button-color)_14%,var(--tg-section-bg-color))]',
    warn: 'bg-[color-mix(in_srgb,#f59e0b_16%,var(--tg-section-bg-color))]',
    danger: 'bg-[color-mix(in_srgb,var(--tg-destructive-text-color)_12%,var(--tg-section-bg-color))]'
  };

  return (
    <div className={`rounded-[24px] p-4 shadow-sm ${toneClasses[tone] || toneClasses.default}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
        <Icon size={15} />
        {label}
      </div>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{value}</p>
    </div>
  );
}

function ActionCard({ icon: Icon, title, body, to, badge, accent = false }) {
  return (
    <Link
      to={to}
      className={`group block rounded-[26px] p-5 shadow-sm transition active:scale-[0.99] ${
        accent
          ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
          : 'bg-[var(--tg-section-bg-color)] text-[var(--tg-text-color)]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          accent
            ? 'bg-white/[0.16] text-[var(--tg-button-text-color)]'
            : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-button-color)]'
        }`}>
          <Icon size={22} />
        </div>
        {badge ? (
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
            accent ? 'bg-white/[0.16] text-white' : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-hint-color)]'
          }`}>
            {badge}
          </span>
        ) : null}
      </div>
      <h3 className="mt-5 text-lg font-black tracking-[-0.03em]">{title}</h3>
      <p className={`mt-2 text-sm leading-6 ${accent ? 'text-white/[0.76]' : 'text-[var(--tg-subtitle-text-color)]'}`}>
        {body}
      </p>
      <div className="mt-5 flex items-center gap-2 text-sm font-black">
        Open
        <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function ServiceRail({ services }) {
  if (!services.length) {
    return null;
  }

  const railItems = [...services, ...services];

  return (
    <section className="overflow-hidden rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Service catalog</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Telegram-ready launch lanes</h3>
        </div>
        <Link
          to="/miniapp/services"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[var(--tg-secondary-bg-color)] text-[var(--tg-button-color)] transition active:scale-95"
          aria-label="Open service catalog"
        >
          <ArrowRight size={18} />
        </Link>
      </div>
      <div className="relative mt-5">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--tg-section-bg-color)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--tg-section-bg-color)] to-transparent" />
        <div className="flex w-max gap-3 motion-safe:animate-[transferlyServiceRail_38s_linear_infinite]">
          {railItems.map((service, index) => (
            <Link
              key={`${service.slug}-${index}`}
              to="/miniapp/services"
              className="flex w-56 shrink-0 items-center gap-3 rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-3 text-[var(--tg-text-color)] transition active:scale-[0.99]"
            >
              <ServiceLogo service={service} size="md" className="shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{service.title}</span>
                <span className="mt-0.5 block truncate text-xs font-bold text-[var(--tg-hint-color)]">{service.category}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes transferlyServiceRail {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

function LaunchPath() {
  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">
        <Bot size={15} />
        Bot-first access
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {launchSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
                  <Icon size={20} />
                </div>
                <span className="text-xs font-black text-[var(--tg-hint-color)]">0{index + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-black tracking-[-0.03em] text-[var(--tg-text-color)]">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">{step.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProviderDock() {
  if (!providerHighlights.length) {
    return null;
  }

  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Provider workspaces</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Collect and send by provider</h3>
        </div>
        <Link
          to="/miniapp/services"
          className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[var(--tg-button-color)] px-4 py-3 text-xs font-black text-[var(--tg-button-text-color)] transition active:scale-95"
        >
          Browse
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {providerHighlights.map((provider) => (
          <Link
            key={provider.slug}
            to={getMiniAppServiceTarget(provider)}
            onMouseEnter={prefetchProviderWorkspace}
            onFocus={prefetchProviderWorkspace}
            className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4 transition active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <ServiceLogo service={provider} size="md" />
              <span className="rounded-full bg-[var(--tg-section-bg-color)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
                {provider.badge}
              </span>
            </div>
            <h4 className="mt-4 truncate text-base font-black tracking-[-0.025em] text-[var(--tg-text-color)]">{provider.title}</h4>
            <p className="mt-1 truncate text-xs font-bold text-[var(--tg-hint-color)]">Open workspace</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MarketplaceBoard() {
  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Premium service marketplace</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">All Transferly launch lanes</h3>
        </div>
        <Link
          to="/miniapp/services"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[var(--tg-secondary-bg-color)] text-[var(--tg-button-color)] transition active:scale-95"
          aria-label="Open full marketplace"
        >
          <ArrowRight size={18} />
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {marketplaceLanes.map((lane) => {
          const Icon = lane.icon;
          return (
            <Link
              key={lane.title}
              to={lane.to}
              className="group rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4 text-[var(--tg-text-color)] transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[var(--tg-section-bg-color)] text-[var(--tg-button-color)]">
                  <Icon size={20} />
                </span>
                <span className="rounded-full bg-[var(--tg-section-bg-color)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
                  {lane.badge}
                </span>
              </div>
              <h4 className="mt-4 text-base font-black tracking-[-0.025em]">{lane.title}</h4>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">{lane.body}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-button-color)]">
                Open
                <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function getMiniAppServiceTarget(service) {
  if (!service) {
    return '/miniapp/services';
  }

  // PayPal's hosted sandbox-style account surface is the service landing page.
  // Operational provider lanes remain available from its in-page actions.
  if (service.slug === 'paypal') {
    return '/miniapp/services/paypal';
  }

  if (isServiceAvailable(service) && isProviderManifestSlug(service.slug)) {
    return getProviderWorkspaceRoute(service.slug);
  }

  return `/miniapp/services/${service.slug}`;
}

function getMiniAppLaunchTarget(service) {
  if (!service) {
    return '/miniapp/services';
  }

  if (service.slug === 'paypal') {
    return '/miniapp/services/paypal';
  }

  if (!isServiceLaunchable(service)) {
    return `/miniapp/services/${service.slug}`;
  }

  if (isProviderManifestSlug(service.slug)) {
    return getProviderWorkspaceRoute(service.slug);
  }

  if (service.launchTo?.startsWith('/miniapp')) {
    return service.launchTo;
  }

  if (service.launchTo?.startsWith('/dashboard/generate')) {
    const [, query = ''] = service.launchTo.split('?');
    return query ? `/miniapp/studio?${query}` : '/miniapp/studio';
  }

  if (service.launchTo?.startsWith('/transactions')) {
    return '/miniapp/vault';
  }

  if (service.launchTo?.startsWith('/services/')) {
    return `/miniapp/services/${service.slug}`;
  }

  return service.launchTo || `/miniapp/services/${service.slug}`;
}

function HeroPanel({ profile, telegram, receipts, topUpOrders }) {
  const firstName = telegram.user?.first_name || profile?.name?.split(' ')?.[0] || 'Operator';
  const latestOrder = topUpOrders[0];
  const balance = Number(profile?.points || 0);
  const metrics = [
    { label: 'Services', value: miniAppServiceHighlights.length, icon: Sparkles, to: '/miniapp/services', detail: 'Launch lanes' },
    { label: 'Orders', value: topUpOrders.length, icon: CreditCard, to: '/miniapp/orders', detail: latestOrder?.status || 'No pending orders' },
    { label: 'History', value: receipts.length, icon: History, to: '/miniapp/vault', detail: receipts[0]?.title || 'Receipt vault' }
  ];
  const quickActions = [
    {
      title: 'Buy Points',
      body: latestOrder?.status || 'Fund wallet balance for premium services.',
      icon: WalletCards,
      to: '/miniapp/wallet',
      accent: true
    },
    {
      title: 'Receipt Studio',
      body: 'Generate a polished receipt and save it to the vault.',
      icon: Receipt,
      to: '/miniapp/studio'
    },
    {
      title: 'Provider Ops',
      body: 'Inspect provider health, queues, and payment operations.',
      icon: Activity,
      to: '/miniapp/ops'
    },
    {
      title: 'Support Handoff',
      body: 'Attach account context before opening support.',
      icon: LifeBuoy,
      to: '/miniapp/support?from=home'
    }
  ];
  const workflowSteps = [
    { label: 'Fund', icon: WalletCards, active: balance > 0 },
    { label: 'Create', icon: Receipt, active: true },
    { label: 'Track', icon: History, active: receipts.length > 0 || topUpOrders.length > 0 },
    { label: 'Resolve', icon: ShieldCheck, active: telegram.available }
  ];

  // Enable viewport-based prefetching on mount for better mobile/keyboard coverage.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const cleanup = setupPrefetchOnViewport(document);
      return () => cleanup && cleanup();
    } catch (error) {
      // non-fatal: do not block render
      console.warn('Viewport prefetch setup failed', error);
      return undefined;
    }
  }, []);

  return (
    <section className="space-y-5">
      <div className="miniapp-command-hero relative overflow-hidden rounded-[32px] border border-[var(--miniapp-border-color)] p-5 text-white shadow-[0_28px_80px_rgba(0,0,0,0.34)] sm:p-6">
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-white/76">Welcome back,</p>
                <h2 className="mt-1 truncate text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
                  {firstName}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.13em] text-white/78">
                    <Bot size={14} />
                    {telegram.available ? 'Telegram runtime' : 'Browser preview'}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.13em] text-emerald-100">
                    <CheckCircle2 size={14} />
                    Command ready
                  </span>
                </div>
              </div>
              <Link
                to="/miniapp/wallet"
                data-prefetch="provider"
                onMouseEnter={prefetchProviderWorkspace}
                onFocus={prefetchProviderWorkspace}
                className="miniapp-pressable inline-flex shrink-0 items-center justify-center gap-2 rounded-[8px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)] shadow-[0_18px_44px_rgba(0,0,0,0.24)]"
              >
                <Zap size={17} />
                Buy Points
              </Link>
            </div>

            <div className="mt-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Total Balance</p>
              <p className="mt-2 text-5xl font-black tracking-[-0.065em] text-white sm:text-6xl">
                {balance.toLocaleString()} pts
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {metrics.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onMouseEnter={prefetchFinanceSections}
                    onFocus={prefetchFinanceSections}
                    data-prefetch="finance"
                    className="miniapp-pressable rounded-[24px] border border-white/10 bg-white/[0.13] p-3 text-white backdrop-blur"
                  >
                    <Icon size={18} />
                    <span className="mt-3 block text-2xl font-black tracking-[-0.04em]">{Number(item.value || 0).toLocaleString()}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-black uppercase tracking-[0.12em] text-white/[0.66]">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/58">Today flow</p>
                <p className="mt-1 text-lg font-black tracking-[-0.03em] text-white">Operate faster</p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-white/12 text-white">
                <Layers3 size={21} />
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] ${step.active ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]' : 'bg-white/10 text-white/52'}`}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-white">{step.label}</span>
                      <span className="block text-xs font-bold text-white/54">Step {index + 1} of {workflowSteps.length}</span>
                    </span>
                    <span className={`h-2.5 w-2.5 rounded-full ${step.active ? 'bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.7)]' : 'bg-white/20'}`} />
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-[22px] bg-white/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/58">Latest signal</p>
              <p className="mt-1 truncate text-sm font-black text-white">{latestOrder?.order_id || receipts[0]?.title || 'Workspace ready'}</p>
              <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-white/58">{latestOrder?.status || metrics[2].detail}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              to={action.to}
              className={`miniapp-pressable group rounded-[26px] border border-[var(--miniapp-border-color)] p-4 shadow-sm ${
                action.accent
                  ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
                  : 'bg-[var(--tg-section-bg-color)] text-[var(--tg-text-color)]'
              }`}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${
                action.accent
                  ? 'bg-white/[0.16] text-white'
                  : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-button-color)]'
              }`}>
                <Icon size={22} />
              </span>
              <span className="mt-4 flex items-center justify-between gap-3">
                <span className="text-base font-black tracking-[-0.03em]">{action.title}</span>
                <ArrowRight size={16} className="shrink-0 transition group-hover:translate-x-0.5" />
              </span>
              <span className={`mt-1 block line-clamp-2 text-xs font-bold leading-5 ${action.accent ? 'text-white/76' : 'text-[var(--tg-hint-color)]'}`}>
                {action.body}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function FeaturedStrip() {
  const featured = ['ai-reply', 'articles', 'transaction-record', 'faker-data']
    .map((slug) => getServiceBySlug(slug))
    .filter(Boolean);
  const primary = featured[0];
  const secondary = featured.slice(1);

  if (!primary) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">Featured</h3>
        <Link to="/miniapp/services" className="text-sm font-black text-[var(--tg-button-color)]">
          See all
        </Link>
      </div>
      <Link
        to={getMiniAppServiceTarget(primary)}
        className="group block overflow-hidden rounded-[8px] border border-[var(--miniapp-border-color)] bg-[var(--tg-section-bg-color)] p-5 text-[var(--tg-text-color)] shadow-[0_18px_46px_rgba(0,0,0,0.24)] transition active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-4">
          <ServiceLogo service={primary} size="lg" />
          <span className="rounded-full bg-[var(--tg-button-color)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--tg-button-text-color)]">
            {primary.badge}
          </span>
        </div>
        <h4 className="mt-5 text-2xl font-black tracking-[-0.045em]">{primary.title}</h4>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--tg-subtitle-text-color)]">{primary.description}</p>
        <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[var(--tg-button-color)]">
          Open
          <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
        </div>
      </Link>
      <div className="grid grid-cols-3 gap-3">
        {secondary.map((service) => (
          <Link
            key={service.slug}
            to={getMiniAppServiceTarget(service)}
            className="rounded-[24px] bg-[var(--tg-section-bg-color)] p-3 text-center text-[var(--tg-text-color)] transition active:scale-[0.98]"
          >
            <ServiceLogo service={service} size="md" className="mx-auto" />
            <span className="mt-3 block truncate text-xs font-black">{service.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function WorkspaceStatusStrip({ telegram, telegramAuthState, loading, paymentIssues = [] }) {
  const viewport = telegram.viewport || {};
  const mode = viewport.mode || telegram.displayMode || (telegram.available ? 'expanded' : 'browser');
  const platform = viewport.platform || telegram.platform || 'browser';
  const issueCount = Array.isArray(paymentIssues) ? paymentIssues.length : 0;
  const items = [
    {
      label: 'Runtime',
      value: telegram.available ? 'Telegram' : 'Preview',
      detail: platform,
      icon: Smartphone,
      tone: telegram.available ? 'text-emerald-300' : 'text-amber-200'
    },
    {
      label: 'Viewport',
      value: mode,
      detail: viewport.orientation || 'portrait',
      icon: Maximize2,
      tone: mode === 'fullscreen' ? 'text-emerald-300' : 'text-sky-200'
    },
    {
      label: 'Session',
      value: loading ? 'Loading' : telegramAuthState || 'preview',
      detail: telegram.initData ? 'initData present' : 'fallback safe',
      icon: ShieldCheck,
      tone: telegramAuthState === 'failed' ? 'text-red-300' : 'text-emerald-300'
    },
    {
      label: 'Alerts',
      value: issueCount ? `${issueCount} issue${issueCount === 1 ? '' : 's'}` : 'Clear',
      detail: issueCount ? 'Review ops' : 'No blocking alerts',
      icon: Bell,
      tone: issueCount ? 'text-amber-200' : 'text-emerald-300'
    }
  ];

  return (
    <section
      className="rounded-[28px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-bg)] p-3 shadow-sm"
      aria-label="Mini App workspace status"
      data-testid="miniapp-workspace-status"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-[22px] bg-[var(--miniapp-panel-bg)] px-3 py-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[var(--miniapp-accent-soft)] ${item.tone}`}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--miniapp-shell-text-muted)]">{item.label}</span>
                <span className="block truncate text-sm font-black capitalize text-[var(--miniapp-shell-text)]">{item.value}</span>
                <span className="block truncate text-[11px] font-bold text-[var(--miniapp-shell-text-muted)]">{item.detail}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AllServicesGrid() {
  const slugs = [
    'transaction-record',
    'crypto-receipts',
    'paypal',
    'wise',
    'faker-data',
    'stripe',
    'paystack',
    'flutterwave',
    'crypto',
    'ai-reply',
    'articles'
  ];
  const services = slugs.map((slug) => getServiceBySlug(slug)).filter(Boolean);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">All Services</h3>
        <Link to="/miniapp/services" className="text-sm font-black text-[var(--tg-button-color)]">
          Explore
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-6">
        {services.map((service) => (
          <Link
            key={service.slug}
            to={getMiniAppServiceTarget(service)}
            className="min-h-[104px] rounded-[22px] bg-[var(--tg-section-bg-color)] p-3 text-center text-[var(--tg-text-color)] transition hover:bg-[var(--tg-secondary-bg-color)] active:scale-[0.98]"
          >
            <ServiceLogo service={service} size="md" className="mx-auto" />
            <span className="mt-3 line-clamp-2 min-h-[26px] text-[11px] font-black leading-tight">{service.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ServiceCatalogTile({ service }) {
  const unavailable = !isServiceAvailable(service);

  return (
    <Link
      to={getMiniAppServiceTarget(service)}
      className="relative flex min-h-[112px] flex-col items-center justify-center rounded-[8px] border border-[var(--miniapp-border-color)] bg-[var(--tg-secondary-bg-color)] p-3 text-center text-[var(--tg-text-color)] transition hover:bg-[var(--tg-section-bg-color)] active:scale-[0.98]"
      aria-disabled={unavailable}
    >
      {service.badge ? (
        <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${
          unavailable
            ? 'bg-white/10 text-[var(--tg-hint-color)]'
            : 'bg-[color-mix(in_srgb,var(--tg-button-color)_18%,transparent)] text-[var(--tg-button-color)]'
        }`}>
          {service.badge}
        </span>
      ) : null}
      <ServiceLogo service={service} size="md" className="mx-auto" />
      <span className="mt-3 line-clamp-2 min-h-[26px] w-full text-[11px] font-black leading-tight">{service.title}</span>
    </Link>
  );
}

function ScriptCatalogTile({ service }) {
  return (
    <Link
      to={getMiniAppServiceTarget(service)}
      className="group block rounded-[8px] border border-[var(--miniapp-border-color)] bg-[var(--tg-secondary-bg-color)] p-4 text-[var(--tg-text-color)] transition hover:bg-[var(--tg-section-bg-color)] active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <ServiceLogo service={service} size="lg" />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-base font-black tracking-[-0.025em]">{service.title}</h4>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--tg-hint-color)]">
            {service.description}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--tg-section-bg-color)] px-3 py-2 text-[11px] font-black text-[var(--tg-button-color)]">
            View Details
            <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function ServicesSection() {
  const paypal = getServiceBySlug('paypal');

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h2 className="text-3xl font-black tracking-[-0.045em] text-[var(--tg-text-color)]">Services</h2>
      </section>

      {paypal ? (
        <Link
          to={getMiniAppServiceTarget(paypal)}
          className="group flex items-center gap-4 rounded-[8px] border border-[var(--miniapp-border-color)] bg-[var(--tg-section-bg-color)] p-4 text-[var(--tg-text-color)] transition active:scale-[0.99]"
        >
          <ServiceLogo service={paypal} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-base font-black leading-tight tracking-[-0.03em] sm:text-lg">{paypal.title}</span>
              <span className="rounded-full bg-[var(--tg-button-color)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--tg-button-text-color)]">
                Available Now
              </span>
            </span>
            <span className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">PayPal invoices, payouts, transactions, webhooks, and provider status.</span>
          </span>
          <ArrowRight size={18} className="shrink-0 text-[var(--tg-button-color)] transition group-hover:translate-x-0.5" />
        </Link>
      ) : null}

      <ProviderDock />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {miniAppServiceCategories.map((category) => {
          const services = category.slugs.map((slug) => getServiceBySlug(slug)).filter(Boolean);
          if (!services.length) {
            return null;
          }

          return (
            <section key={category.title} className="rounded-[26px] bg-[var(--tg-section-bg-color)] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-black tracking-[-0.03em] text-[var(--tg-text-color)]">{category.title}</h3>
                {category.action ? (
                  <Link
                    to="/miniapp/orders"
                    className="shrink-0 rounded-full bg-[var(--tg-secondary-bg-color)] px-3 py-2 text-[11px] font-black text-[var(--tg-button-color)] transition active:scale-95"
                  >
                    {category.action}
                  </Link>
                ) : null}
              </div>
              <div className={category.featured ? 'grid gap-3' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
                {services.map((service) => (
                  category.featured
                    ? <ScriptCatalogTile key={service.slug} service={service} />
                    : <ServiceCatalogTile key={service.slug} service={service} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function unwrapProviderDashboard(payload) {
  return payload?.data || payload || {};
}

function readProviderSectionItems(section) {
  if (Array.isArray(section)) {
    return section;
  }

  return Array.isArray(section?.items) ? section.items : [];
}

function formatLiveAmount(amount, currency) {
  if (amount === undefined || amount === null || amount === '') {
    return '—';
  }

  const numericAmount = Number(amount);
  const normalizedCurrency = String(currency || '').toUpperCase();
  if (!Number.isFinite(numericAmount)) {
    return normalizedCurrency ? `${amount} ${normalizedCurrency}` : String(amount);
  }

  return normalizedCurrency
    ? formatPayPalCurrency(numericAmount, normalizedCurrency)
    : numericAmount.toFixed(2);
}

function normalizePayPalDashboardActivity(entry, index) {
  const type = String(entry?.type || entry?.resource_type || 'activity').toLowerCase();
  const label = entry?.label || entry?.data?.summary?.description || entry?.data?.summary?.recipient_email || type;
  const date = entry?.updated_at || entry?.created_at || entry?.data?.summary?.updated_at || entry?.data?.summary?.created_at;
  const status = String(entry?.status || 'Recorded')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return {
    id: entry?.id || entry?.resource_id || `${type}-${index}`,
    date: date ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : 'Date unavailable',
    type: type === 'invoice' ? 'Invoice' : type === 'payout' ? 'Payout' : 'Provider activity',
    name: label,
    amount: formatLiveAmount(entry?.amount || entry?.data?.summary?.amount, entry?.currency || entry?.data?.summary?.currency),
    status,
    category: type,
    note: entry?.data?.summary?.description || 'Provider activity loaded from Transferly records.',
    raw: entry
  };
}

function readPayPalBalance(dashboard) {
  const balanceSection = dashboard?.balances;
  const balance = balanceSection?.data || balanceSection || null;
  const available = Array.isArray(balance?.available) ? balance.available[0] : null;

  if (available) {
    return {
      amount: available.amount,
      currency: available.currency,
      status: balanceSection?.status || 'live',
      detail: balanceSection?.message || 'Provider balance snapshot loaded.'
    };
  }

  if (balance?.available_balance_cents !== undefined) {
    return {
      amount: Number(balance.available_balance_cents) / 100,
      currency: balance.currency,
      status: balanceSection?.status || 'live',
      detail: balanceSection?.message || 'Provider balance snapshot loaded.'
    };
  }

  return {
    amount: null,
    currency: '',
    status: balanceSection?.status || 'unavailable',
    detail: balanceSection?.message || 'PayPal provider balance is not available through this workspace yet.'
  };
}

function MiniAppPayPalWalletServicePage({ service }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [moneyMenuOpen, setMoneyMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeMenuPanel, setActiveMenuPanel] = useState('');
  const [paypalDashboardState, setPayPalDashboardState] = useState({ loading: true, error: '', data: null });
  const [paypalDashboardReloadKey, setPayPalDashboardReloadKey] = useState(0);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityCursor, setActivityCursor] = useState(null);
  const [activityCursorHistory, setActivityCursorHistory] = useState([]);
  const [activityReloadKey, setActivityReloadKey] = useState(0);
  const [activityPageState, setActivityPageState] = useState({ loading: false, error: '', data: null, pagination: null });
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [paymentLinkForm, setPaymentLinkForm] = useState({ name: '', price: '', currency: 'USD' });
  const [paymentLinkErrors, setPaymentLinkErrors] = useState({});
  const [paymentLinkStatus, setPaymentLinkStatus] = useState('idle');
  const [paypalOperationsTab, setPaypalOperationsTab] = useState('send');
  const [mobileMoneySheetOpen, setMobileMoneySheetOpen] = useState(false);
  const [sendPaymentForm, setSendPaymentForm] = useState({
    recipientEmail: 'sb-buyer@personal.paypal.com',
    amount: '125.00',
    currency: 'USD',
    note: 'Service test payment'
  });
  const [sendPaymentErrors, setSendPaymentErrors] = useState({});
  const [recipientLookup, setRecipientLookup] = useState({ status: 'idle', account: null, error: '' });
  const [sendPaymentStatus, setSendPaymentStatus] = useState('idle');
  const [paymentConfirmation, setPaymentConfirmation] = useState(null);
  const [trackingQuery, setTrackingQuery] = useState('PAYPAL-TXN-1001');
  const [trackingStatus, setTrackingStatus] = useState('idle');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('ALL');
  const [invoiceBuilderForm, setInvoiceBuilderForm] = useState({
    customer: 'buyer@example.com',
    itemName: 'Consulting service',
    quantity: '1',
    price: '150.00',
    description: 'Sandbox invoice item',
    note: 'Thank you for your business.'
  });
  const [payoutUploadName, setPayoutUploadName] = useState('');
  const [payoutAcknowledged, setPayoutAcknowledged] = useState(false);
  const [payoutMessageForm, setPayoutMessageForm] = useState({
    subject: 'You received a sandbox payout',
    message: 'This sandbox payout is for development and QA validation only.'
  });
  const [transactionFilter, setTransactionFilter] = useState('ALL');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [expandedTransactionId, setExpandedTransactionId] = useState('');
  const menuRef = useRef(null);
  const quickAccessRef = useRef(null);
  const performanceRef = useRef(null);
  const activityRef = useRef(null);
  const sandboxOperationsRef = useRef(null);
  const retryTimerRef = useRef(null);
  const paymentTimerRef = useRef(null);
  const recipientLookupTimerRef = useRef(null);
  const sendPaymentTimerRef = useRef(null);
  const customMailTarget = '/miniapp/studio?type=email&service=paypal&mode=custom-mail';
  const depositMailTarget = '/miniapp/studio?type=email&service=paypal&mode=deposit-mail';
  const providerTarget = '/miniapp/ops?provider=paypal';
  const paypalSubpage = useMemo(() => {
    const [, , , subpage = 'overview'] = location.pathname.split('/').filter(Boolean);
    return subpage || 'overview';
  }, [location.pathname]);
  const paypalSubpageTitle = {
    overview: 'Account overview',
    activity: 'Activity',
    'payment-links': 'Payment Links & Buttons',
    mail: 'Mail tools',
    settings: 'Account settings'
  }[paypalSubpage] || 'Account overview';
  const paypalDashboard = paypalDashboardState.data || {};
  const activityLoading = paypalDashboardState.loading || activityPageState.loading;
  const paypalBalance = useMemo(() => readPayPalBalance(paypalDashboard), [paypalDashboard]);
  const liveActivityRows = useMemo(() => {
    const entries = activityPageState.data === null
      ? readProviderSectionItems(paypalDashboard.recent_activity)
      : readProviderSectionItems(activityPageState.data);
    return entries.map(normalizePayPalDashboardActivity);
  }, [activityPageState.data, paypalDashboard.recent_activity]);
  const activityRows = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    return liveActivityRows.filter((row) => {
      const matchesType = activityFilter === 'all' || row.category === activityFilter;
      const matchesSearch = !query || [row.id, row.type, row.name, row.status, row.amount, row.note]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return matchesType && matchesSearch;
    });
  }, [activityFilter, activitySearch, liveActivityRows]);
  const liveInvoices = useMemo(() => readProviderSectionItems(paypalDashboard.recent_invoices), [paypalDashboard.recent_invoices]);
  const livePayouts = useMemo(() => readProviderSectionItems(paypalDashboard.recent_payouts), [paypalDashboard.recent_payouts]);
  const liveWebhookStatus = paypalDashboard.webhook_status || {};
  const performanceCards = useMemo(() => {
    const invoiceVolume = liveInvoices.reduce((total, invoice) => total + Number(invoice?.summary?.amount || invoice?.amount || 0), 0);
    const uniqueCustomers = new Set(liveInvoices.map((invoice) => invoice?.summary?.recipient_email).filter(Boolean)).size;
    return [
      { label: 'Recorded invoice volume', value: formatLiveAmount(invoiceVolume, liveInvoices[0]?.summary?.currency || 'USD'), detail: `${liveInvoices.length} recent invoice record(s)`, to: '/miniapp/services/paypal/invoices' },
      { label: 'Recent invoices', value: String(liveInvoices.length), detail: 'Loaded from Transferly records', to: '/miniapp/services/paypal/invoices' },
      { label: 'Known customers', value: String(uniqueCustomers), detail: 'Unique invoice recipients in this snapshot', to: '/miniapp/clients?provider=paypal' },
      { label: 'Recent payouts', value: String(livePayouts.length), detail: 'Loaded from Transferly records', to: '/miniapp/services/paypal/payouts' }
    ];
  }, [liveInvoices, livePayouts]);
  const readinessChecks = useMemo(() => {
    const health = paypalDashboard.health || paypalDashboard.provider_health || {};
    const readiness = paypalDashboard.readiness || {};
    const settings = paypalDashboard.settings || {};
    return [
      { label: 'Provider health', status: health.status || 'unknown', detail: health.message || 'PayPal provider health status is being monitored.' },
      { label: 'Environment', status: settings.environment_mode || 'sandbox', detail: 'This page is restricted to sandbox/test operations.' },
      { label: 'Webhooks', status: liveWebhookStatus.endpoint_status || settings.webhook_endpoint_status || 'unknown', detail: liveWebhookStatus.message || 'Webhook delivery and signature readiness.' },
      { label: 'Configuration', status: readiness.ready ? 'ready' : settings.status || 'needs-review', detail: settings.missing_env?.length ? `Missing: ${settings.missing_env.join(', ')}` : 'Required configuration is represented without exposing secret values.' }
    ];
  }, [liveWebhookStatus, paypalDashboard.health, paypalDashboard.readiness, paypalDashboard.settings]);
  const paypalMailMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('mode') || 'custom-mail';
  }, [location.search]);
  const generatedPaymentLink = paymentLinkForm.name.trim() && paymentLinkForm.price.trim()
    ? `transferly-paypal://${paymentLinkForm.currency.toLowerCase()}/${encodeURIComponent(paymentLinkForm.name.trim())}-${paymentLinkForm.price.trim()}`
    : 'transferly-paypal://payment-link/new';
  const sendFlowStage = paymentConfirmation ? 'Confirmation' : recipientLookup.status === 'found' ? 'Preview' : 'Send';
  const invoiceStatusOptions = useMemo(() => ['ALL', ...new Set(paypalSandboxInvoices.map((invoice) => invoice.status))], []);
  const filteredPaypalInvoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();
    return paypalSandboxInvoices.filter((invoice) => {
      const matchesStatus = invoiceStatusFilter === 'ALL' || invoice.status === invoiceStatusFilter;
      const matchesQuery = !query || [invoice.id, invoice.customer, invoice.email, invoice.reference]
        .some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [invoiceSearch, invoiceStatusFilter]);
  const transactionFilterOptions = useMemo(() => ['ALL', ...new Set(paypalSandboxTransactions.map((transaction) => transaction.status))], []);
  const filteredPaypalTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();
    return paypalSandboxTransactions.filter((transaction) => {
      const matchesStatus = transactionFilter === 'ALL' || transaction.status === transactionFilter;
      const matchesQuery = !query || [
        transaction.id,
        transaction.type,
        transaction.party,
        transaction.email,
        transaction.reference,
        transaction.source
      ].some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [transactionFilter, transactionSearch]);
  const invoiceBuilderTotal = Number(invoiceBuilderForm.quantity || 0) * Number(invoiceBuilderForm.price || 0);

  useEffect(() => {
    let cancelled = false;
    setPayPalDashboardState((current) => ({ ...current, loading: true, error: '' }));

    getProviderDashboard('paypal')
      .then((payload) => {
        if (!cancelled) {
          setPayPalDashboardState({ loading: false, error: '', data: unwrapProviderDashboard(payload) });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPayPalDashboardState({
            loading: false,
            error: error?.message || 'PayPal sandbox data could not be loaded.',
            data: null
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [paypalDashboardReloadKey]);

  useEffect(() => {
    const shouldLoadActivityPage = activityFilter !== 'all' || Boolean(activitySearch.trim()) || Boolean(activityCursor);
    if (!shouldLoadActivityPage) {
      setActivityPageState({ loading: false, error: '', data: null, pagination: null });
      return undefined;
    }

    let cancelled = false;
    const debounceTimer = window.setTimeout(() => {
      setActivityPageState((current) => ({ ...current, loading: true, error: '' }));
      getProviderResource('paypal', 'activity', {
        type: activityFilter,
        cursor: activityCursor || undefined,
        limit: 25
      })
        .then((payload) => {
          if (!cancelled) {
            setActivityPageState({
              loading: false,
              error: '',
              data: payload?.data || [],
              pagination: payload?.pagination || null
            });
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setActivityPageState((current) => ({
              ...current,
              loading: false,
              error: error?.message || 'PayPal activity could not be loaded.'
            }));
          }
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
    };
  }, [activityCursor, activityFilter, activityReloadKey, activitySearch]);

  useEffect(() => {
    setMenuOpen(false);
    setCreateMenuOpen(false);
    setMoneyMenuOpen(false);
    setNotificationsOpen(false);
    setActiveMenuPanel('');
    setLanguageMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => () => {
    window.clearTimeout(retryTimerRef.current);
    window.clearTimeout(paymentTimerRef.current);
    window.clearTimeout(recipientLookupTimerRef.current);
    window.clearTimeout(sendPaymentTimerRef.current);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setCreateMenuOpen(false);
        setActiveMenuPanel('');
      }
    };

    const handlePointerDown = (event) => {
      if (event.target.closest?.('[data-paypal-menu-control="true"]')) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
        setCreateMenuOpen(false);
        setActiveMenuPanel('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [menuOpen]);

  const scrollStrip = (ref, direction) => {
    ref.current?.scrollBy({ left: direction * 260, behavior: 'smooth' });
  };

  const retryPayPalDashboard = () => {
    setPayPalDashboardReloadKey((value) => value + 1);
  };

  const openSandboxOperation = (tab) => {
    setPaypalOperationsTab(tab);
    setMobileMoneySheetOpen(false);
    window.requestAnimationFrame(() => sandboxOperationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const updatePaymentLinkField = (field, value) => {
    setPaymentLinkForm((current) => ({ ...current, [field]: value }));
    setPaymentLinkErrors((current) => ({ ...current, [field]: '' }));
    setPaymentLinkStatus('idle');
  };

  const buildPaymentLink = (event) => {
    event.preventDefault();

    const errors = {};
    const numericPrice = Number(paymentLinkForm.price);
    if (!paymentLinkForm.name.trim()) {
      errors.name = 'Enter a product or service name.';
    }
    if (!paymentLinkForm.price.trim() || Number.isNaN(numericPrice) || numericPrice <= 0) {
      errors.price = 'Enter an amount greater than 0.';
    }

    if (Object.keys(errors).length) {
      setPaymentLinkErrors(errors);
      setPaymentLinkStatus('error');
      return;
    }

    setPaymentLinkStatus('building');
    window.clearTimeout(paymentTimerRef.current);
    paymentTimerRef.current = window.setTimeout(() => {
      setPaymentLinkStatus('success');
    }, 500);
  };

  const copyGeneratedPaymentLink = async () => {
    try {
      await navigator.clipboard?.writeText(generatedPaymentLink);
      toast.success('Payment link copied');
    } catch {
      toast.success('Payment link ready');
    }
  };

  const updateSendPaymentField = (field, value) => {
    setSendPaymentForm((current) => ({ ...current, [field]: value }));
    setSendPaymentErrors((current) => ({ ...current, [field]: '' }));
    setSendPaymentStatus('idle');
    setPaymentConfirmation(null);

    if (field === 'recipientEmail') {
      setRecipientLookup({ status: 'idle', account: null, error: '' });
    }
  };

  const lookupRecipientAccount = () => {
    const recipientEmail = sendPaymentForm.recipientEmail.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      setRecipientLookup({ status: 'error', account: null, error: 'Enter a valid recipient email address.' });
      setSendPaymentErrors((current) => ({ ...current, recipientEmail: 'Enter a valid recipient email address.' }));
      return null;
    }

    setRecipientLookup({ status: 'loading', account: null, error: '' });
    window.clearTimeout(recipientLookupTimerRef.current);
    recipientLookupTimerRef.current = window.setTimeout(() => {
      const account = findPayPalSandboxRecipient(recipientEmail);
      if (account) {
        setRecipientLookup({ status: 'found', account, error: '' });
        setSendPaymentErrors((current) => ({ ...current, recipientEmail: '' }));
      } else {
        setRecipientLookup({
          status: 'error',
          account: null,
          error: 'No sandbox account matches this recipient. Try sb-buyer@personal.paypal.com.'
        });
      }
    }, 450);

    return null;
  };

  const sendSandboxPayment = (event) => {
    event.preventDefault();

    const errors = {};
    const amount = Number(sendPaymentForm.amount);
    const recipientEmail = sendPaymentForm.recipientEmail.trim();
    const recipient = recipientLookup.account || findPayPalSandboxRecipient(recipientEmail);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      errors.recipientEmail = 'Enter a valid recipient email address.';
    }
    if (!sendPaymentForm.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      errors.amount = 'Enter an amount greater than 0.';
    }
    if (amount > paypalSandboxSenderAccount.balance) {
      errors.amount = 'Amount exceeds the available sandbox account balance.';
    }
    if (!recipient) {
      errors.recipientEmail = 'Validate a known sandbox recipient before sending.';
    }

    if (Object.keys(errors).length) {
      setSendPaymentErrors(errors);
      setSendPaymentStatus('error');
      if (!recipient) {
        lookupRecipientAccount();
      }
      return;
    }

    setRecipientLookup({ status: 'found', account: recipient, error: '' });
    setSendPaymentStatus('processing');
    window.clearTimeout(sendPaymentTimerRef.current);
    sendPaymentTimerRef.current = window.setTimeout(() => {
      const transactionId = createPayPalSandboxReference('PAYPAL-TXN');
      const confirmation = {
        transactionId,
        reference: createPayPalSandboxReference('REF'),
        payoutBatchId: createPayPalSandboxReference('BATCH'),
        payoutItemId: createPayPalSandboxReference('ITEM'),
        createdAt: new Intl.DateTimeFormat('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(new Date()),
        status: 'Completed',
        amount,
        currency: sendPaymentForm.currency,
        note: sendPaymentForm.note.trim() || 'Sandbox payment',
        sender: paypalSandboxSenderAccount,
        receiver: recipient
      };
      setPaymentConfirmation(confirmation);
      setTrackingQuery(transactionId);
      setSendPaymentStatus('success');
      toast.success('Sandbox payment completed');
    }, 700);
  };

  const trackSandboxTransaction = (event) => {
    event.preventDefault();

    if (!trackingQuery.trim()) {
      setTrackingStatus('error');
      return;
    }

    setTrackingStatus('loading');
    window.setTimeout(() => {
      setTrackingStatus('found');
    }, 350);
  };

  const updateInvoiceBuilderField = (field, value) => {
    setInvoiceBuilderForm((current) => ({ ...current, [field]: value }));
  };

  const submitSandboxInvoice = (event) => {
    event.preventDefault();
    toast.success('Sandbox invoice draft ready');
  };

  const downloadSandboxInvoiceCsv = () => {
    const rows = [
      'invoice,customer,email,status,amount,currency,due',
      ...paypalSandboxInvoices.map((invoice) => (
        [invoice.id, invoice.customer, invoice.email, invoice.status, invoice.amount, invoice.currency, invoice.due].join(',')
      ))
    ];
    downloadBlob(new Blob([rows.join('\n')], { type: 'text/csv' }), 'paypal-sandbox-invoices.csv');
  };

  const updatePayoutMessageField = (field, value) => {
    setPayoutMessageForm((current) => ({ ...current, [field]: value }));
  };

  const chooseSandboxPayoutFile = () => {
    setPayoutUploadName('paypal-sandbox-payouts.csv');
  };

  const downloadSandboxPayoutSample = () => {
    downloadBlob(
      new Blob(['email,amount,currency,note\nrecipient@example.com,75.00,USD,Sandbox payout item'], { type: 'text/csv' }),
      'paypal-sandbox-payout-sample.csv'
    );
  };

  const submitSandboxPayoutFile = (event) => {
    event.preventDefault();
    if (!payoutAcknowledged) {
      toast.error('Confirm sandbox payout acknowledgement first');
      return;
    }
    toast.success('Sandbox payout batch queued');
  };

  const downloadSandboxTransactionCsv = () => {
    const rows = [
      'transaction,date,type,party,email,status,amount,currency,reference,source',
      ...paypalSandboxTransactions.map((transaction) => (
        [
          transaction.id,
          transaction.date,
          transaction.type,
          transaction.party,
          transaction.email,
          transaction.status,
          transaction.amount,
          transaction.currency,
          transaction.reference,
          transaction.source
        ].join(',')
      ))
    ];
    downloadBlob(new Blob([rows.join('\n')], { type: 'text/csv' }), 'paypal-sandbox-transactions.csv');
  };

  return (
    <div className="min-h-screen bg-white text-[#0c0c0d]">
      <header className="sticky top-0 z-40 border-b border-[#d6d9dc] bg-white">
        <div className="mx-auto flex h-[76px] max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/miniapp/services/paypal" className="flex items-center gap-4 text-[#001c64]" aria-label="PayPal home page">
            <ServiceLogo service={service} size="md" />
            <span className="hidden h-7 w-px bg-[#d6d9dc] sm:block" aria-hidden="true" />
            <span className="text-[22px] font-bold text-[#2c2e2f]">Business Account</span>
          </Link>

          <div className="relative flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative grid h-11 w-11 place-items-center rounded-full text-[#2c2e2f] transition hover:bg-[#f5f7fa] active:scale-95"
              aria-label="Notifications 0"
              aria-expanded={notificationsOpen}
              aria-controls="paypal-notifications-popover"
            >
              <Bell size={21} strokeWidth={2.2} />
              <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#0070e0] px-1 text-[11px] font-bold text-white">
                0
              </span>
            </button>
            {notificationsOpen ? (
              <div
                id="paypal-notifications-popover"
                className="absolute right-0 top-[52px] z-50 w-[min(88vw,340px)] rounded-xl border border-[#d6d9dc] bg-white p-4 text-left shadow-[0_18px_42px_rgba(0,0,0,0.16)]"
                role="status"
              >
                <p className="text-base font-bold text-[#0c0c0d]">Notifications</p>
                <div className="mt-4 rounded-lg border border-dashed border-[#c6cbd1] bg-[#f7f9fa] px-4 py-5 text-center">
                  <Bell size={22} className="mx-auto text-[#687173]" />
                  <p className="mt-2 text-sm font-bold text-[#2c2e2f]">You are all caught up.</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#687173]">
                    New payment, link, and mail updates will appear here.
                  </p>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              data-paypal-menu-control="true"
              onClick={() => {
                setMenuOpen((open) => {
                  if (open) {
                    setCreateMenuOpen(false);
                    setActiveMenuPanel('');
                  }
                  return !open;
                });
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#c6cbd1] px-4 text-sm font-bold text-[#003087] transition hover:border-[#003087] hover:bg-[#f5f7fa] active:scale-95"
              aria-expanded={menuOpen}
              aria-controls="paypal-wallet-menu"
            >
              Menu
              <ChevronDown size={16} className={menuOpen ? 'rotate-180 transition' : 'transition'} />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="absolute left-0 right-0 top-[76px] z-50 px-4 sm:px-6">
            <div className="mx-auto flex max-w-[1180px] justify-end">
              <div
                ref={menuRef}
                id="paypal-wallet-menu"
                className="relative max-h-[calc(100vh-96px)] w-full max-w-[410px] overflow-y-auto rounded-b-2xl border border-t-0 border-[#d6d9dc] bg-white p-2 shadow-[0_18px_45px_rgba(0,0,0,0.18)]"
              >
                <button
                  type="button"
                  onClick={() => setCreateMenuOpen((open) => !open)}
                  className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-[15px] font-bold text-[#0c0c0d] transition hover:bg-[#f5f7fa]"
                  aria-expanded={createMenuOpen}
                  aria-controls="paypal-wallet-create-menu"
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eef6ff] text-[#0070e0]">
                      <Plus size={18} />
                    </span>
                    Create
                  </span>
                  <ChevronDown size={17} className={createMenuOpen ? 'rotate-180 transition' : 'transition'} />
                </button>

                {createMenuOpen ? (
                  <div
                    id="paypal-wallet-create-menu"
                    className="mb-2 rounded-xl border border-[#e0e3e7] bg-white p-2 shadow-[0_12px_28px_rgba(0,0,0,0.12)] sm:absolute sm:right-full sm:top-2 sm:mr-3 sm:w-72"
                  >
                    {paypalWalletCreateItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.label}
                          to={item.to}
                          className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-bold text-[#0c0c0d] transition hover:bg-[#f5f7fa]"
                        >
                          <Icon size={18} className="text-[#687173]" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}

                <nav className="mt-1 grid gap-0.5" aria-label="PayPal service navigation">
                  {paypalWalletMenuItems.map((item) => {
                    const Icon = item.icon;
                    const panelItems = paypalWalletMenuPanels[item.label] || [];
                    if (item.hasPanel) {
                      return (
                        <div key={item.label} className="rounded-lg">
                          <button
                            type="button"
                            onClick={() => setActiveMenuPanel((panel) => (panel === item.label ? '' : item.label))}
                            className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-[15px] font-bold text-[#0c0c0d] transition hover:bg-[#f5f7fa]"
                            aria-expanded={activeMenuPanel === item.label}
                          >
                            <span className="inline-flex min-w-0 items-center gap-3">
                              <Icon size={18} className="shrink-0 text-[#687173]" />
                              <span className="truncate">{item.label}</span>
                            </span>
                            <ChevronDown size={16} className={activeMenuPanel === item.label ? 'rotate-180 text-[#687173] transition' : 'text-[#687173] transition'} />
                          </button>
                          {activeMenuPanel === item.label ? (
                            <div className="ml-11 mr-2 grid gap-1 border-l border-[#e0e3e7] py-1 pl-3">
                              <Link
                                to={item.to}
                                className="rounded-md px-3 py-2 text-sm font-bold text-[#003087] transition hover:bg-[#f5f7fa]"
                              >
                                {item.label} overview
                              </Link>
                              {panelItems.map((panelItem) => (
                                <Link
                                  key={panelItem.label}
                                  to={panelItem.to}
                                  className="rounded-md px-3 py-2 text-sm font-semibold text-[#2c2e2f] transition hover:bg-[#f5f7fa] hover:text-[#003087]"
                                >
                                  {panelItem.label}
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        className="flex items-center justify-between rounded-lg px-4 py-3 text-[15px] font-bold text-[#0c0c0d] transition hover:bg-[#f5f7fa]"
                      >
                        <span className="inline-flex min-w-0 items-center gap-3">
                          <Icon size={18} className="shrink-0 text-[#687173]" />
                          <span className="truncate">{item.label}</span>
                        </span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-2 border-t border-[#e0e3e7] pt-2">
                  <p className="px-4 py-2 text-[12px] font-bold text-[#687173]">Transferly service tools</p>
                  {paypalWalletMailTasks.map((task) => (
                    <Link
                      key={task.label}
                      to={task.to}
                      className="flex items-center justify-between rounded-lg px-4 py-2.5 text-[14px] font-bold text-[#003087] transition hover:bg-[#f5f7fa]"
                    >
                      {task.label}
                      <span className="rounded-full bg-[#eef6ff] px-2 py-0.5 text-[10px] font-bold text-[#0070e0]">
                        {task.badge}
                      </span>
                    </Link>
                  ))}
                </div>

                <div className="mt-2 border-t border-[#e0e3e7] pt-2">
                  {paypalWalletDeveloperTasks.map((task) => (
                    <Link
                      key={task.label}
                      to={task.to}
                      className="block rounded-lg px-4 py-2.5 text-[14px] font-bold text-[#003087] transition hover:bg-[#f5f7fa]"
                    >
                      {task.label}
                    </Link>
                  ))}
                  <Link
                    to="/miniapp"
                    className="mt-1 flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] font-bold text-[#0c0c0d] transition hover:bg-[#f5f7fa]"
                  >
                    <ArrowLeft size={18} className="text-[#687173]" />
                    Back to Transferly
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:py-10">
        <section
          className={`mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4 ${paypalDashboardState.error ? 'border-[#f0c6bd] bg-[#fff7f5]' : 'border-[#b8d8fb] bg-[#eef6ff]'}`}
          role={paypalDashboardState.error ? 'alert' : 'status'}
          aria-label="PayPal dashboard status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {paypalDashboardState.error ? <AlertCircle size={20} className="mt-0.5 shrink-0 text-[#8f2b0f]" /> : <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#0070e0]" />}
            <div>
              <p className="text-sm font-bold text-[#003087]">
                {paypalDashboardState.loading ? 'Loading PayPal sandbox dashboard' : paypalDashboardState.error ? 'PayPal sandbox data is unavailable' : 'Live PayPal sandbox snapshot'}
              </p>
              <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#687173]">
                {paypalDashboardState.loading
                  ? 'Loading provider activity, invoice, payout, webhook, and readiness data from Transferly.'
                  : paypalDashboardState.error
                    ? paypalDashboardState.error
                    : 'Provider records are shown for sandbox operations. Transferly ledger data remains the source of truth for internal balances and release decisions.'}
              </p>
            </div>
          </div>
          {paypalDashboardState.error ? (
            <button
              type="button"
              onClick={retryPayPalDashboard}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#0070e0] px-4 text-sm font-bold text-white transition hover:bg-[#003087]"
            >
              <RefreshCw size={15} />
              Retry
            </button>
          ) : null}
        </section>
        <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="w-full min-w-0 max-w-full overflow-hidden">
            <div className="relative w-full min-w-0 max-w-full">
              <div className="flex w-full min-w-0 flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex items-end gap-3">
                    <h1 className="text-[44px] font-bold leading-none text-[#0c0c0d] sm:text-[54px]">
                      {paypalDashboardState.loading ? 'Loading…' : paypalBalance.amount === null ? 'Unavailable' : formatLiveAmount(paypalBalance.amount, paypalBalance.currency)}
                    </h1>
                    <p className="pb-1 text-2xl font-bold text-[#0c0c0d]">{paypalBalance.currency || '—'}</p>
                  </div>
                  <p className="mt-3 text-[15px] font-semibold text-[#687173]">PayPal provider balance</p>
                  <p className="mt-1 max-w-xl text-xs font-semibold leading-5 text-[#687173]">{paypalBalance.detail}</p>
                  <p className="mt-2 inline-flex rounded-full bg-[#eef6ff] px-3 py-1 text-[12px] font-bold text-[#003087]">
                    {paypalSubpageTitle}
                  </p>
                </div>

                <div className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileMoneySheetOpen(true)}
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-[#0070e0] px-5 text-[15px] font-bold text-[#0070e0] transition hover:bg-[#f5faff] active:scale-95 md:hidden"
                    aria-haspopup="dialog"
                    aria-expanded={mobileMoneySheetOpen}
                  >
                    Manage money
                    <ChevronDown size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoneyMenuOpen((open) => !open)}
                    className="hidden h-12 items-center gap-2 rounded-full border border-[#0070e0] px-5 text-[15px] font-bold text-[#0070e0] transition hover:bg-[#f5faff] active:scale-95 md:inline-flex"
                    aria-expanded={moneyMenuOpen}
                  >
                    Manage money
                    <ChevronDown size={17} className={moneyMenuOpen ? 'rotate-180 transition' : 'transition'} />
                  </button>

                  {moneyMenuOpen ? (
                    <div className="absolute right-0 top-14 z-20 w-64 rounded-xl border border-[#d6d9dc] bg-white p-2 shadow-[0_18px_42px_rgba(0,0,0,0.16)]">
                      <Link to="/miniapp/wallet?service=paypal" className="block rounded-lg px-3 py-2 text-sm font-bold text-[#003087] hover:bg-[#f5f7fa]">
                        Transfer to bank
                      </Link>
                      <Link to={providerTarget} className="block rounded-lg px-3 py-2 text-sm font-bold text-[#003087] hover:bg-[#f5f7fa]">
                        Manage currencies
                      </Link>
                      <Link to="/miniapp/services/paypal/transactions" className="block rounded-lg px-3 py-2 text-sm font-bold text-[#003087] hover:bg-[#f5f7fa]">
                        View activity
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <section className="mt-12 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-[#0c0c0d]">Quick access</h2>
                <button type="button" className="inline-flex items-center gap-2 text-sm font-bold text-[#0070e0] hover:underline">
                  <Settings size={16} />
                  Edit your quick links
                </button>
              </div>
              <div className="mt-5 flex max-w-full items-center gap-3 overflow-hidden">
                <button
                  type="button"
                  onClick={() => scrollStrip(quickAccessRef, -1)}
                  className="hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d6d9dc] text-[#003087] transition hover:bg-[#f5f7fa] md:grid"
                  aria-label="Scroll quick access left"
                >
                  <ArrowLeft size={17} />
                </button>
                <div ref={quickAccessRef} className="flex min-w-0 flex-1 gap-4 overflow-x-auto pb-3" aria-label="Quick access">
                {paypalWalletQuickAccessItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      className="group flex min-h-[132px] w-[138px] shrink-0 flex-col items-center justify-center rounded-xl border border-[#e0e3e7] bg-white px-3 py-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition hover:border-[#0070e0] hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)] active:scale-[0.98]"
                    >
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eef6ff] text-[#0070e0] transition group-hover:bg-[#0070e0] group-hover:text-white">
                        <Icon size={22} />
                      </span>
                      <span className="mt-3 text-[13px] font-bold leading-4 text-[#003087]">{item.label}</span>
                    </Link>
                  );
                })}
                </div>
                <button
                  type="button"
                  onClick={() => scrollStrip(quickAccessRef, 1)}
                  className="my-auto hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d6d9dc] text-[#003087] transition hover:bg-[#f5f7fa] md:grid"
                  aria-label="Scroll quick access right"
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </section>

            <section ref={activityRef} className="mt-10 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-[#0c0c0d]">Business Performance</h2>
                  <p className="mt-1 text-sm font-semibold text-[#687173]">All comparisons to previous 30 days</p>
                </div>
                <Link to="/miniapp/analytics?provider=paypal" className="text-sm font-bold text-[#0070e0] hover:underline">
                  View more
                </Link>
              </div>
              <div className="mt-5 flex max-w-full items-center gap-3 overflow-hidden">
                <button
                  type="button"
                  onClick={() => scrollStrip(performanceRef, -1)}
                  className="hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d6d9dc] text-[#003087] transition hover:bg-[#f5f7fa] md:grid"
                  aria-label="Scroll business performance left"
                >
                  <ArrowLeft size={17} />
                </button>
                <div ref={performanceRef} className="flex min-w-0 flex-1 gap-4 overflow-x-auto pb-3">
                {performanceCards.map((card) => (
                    <article key={card.label} className="min-h-[154px] w-[230px] shrink-0 rounded-xl border border-[#e0e3e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                      <Link to={card.to} className="text-sm font-bold leading-5 text-[#003087] hover:underline">
                        {card.label}
                      </Link>
                      {paypalDashboardState.loading ? (
                        <div className="mt-4 animate-pulse space-y-2" aria-label="Loading performance metric">
                          <div className="h-7 w-24 rounded bg-[#e6ebf0]" />
                          <div className="h-4 w-36 rounded bg-[#e6ebf0]" />
                        </div>
                      ) : paypalDashboardState.error ? (
                        <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#fff7f5] p-3 text-[#8f2b0f]" role="alert">
                          <AlertCircle size={17} className="mt-0.5 shrink-0" />
                          <p className="text-[13px] font-semibold leading-5">Metric unavailable</p>
                        </div>
                      ) : (
                        <div className="mt-4">
                          <p className="text-2xl font-bold text-[#0c0c0d]">{card.value}</p>
                          <p className="mt-2 text-[12px] font-semibold leading-5 text-[#687173]">{card.detail}</p>
                        </div>
                      )}
                    </article>
                ))}
                </div>
                <button
                  type="button"
                  onClick={() => scrollStrip(performanceRef, 1)}
                  className="my-auto hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d6d9dc] text-[#003087] transition hover:bg-[#f5f7fa] md:grid"
                  aria-label="Scroll business performance right"
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </section>

            <section className="mt-10 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-[#0c0c0d]">Recent activity</h2>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Activity filters">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'invoice', label: 'Invoices' },
                      { id: 'payout', label: 'Payouts' }
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => {
                          setActivityFilter(filter.id);
                          setSelectedActivity(null);
                          setActivityCursor(null);
                          setActivityCursorHistory([]);
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          activityFilter === filter.id
                            ? 'border-[#0070e0] bg-[#eef6ff] text-[#003087]'
                            : 'border-[#d6d9dc] text-[#687173] hover:border-[#0070e0] hover:text-[#003087]'
                        }`}
                        aria-pressed={activityFilter === filter.id}
                      >
                        {filter.label}
                      </button>
                    ))}
                    <label className="min-w-[220px] flex-1 sm:max-w-[320px]">
                      <span className="sr-only">Search PayPal activity</span>
                      <input
                        type="search"
                        value={activitySearch}
                        onChange={(event) => {
                          setActivitySearch(event.target.value);
                          setSelectedActivity(null);
                          setActivityCursor(null);
                          setActivityCursorHistory([]);
                        }}
                        placeholder="Search PayPal activity"
                        className="h-9 w-full rounded-full border border-[#d6d9dc] px-4 text-xs font-semibold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                      />
                    </label>
                  </div>
                </div>
                <Link to="/miniapp/services/paypal/transactions" className="text-sm font-bold text-[#0070e0] hover:underline">
                  View Activity
                </Link>
              </div>
              <div className="mt-4 hidden overflow-x-auto overflow-y-hidden rounded-xl border border-[#e0e3e7] bg-white md:block">
                <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
                  <tbody>
                    {activityLoading ? (
                      <tr>
                        <td colSpan="5" className="px-5 py-8 text-center text-sm font-semibold text-[#687173]">Loading PayPal activity…</td>
                      </tr>
                    ) : activityRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedActivity(row)}
                        className="cursor-pointer font-semibold text-[#0c0c0d] transition hover:bg-[#f8f9fb]"
                      >
                        <td className="border-b border-[#edf0f2] px-5 py-4 text-[#687173]">{row.date}</td>
                        <td className="border-b border-[#edf0f2] px-5 py-4">{row.type}</td>
                        <td className="border-b border-[#edf0f2] px-5 py-4">{row.name}</td>
                        <td className="border-b border-[#edf0f2] px-5 py-4">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                            row.status === 'Completed' ? 'bg-[#e8f8f0] text-[#137333]' : 'bg-[#fff6e5] text-[#8a5300]'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="border-b border-[#edf0f2] px-5 py-4 text-right font-bold">{row.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 md:hidden" aria-label="PayPal activity cards">
                {activityLoading ? (
                  <div className="rounded-xl border border-[#e0e3e7] bg-white px-5 py-8 text-center text-sm font-semibold text-[#687173]">Loading PayPal activity…</div>
                ) : activityRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedActivity(row)}
                    className="w-full rounded-xl border border-[#e0e3e7] bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition hover:border-[#0070e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070e0]"
                    aria-label={`View ${row.type} ${row.name}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#687173]">{row.type}</p>
                        <p className="mt-1 truncate text-sm font-bold text-[#0c0c0d]">{row.name}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                        row.status === 'Completed' ? 'bg-[#e8f8f0] text-[#137333]' : 'bg-[#fff6e5] text-[#8a5300]'
                      }`}>
                        {row.status}
                      </span>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <span className="text-xs font-semibold text-[#687173]">{row.date}</span>
                      <span className="text-sm font-bold text-[#0c0c0d]">{row.amount}</span>
                    </div>
                  </button>
                ))}
              </div>
              {!activityLoading && !activityPageState.error && !paypalDashboardState.error && !activityRows.length ? (
                <div className="mt-4 rounded-xl border border-[#e0e3e7] bg-white px-5 py-8 text-center">
                  <Activity size={24} className="mx-auto text-[#687173]" />
                  <p className="mt-3 text-sm font-bold text-[#2c2e2f]">No PayPal activity matches this view.</p>
                  <p className="mt-1 text-xs font-semibold text-[#687173]">Try another filter or clear the search.</p>
                </div>
              ) : null}
              {activityPageState.error ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f0c6bd] bg-[#fff7f5] p-4" role="alert">
                  <p className="text-sm font-semibold text-[#8f2b0f]">{activityPageState.error}</p>
                  <button
                    type="button"
                    onClick={() => setActivityReloadKey((value) => value + 1)}
                    className="text-sm font-bold text-[#0070e0] hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {activityPageState.pagination ? (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-sm font-bold text-[#003087]" aria-label="PayPal activity pagination">
                  <button
                    type="button"
                    disabled={!activityCursorHistory.length || activityLoading}
                    onClick={() => {
                      const previousCursor = activityCursorHistory[activityCursorHistory.length - 1] || null;
                      setActivityCursorHistory((history) => history.slice(0, -1));
                      setActivityCursor(previousCursor);
                    }}
                    className="rounded-full border border-[#d6d9dc] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[#687173]">{activityPageState.pagination.returned || 0} record(s)</span>
                  <button
                    type="button"
                    disabled={!activityPageState.pagination.has_next_page || activityLoading}
                    onClick={() => {
                      setActivityCursorHistory((history) => [...history, activityCursor]);
                      setActivityCursor(activityPageState.pagination.next_cursor || null);
                    }}
                    className="rounded-full border border-[#0070e0] px-4 py-2 text-[#0070e0] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}
              {selectedActivity ? (
                <div className="mt-4 rounded-xl border border-[#d6d9dc] bg-[#f7f9fa] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-[#687173]">{selectedActivity.date}</p>
                      <h3 className="mt-1 text-lg font-bold text-[#0c0c0d]">{selectedActivity.type} {selectedActivity.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedActivity(null)}
                      className="grid h-8 w-8 place-items-center rounded-full text-[#687173] transition hover:bg-white hover:text-[#0c0c0d]"
                      aria-label="Close activity details"
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[#687173]">{selectedActivity.note}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-base font-bold text-[#0c0c0d]">{selectedActivity.amount}</span>
                    <Link to="/miniapp/services/paypal/transactions" className="text-sm font-bold text-[#0070e0] hover:underline">
                      Open details
                    </Link>
                  </div>
                </div>
              ) : null}
            </section>

            <section ref={sandboxOperationsRef} className="mt-10 min-w-0 rounded-xl border border-[#e0e3e7] bg-[#f7f9fa] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase text-[#687173]">Sandbox operations</p>
                  <h2 className="mt-2 text-2xl font-bold text-[#0c0c0d]">Payments, invoices, payouts, and tracking</h2>
                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#687173]">
                    Run PayPal-style test flows with validated sender and receiver details, transaction references, and confirmation exports.
                  </p>
                </div>
                <span className="rounded-full bg-[#fff6e5] px-3 py-1 text-xs font-bold text-[#8a5300]">
                  Sandbox / test money only
                </span>
              </div>

              <div className="mt-5 rounded-xl border border-[#d6d9dc] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#0c0c0d]">Sandbox API readiness</p>
                    <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#687173]">
                    The readiness cards below are sourced from the current Transferly PayPal provider response. Secret values and raw provider payloads are never rendered here.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#e8f8f0] px-3 py-1 text-xs font-bold text-[#137333]">
                    Test environment
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {readinessChecks.map((check) => (
                    <article key={check.label} className="rounded-lg border border-[#e0e3e7] bg-[#f7f9fa] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#0c0c0d]">{check.label}</p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#003087]">
                          {check.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-5 text-[#687173]">{check.detail}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="PayPal sandbox operations">
                {paypalOperationTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = paypalOperationsTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPaypalOperationsTab(tab.id)}
                      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${
                        isActive
                          ? 'border-[#0070e0] bg-[#0070e0] text-white'
                          : 'border-[#d6d9dc] bg-white text-[#003087] hover:border-[#0070e0]'
                      }`}
                      role="tab"
                      aria-selected={isActive}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {paypalOperationsTab === 'send' ? (
                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
                  <form onSubmit={sendSandboxPayment} className="min-w-0 rounded-xl border border-[#e0e3e7] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-[#0c0c0d]">Send sandbox payment</h3>
                        <p className="mt-2 text-sm font-semibold leading-6 text-[#687173]">
                          Validate a recipient account, review the payment route, then complete a sandbox-only payment.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-bold text-[#003087]">
                        OAuth + payouts flow
                      </span>
                    </div>

                    <div className="mt-5 flex gap-2 overflow-x-auto border-b border-[#e0e3e7] pb-3" aria-label="Send money navigation">
                      {paypalSendNavigationTabs.map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          className={`h-9 shrink-0 rounded-full px-4 text-sm font-bold transition ${
                            tab === 'Send'
                              ? 'bg-[#0070e0] text-white'
                              : 'bg-[#f5f7fa] text-[#003087] hover:bg-[#eef6ff]'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Payment flow steps">
                      {['Send', 'Preview', 'Confirmation'].map((step, index) => {
                        const currentIndex = ['Send', 'Preview', 'Confirmation'].indexOf(sendFlowStage);
                        const isActive = sendFlowStage === step;
                        const isComplete = index < currentIndex;
                        return (
                          <div
                            key={step}
                            className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                              isActive || isComplete
                                ? 'border-[#0070e0] bg-[#eef6ff] text-[#003087]'
                                : 'border-[#e0e3e7] bg-[#f7f9fa] text-[#687173]'
                            }`}
                          >
                            <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-white text-[11px]">
                              {isComplete ? 'OK' : index + 1}
                            </span>
                            {step}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 grid gap-4">
                      <label className="block">
                        <span className="text-sm font-bold text-[#2c2e2f]">Recipient email</span>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                          <input
                            type="email"
                            value={sendPaymentForm.recipientEmail}
                            onChange={(event) => updateSendPaymentField('recipientEmail', event.target.value)}
                            aria-invalid={Boolean(sendPaymentErrors.recipientEmail)}
                            aria-describedby={sendPaymentErrors.recipientEmail ? 'paypal-send-recipient-error' : undefined}
                            className="h-12 min-w-0 rounded border border-[#92979d] bg-white px-3 text-base font-semibold text-[#0c0c0d] outline-none transition focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                          />
                          <button
                            type="button"
                            onClick={lookupRecipientAccount}
                            disabled={recipientLookup.status === 'loading'}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#0070e0] px-4 text-sm font-bold text-[#0070e0] transition hover:bg-[#f5faff] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {recipientLookup.status === 'loading' ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
                            Validate
                          </button>
                        </div>
                        {sendPaymentErrors.recipientEmail ? (
                          <span id="paypal-send-recipient-error" className="mt-1 block text-xs font-bold text-[#8f2b0f]" role="alert">
                            {sendPaymentErrors.recipientEmail}
                          </span>
                        ) : null}
                      </label>

                      {recipientLookup.status === 'found' && recipientLookup.account ? (
                        <div className="rounded-xl border border-[#bfe6cf] bg-[#f2fbf6] p-4" role="status">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[#137333]" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#0c0c0d]">{recipientLookup.account.name}</p>
                              <p className="mt-1 break-all text-xs font-semibold leading-5 text-[#687173]">
                                {recipientLookup.account.email} · {recipientLookup.account.accountType} · {recipientLookup.account.status}
                              </p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-[#687173]">
                                Account ID {recipientLookup.account.accountId} · {recipientLookup.account.route}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {recipientLookup.status === 'error' && recipientLookup.error ? (
                        <div className="rounded-xl border border-[#f4c7bd] bg-[#fff7f5] p-4 text-sm font-bold text-[#8f2b0f]" role="alert">
                          {recipientLookup.error}
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                        <label className="block min-w-0">
                          <span className="text-sm font-bold text-[#2c2e2f]">Amount</span>
                          <div className="mt-2 flex h-12 overflow-hidden rounded border border-[#92979d] bg-white focus-within:border-[#0070e0] focus-within:ring-2 focus-within:ring-[#0070e0]/20">
                            <span className="grid w-10 place-items-center text-base font-bold text-[#687173]">$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={sendPaymentForm.amount}
                              onChange={(event) => updateSendPaymentField('amount', event.target.value)}
                              aria-invalid={Boolean(sendPaymentErrors.amount)}
                              aria-describedby={sendPaymentErrors.amount ? 'paypal-send-amount-error' : undefined}
                              className="min-w-0 flex-1 border-0 px-0 text-base font-semibold text-[#0c0c0d] outline-none"
                            />
                          </div>
                          {sendPaymentErrors.amount ? (
                            <span id="paypal-send-amount-error" className="mt-1 block text-xs font-bold text-[#8f2b0f]" role="alert">
                              {sendPaymentErrors.amount}
                            </span>
                          ) : null}
                        </label>
                        <label className="block min-w-0">
                          <span className="text-sm font-bold text-[#2c2e2f]">Currency</span>
                          <select
                            value={sendPaymentForm.currency}
                            onChange={(event) => updateSendPaymentField('currency', event.target.value)}
                            className="mt-2 h-12 w-full rounded border border-[#92979d] bg-white px-3 text-base font-bold text-[#0c0c0d] outline-none transition focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                          >
                            <option>USD</option>
                            <option>EUR</option>
                            <option>GBP</option>
                          </select>
                        </label>
                      </div>

                      <label className="block">
                        <span className="text-sm font-bold text-[#2c2e2f]">Payment note</span>
                        <textarea
                          value={sendPaymentForm.note}
                          onChange={(event) => updateSendPaymentField('note', event.target.value)}
                          rows={3}
                          className="mt-2 w-full rounded border border-[#92979d] bg-white px-3 py-3 text-base font-semibold text-[#0c0c0d] outline-none transition focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                        />
                      </label>
                    </div>

                    <div className="mt-5 rounded-xl border border-[#e0e3e7] bg-[#f7f9fa] p-4">
                      <p className="text-sm font-bold text-[#0c0c0d]">Review</p>
                      <dl className="mt-3 grid gap-2 text-sm font-semibold text-[#687173] sm:grid-cols-2">
                        <div>
                          <dt>Sender Business Account</dt>
                          <dd className="mt-1 font-bold text-[#0c0c0d]">{paypalSandboxSenderAccount.name}</dd>
                        </div>
                        <div>
                          <dt>Receiver</dt>
                          <dd className="mt-1 font-bold text-[#0c0c0d]">{recipientLookup.account?.name || 'Validate recipient'}</dd>
                        </div>
                        <div>
                          <dt>Available balance</dt>
                          <dd className="mt-1 font-bold text-[#0c0c0d]">{formatPayPalCurrency(paypalSandboxSenderAccount.balance, 'USD')}</dd>
                        </div>
                        <div>
                          <dt>Estimated fee</dt>
                          <dd className="mt-1 font-bold text-[#0c0c0d]">$0.00 sandbox</dd>
                        </div>
                      </dl>
                    </div>

                    <button
                      type="submit"
                      disabled={sendPaymentStatus === 'processing'}
                      className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0070e0] px-5 text-base font-bold text-white transition hover:bg-[#003087] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {sendPaymentStatus === 'processing' ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                      Send sandbox payment
                    </button>
                  </form>

                  <aside className="min-w-0 rounded-xl border border-[#e0e3e7] bg-white p-5">
                    <p className="text-base font-bold text-[#0c0c0d]">Payment status</p>
                    {paymentConfirmation ? (
                      <div className="mt-4" role="status">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f8f0] px-3 py-1 text-xs font-bold text-[#137333]">
                          <CheckCircle2 size={14} />
                          Completed
                        </span>
                        <h3 className="mt-4 text-2xl font-bold text-[#0c0c0d]">Payment Confirmation</h3>
                        <p className="mt-2 rounded-lg bg-[#fff6e5] px-3 py-2 text-xs font-bold text-[#8a5300]">
                          Sandbox / Test Payment Confirmation
                        </p>
                        <p className="mt-2 inline-flex rounded-full bg-[#e7f3ff] px-3 py-1 text-xs font-bold text-[#003087]">
                          Business Account
                        </p>
                        <dl className="mt-4 grid gap-3 text-sm">
                          {[
                            ['Confirmation type', 'Payment Confirmation'],
                            ['Account type', paymentConfirmation.sender.accountType || 'Business Account'],
                            ['Amount', `${formatPayPalCurrency(paymentConfirmation.amount, paymentConfirmation.currency)} ${paymentConfirmation.currency}`],
                            ['Transaction ID', paymentConfirmation.transactionId],
                            ['Date/time', paymentConfirmation.createdAt],
                            ['Sender', paymentConfirmation.sender.email],
                            ['Receiver', paymentConfirmation.receiver.email],
                            ['Payout batch', paymentConfirmation.payoutBatchId]
                          ].map(([label, value]) => (
                            <div key={label}>
                              <dt className="font-bold text-[#687173]">{label}</dt>
                              <dd className="mt-1 break-all font-bold text-[#0c0c0d]">{value}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="mt-5 grid gap-2">
                          <button
                            type="button"
                            onClick={() => downloadPaymentConfirmationImage(paymentConfirmation)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0070e0] px-4 text-sm font-bold text-[#0070e0] transition hover:bg-[#f5faff]"
                          >
                            <FileText size={15} />
                            Download image
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPaymentConfirmationPdf(paymentConfirmation)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#0070e0] px-4 text-sm font-bold text-white transition hover:bg-[#003087]"
                          >
                            <Receipt size={15} />
                            Download PDF
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-[#c6cbd1] bg-[#f7f9fa] px-4 py-6 text-center">
                        <Clock3 size={24} className="mx-auto text-[#687173]" />
                        <p className="mt-3 text-sm font-bold text-[#2c2e2f]">No payment sent yet.</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[#687173]">
                          A confirmation card, transaction ID, and downloadable test documents appear after completion.
                        </p>
                      </div>
                    )}
                  </aside>
                </div>
              ) : null}

              {paypalOperationsTab === 'invoices' ? (
                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <section className="min-w-0 rounded-xl border border-[#e0e3e7] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold uppercase text-[#687173]">Manage</p>
                        <h3 className="mt-1 text-2xl font-bold text-[#0c0c0d]">Invoicing</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-full border border-[#d6d9dc] px-4 py-2 text-sm font-bold text-[#003087] transition hover:border-[#0070e0]">
                          Settings
                        </button>
                        <button type="button" className="rounded-full border border-[#d6d9dc] px-4 py-2 text-sm font-bold text-[#003087] transition hover:border-[#0070e0]">
                          Invoice with AI
                        </button>
                        <button type="button" className="rounded-full bg-[#0070e0] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#003087]">
                          Create New
                        </button>
                      </div>
                    </div>
                    <div className="mt-5 flex gap-2 overflow-x-auto border-b border-[#e0e3e7] pb-3">
                      {['Invoices', 'Estimates', 'Recurring series'].map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          className={`h-9 shrink-0 rounded-full px-4 text-sm font-bold ${
                            tab === 'Invoices' ? 'bg-[#0070e0] text-white' : 'bg-[#f5f7fa] text-[#003087]'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                      <label className="block min-w-0">
                        <span className="text-xs font-bold text-[#687173]">Search invoices</span>
                        <input
                          type="search"
                          value={invoiceSearch}
                          onChange={(event) => setInvoiceSearch(event.target.value)}
                          className="mt-1 h-11 w-full rounded border border-[#92979d] px-3 text-sm font-semibold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className="text-xs font-bold text-[#687173]">Invoice status</span>
                        <select
                          value={invoiceStatusFilter}
                          onChange={(event) => setInvoiceStatusFilter(event.target.value)}
                          className="mt-1 h-11 w-full rounded border border-[#92979d] px-3 text-sm font-bold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                        >
                          {invoiceStatusOptions.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={downloadSandboxInvoiceCsv}
                        className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0070e0] px-4 text-sm font-bold text-[#0070e0] transition hover:bg-[#f5faff]"
                      >
                        <FileText size={15} />
                        Download
                      </button>
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-xl border border-[#e0e3e7]">
                      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                        <thead className="bg-[#f7f9fa] text-xs font-bold uppercase text-[#687173]">
                          <tr>
                            <th className="px-5 py-3">Invoice</th>
                            <th className="px-5 py-3">Customer</th>
                            <th className="px-5 py-3">Due</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPaypalInvoices.map((invoice) => (
                            <tr key={invoice.id} className="font-semibold text-[#0c0c0d] transition hover:bg-[#f8f9fb]">
                              <td className="border-t border-[#edf0f2] px-5 py-4">
                                <p className="font-bold text-[#003087]">{invoice.id}</p>
                                <p className="mt-1 text-xs text-[#687173]">{invoice.reference}</p>
                              </td>
                              <td className="border-t border-[#edf0f2] px-5 py-4">
                                <p>{invoice.customer}</p>
                                <p className="mt-1 text-xs text-[#687173]">{invoice.email}</p>
                              </td>
                              <td className="border-t border-[#edf0f2] px-5 py-4 text-[#687173]">{invoice.due}</td>
                              <td className="border-t border-[#edf0f2] px-5 py-4">
                                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                                  invoice.status === 'Paid'
                                    ? 'bg-[#e8f8f0] text-[#137333]'
                                    : invoice.status === 'Sent'
                                      ? 'bg-[#eef6ff] text-[#003087]'
                                      : 'bg-[#f7f9fa] text-[#687173]'
                                }`}>
                                  {invoice.status}
                                </span>
                              </td>
                              <td className="border-t border-[#edf0f2] px-5 py-4 text-right font-bold">
                                {formatPayPalCurrency(invoice.amount, invoice.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!filteredPaypalInvoices.length ? (
                        <div className="border-t border-[#edf0f2] px-5 py-8 text-center">
                          <Receipt size={24} className="mx-auto text-[#687173]" />
                          <p className="mt-3 text-sm font-bold text-[#2c2e2f]">No invoices match this view.</p>
                          <p className="mt-1 text-xs font-semibold text-[#687173]">Clear the search or choose another status filter.</p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                  <aside className="rounded-xl border border-[#e0e3e7] bg-white p-5">
                    <form onSubmit={submitSandboxInvoice}>
                      <p className="text-base font-bold text-[#0c0c0d]">Create invoice</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#687173]">
                        Draft, send, remind, cancel, and reconcile invoice states from the same PayPal service surface.
                      </p>
                      <div className="mt-4 rounded-xl bg-[#f7f9fa] p-4 text-xs font-bold leading-6 text-[#687173]">
                        POST /v2/invoicing/invoices<br />
                        POST /v2/invoicing/invoices/:id/send
                      </div>
                      <div className="mt-4 grid gap-3">
                        <label className="block">
                          <span className="text-xs font-bold text-[#687173]">Customer</span>
                          <input
                            type="email"
                            value={invoiceBuilderForm.customer}
                            onChange={(event) => updateInvoiceBuilderField('customer', event.target.value)}
                            className="mt-1 h-11 w-full rounded border border-[#92979d] px-3 text-sm font-semibold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-[#687173]">Template / currency</span>
                          <select className="mt-1 h-11 w-full rounded border border-[#92979d] px-3 text-sm font-bold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20">
                            <option>Service invoice - USD</option>
                            <option>Goods invoice - USD</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-[#687173]">Item name</span>
                          <input
                            type="text"
                            value={invoiceBuilderForm.itemName}
                            onChange={(event) => updateInvoiceBuilderField('itemName', event.target.value)}
                            className="mt-1 h-11 w-full rounded border border-[#92979d] px-3 text-sm font-semibold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-bold text-[#687173]">Quantity</span>
                            <input
                              type="number"
                              min="1"
                              value={invoiceBuilderForm.quantity}
                              onChange={(event) => updateInvoiceBuilderField('quantity', event.target.value)}
                              className="mt-1 h-11 w-full rounded border border-[#92979d] px-3 text-sm font-semibold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-bold text-[#687173]">Item price</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={invoiceBuilderForm.price}
                              onChange={(event) => updateInvoiceBuilderField('price', event.target.value)}
                              className="mt-1 h-11 w-full rounded border border-[#92979d] px-3 text-sm font-semibold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                            />
                          </label>
                        </div>
                        <label className="block">
                          <span className="text-xs font-bold text-[#687173]">Description</span>
                          <textarea
                            value={invoiceBuilderForm.description}
                            onChange={(event) => updateInvoiceBuilderField('description', event.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded border border-[#92979d] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold text-[#687173]">Notes</span>
                          <textarea
                            value={invoiceBuilderForm.note}
                            onChange={(event) => updateInvoiceBuilderField('note', event.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded border border-[#92979d] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                          />
                        </label>
                        {['Amount only', 'Quantity', 'Hours'].map((mode, index) => (
                          <label key={mode} className="flex items-center gap-2 text-sm font-semibold text-[#2c2e2f]">
                            <input type="radio" name="paypal-invoice-line-mode" defaultChecked={index === 1} />
                            {mode}
                          </label>
                        ))}
                        {['Show tax', 'Show discount', 'Show date', 'Ship items', 'Accept cards and PayPal', 'Allow partial payments'].map((option, index) => (
                          <label key={option} className="flex items-center gap-2 text-sm font-semibold text-[#2c2e2f]">
                            <input type="checkbox" defaultChecked={index >= 4} />
                            {option}
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 rounded-xl border border-[#e0e3e7] bg-[#f7f9fa] p-4">
                        <p className="text-sm font-bold text-[#0c0c0d]">Summary / Preview</p>
                        <div className="mt-3 flex items-center justify-between text-sm font-semibold">
                          <span>{invoiceBuilderForm.itemName}</span>
                          <span>{formatPayPalCurrency(invoiceBuilderTotal, 'USD')}</span>
                        </div>
                      </div>
                      <button type="submit" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0070e0] px-4 text-sm font-bold text-white transition hover:bg-[#003087]">
                        Send sandbox invoice
                      </button>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Link to="/miniapp/services/paypal/invoices" className="text-sm font-bold text-[#0070e0] hover:underline">
                          Back to invoices
                        </Link>
                        <button type="button" className="text-sm font-bold text-[#0070e0] hover:underline">
                          New invoice
                        </button>
                      </div>
                    </form>
                  </aside>
                </div>
              ) : null}

              {paypalOperationsTab === 'payouts' ? (
                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
                  <section className="min-w-0 rounded-xl border border-[#e0e3e7] bg-white p-5">
                    <div className="rounded-xl border border-[#b8d8fb] bg-[#eef6ff] p-4">
                      <p className="text-sm font-bold uppercase text-[#003087]">Batch payouts</p>
                      <h3 className="mt-1 text-2xl font-bold text-[#0c0c0d]">Send a payout</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#2c2e2f]">
                        Upload a sandbox CSV or TXT file, add recipient messaging, then submit the batch for sandbox processing.
                      </p>
                    </div>

                    <form onSubmit={submitSandboxPayoutFile} className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="grid gap-4">
                        <div className="rounded-xl border border-dashed border-[#9bbce8] bg-[#f7fbff] p-5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-bold text-[#0c0c0d]">Upload payout file</p>
                              <p className="mt-1 text-sm font-semibold leading-6 text-[#687173]">
                                Accepted formats mirror PayPal Sandbox payout upload testing: CSV or TXT.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={chooseSandboxPayoutFile}
                              className="inline-flex h-11 items-center justify-center rounded-full border border-[#0070e0] px-4 text-sm font-bold text-[#0070e0] transition hover:bg-[#eef6ff]"
                            >
                              Choose CSV/TXT file
                            </button>
                          </div>
                          <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#2c2e2f]">
                            {payoutUploadName || 'No file selected'}
                          </p>
                          <button
                            type="button"
                            onClick={downloadSandboxPayoutSample}
                            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#0070e0] transition hover:underline"
                          >
                            <FileText size={15} />
                            Download sample CSV
                          </button>
                        </div>

                        <label className="block">
                          <span className="text-sm font-bold text-[#2c2e2f]">Custom email subject</span>
                          <input
                            type="text"
                            value={payoutMessageForm.subject}
                            onChange={(event) => updatePayoutMessageField('subject', event.target.value)}
                            className="mt-2 h-12 w-full rounded border border-[#92979d] bg-white px-3 text-base font-semibold text-[#0c0c0d] outline-none transition focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-bold text-[#2c2e2f]">Custom email message</span>
                          <textarea
                            value={payoutMessageForm.message}
                            onChange={(event) => updatePayoutMessageField('message', event.target.value)}
                            rows={4}
                            className="mt-2 w-full rounded border border-[#92979d] bg-white px-3 py-3 text-base font-semibold text-[#0c0c0d] outline-none transition focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                          />
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-[#e0e3e7] bg-[#f7f9fa] p-4 text-sm font-semibold leading-6 text-[#2c2e2f]">
                          <input
                            type="checkbox"
                            checked={payoutAcknowledged}
                            onChange={(event) => setPayoutAcknowledged(event.target.checked)}
                            className="mt-1"
                          />
                          I confirm this sandbox payout file uses test recipients and test money only.
                        </label>

                        <button
                          type="submit"
                          disabled={!payoutAcknowledged}
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0070e0] px-5 text-base font-bold text-white transition hover:bg-[#003087] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Send size={16} />
                          Continue
                        </button>
                      </div>

                      <aside className="grid content-start gap-4">
                        {[
                          ['Batch requirements', 'sender_batch_id, receiver email, amount, currency, and note are required for each sandbox item.'],
                          ['Payout status', 'Batch and item lookups use sandbox payout IDs, item IDs, and idempotent retry references.']
                        ].map(([title, detail]) => (
                          <div key={title} className="rounded-xl border border-[#e0e3e7] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                            <p className="text-sm font-bold text-[#0c0c0d]">{title}</p>
                            <p className="mt-2 text-xs font-semibold leading-5 text-[#687173]">{detail}</p>
                          </div>
                        ))}
                        <div className="rounded-xl border border-[#e0e3e7] bg-white p-4">
                          <p className="text-sm font-bold text-[#0c0c0d]">FAQ</p>
                          <div className="mt-3 grid gap-3">
                            {paypalSandboxPayoutFaqs.map(([question, answer]) => (
                              <details key={question} className="rounded-lg bg-[#f7f9fa] px-3 py-2">
                                <summary className="cursor-pointer text-xs font-bold text-[#003087]">{question}</summary>
                                <p className="mt-2 text-xs font-semibold leading-5 text-[#687173]">{answer}</p>
                              </details>
                            ))}
                          </div>
                        </div>
                      </aside>
                    </form>
                  </section>

                  <aside className="grid content-start gap-4">
                    <div className="rounded-xl border border-[#e0e3e7] bg-white p-5">
                      <p className="text-base font-bold text-[#0c0c0d]">Recent payout batches</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#687173]">
                        Track batch IDs, item IDs, status, receiver, and sender_batch_id from sandbox payout submissions.
                      </p>
                    </div>
                    {paypalSandboxPayoutBatches.map((batch) => (
                      <article key={batch.id} className="rounded-xl border border-[#e0e3e7] bg-white p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-bold text-[#003087]">{batch.id}</p>
                            <h3 className="mt-2 text-xl font-bold text-[#0c0c0d]">{formatPayPalCurrency(batch.amount, batch.currency)} to {batch.receiver}</h3>
                            <p className="mt-2 text-sm font-semibold text-[#687173]">
                              Sender batch {batch.senderBatchId} · Payout item {batch.itemId}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-bold text-[#003087]">
                              Batch {batch.batchStatus}
                            </span>
                            <span className="rounded-full bg-[#e8f8f0] px-3 py-1 text-xs font-bold text-[#137333]">
                              Item {batch.itemStatus}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" className="rounded-full border border-[#0070e0] px-4 py-2 text-sm font-bold text-[#0070e0] transition hover:bg-[#f5faff]">
                            View batch
                          </button>
                          <button type="button" className="rounded-full border border-[#d6d9dc] px-4 py-2 text-sm font-bold text-[#003087] transition hover:border-[#0070e0]">
                            Fetch item status
                          </button>
                          {batch.itemStatus === 'Pending' ? (
                            <button type="button" className="rounded-full border border-[#d6d9dc] px-4 py-2 text-sm font-bold text-[#8f2b0f] transition hover:bg-[#fff7f5]">
                              Cancel pending item
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </aside>
                </div>
              ) : null}

              {paypalOperationsTab === 'tracking' ? (
                <div className="mt-5 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
                  <aside className="grid content-start gap-5">
                    <form onSubmit={trackSandboxTransaction} className="rounded-xl border border-[#e0e3e7] bg-white p-5">
                      <label className="block">
                        <span className="text-sm font-bold text-[#2c2e2f]">Transaction or reference ID</span>
                        <input
                          type="text"
                          value={trackingQuery}
                          onChange={(event) => {
                            setTrackingQuery(event.target.value);
                            setTrackingStatus('idle');
                          }}
                          className="mt-2 h-12 w-full rounded border border-[#92979d] bg-white px-3 text-base font-semibold text-[#0c0c0d] outline-none transition focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                        />
                      </label>
                      {trackingStatus === 'error' ? (
                        <p className="mt-2 text-xs font-bold text-[#8f2b0f]" role="alert">Enter a transaction ID to track.</p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={trackingStatus === 'loading'}
                        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0070e0] px-4 text-sm font-bold text-white transition hover:bg-[#003087] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {trackingStatus === 'loading' ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
                        Track payment
                      </button>
                      <div className="mt-4 rounded-xl bg-[#f7f9fa] p-4 text-xs font-bold leading-6 text-[#687173]">
                        GET /v1/payments/payouts/:id<br />
                        GET /v1/payments/payouts-item/:payout_item_id<br />
                        GET /v2/invoicing/invoices/:id
                      </div>
                    </form>
                    <div className="rounded-xl border border-[#e0e3e7] bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#687173]">Tracking result</p>
                          <h3 className="mt-1 text-xl font-bold text-[#0c0c0d]">
                            {trackingStatus === 'found' || paymentConfirmation ? trackingQuery : 'Awaiting lookup'}
                          </h3>
                        </div>
                        <span className="rounded-full bg-[#e8f8f0] px-3 py-1 text-xs font-bold text-[#137333]">
                          Completed
                        </span>
                      </div>
                      <div className="mt-5 grid gap-4">
                        {paypalSandboxTimeline.map((step, index) => (
                          <div key={step.label} className="flex gap-3">
                            <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0070e0] text-xs font-bold text-white">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-[#0c0c0d]">{step.label}</p>
                              <p className="mt-1 text-sm font-semibold leading-6 text-[#687173]">{step.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </aside>

                  <section className="min-w-0 rounded-xl border border-[#e0e3e7] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold uppercase text-[#687173]">Activity</p>
                        <h3 className="mt-1 text-2xl font-bold text-[#0c0c0d]">Transactions</h3>
                        <p className="mt-2 text-sm font-semibold leading-6 text-[#687173]">
                          Search and expand sandbox wallet activity across payments, invoices, and payout items.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={downloadSandboxTransactionCsv}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0070e0] px-4 text-sm font-bold text-[#0070e0] transition hover:bg-[#f5faff]"
                      >
                        <FileText size={15} />
                        Download
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <label className="block min-w-0">
                        <span className="text-xs font-bold text-[#687173]">Search transactions</span>
                        <input
                          type="search"
                          value={transactionSearch}
                          onChange={(event) => setTransactionSearch(event.target.value)}
                          className="mt-1 h-11 w-full rounded border border-[#92979d] px-3 text-sm font-semibold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className="text-xs font-bold text-[#687173]">Transaction status</span>
                        <select
                          value={transactionFilter}
                          onChange={(event) => setTransactionFilter(event.target.value)}
                          className="mt-1 h-11 w-full rounded border border-[#92979d] px-3 text-sm font-bold outline-none focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                        >
                          {transactionFilterOptions.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </label>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-[#e0e3e7]">
                      <table className="w-full min-w-[780px] border-separate border-spacing-0 text-left text-sm">
                        <thead className="bg-[#f7f9fa] text-xs font-bold uppercase text-[#687173]">
                          <tr>
                            <th className="px-5 py-3">Date</th>
                            <th className="px-5 py-3">Type</th>
                            <th className="px-5 py-3">Name</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">Amount</th>
                            <th className="px-5 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPaypalTransactions.map((transaction) => (
                            <React.Fragment key={transaction.id}>
                              <tr className="font-semibold text-[#0c0c0d] transition hover:bg-[#f8f9fb]">
                                <td className="border-t border-[#edf0f2] px-5 py-4 text-[#687173]">{transaction.date}</td>
                                <td className="border-t border-[#edf0f2] px-5 py-4">
                                  <p className="font-bold">{transaction.type}</p>
                                  <p className="mt-1 text-xs text-[#687173]">{transaction.id}</p>
                                </td>
                                <td className="border-t border-[#edf0f2] px-5 py-4">
                                  <p>{transaction.party}</p>
                                  <p className="mt-1 text-xs text-[#687173]">{transaction.email}</p>
                                </td>
                                <td className="border-t border-[#edf0f2] px-5 py-4">
                                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                                    transaction.status === 'Completed'
                                      ? 'bg-[#e8f8f0] text-[#137333]'
                                      : 'bg-[#fff6e5] text-[#8a5300]'
                                  }`}>
                                    {transaction.status}
                                  </span>
                                </td>
                                <td className={`border-t border-[#edf0f2] px-5 py-4 text-right font-bold ${
                                  transaction.amount < 0 ? 'text-[#0c0c0d]' : 'text-[#137333]'
                                }`}>
                                  {formatPayPalCurrency(transaction.amount, transaction.currency)}
                                </td>
                                <td className="border-t border-[#edf0f2] px-5 py-4">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedTransactionId((current) => (current === transaction.id ? '' : transaction.id))}
                                    className="rounded-full border border-[#d6d9dc] px-3 py-1.5 text-xs font-bold text-[#003087] transition hover:border-[#0070e0] hover:bg-[#f5faff]"
                                    aria-label={`Details ${transaction.id}`}
                                  >
                                    Details
                                  </button>
                                </td>
                              </tr>
                              {expandedTransactionId === transaction.id ? (
                                <tr>
                                  <td colSpan={6} className="border-t border-[#edf0f2] bg-[#f7f9fa] px-5 py-4">
                                    <div className="grid gap-3 text-sm font-semibold text-[#687173] md:grid-cols-3">
                                      <div>
                                        <p className="text-xs font-bold uppercase text-[#687173]">Reference</p>
                                        <p className="mt-1 break-all text-[#0c0c0d]">{transaction.reference}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold uppercase text-[#687173]">Source</p>
                                        <p className="mt-1 text-[#0c0c0d]">{transaction.source}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold uppercase text-[#687173]">Details</p>
                                        <p className="mt-1 text-[#0c0c0d]">{transaction.details}</p>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                      {!filteredPaypalTransactions.length ? (
                        <div className="border-t border-[#edf0f2] px-5 py-8 text-center">
                          <Search size={24} className="mx-auto text-[#687173]" />
                          <p className="mt-3 text-sm font-bold text-[#2c2e2f]">No transactions match this view.</p>
                          <p className="mt-1 text-xs font-semibold text-[#687173]">Clear the search or choose another status filter.</p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>
              ) : null}
            </section>
          </div>

          <aside className="min-w-0 max-w-full lg:pt-28">
            <p className="mb-3 text-[15px] font-bold text-[#2c2e2f]">Quick actions</p>
            <form onSubmit={buildPaymentLink} className="min-w-0 max-w-full rounded-xl border border-[#e0e3e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold leading-tight text-[#0c0c0d]">Create a Payment Link</h2>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-full text-[#687173] transition hover:bg-[#f5f7fa] hover:text-[#0c0c0d]"
                  aria-label="Dismiss payment link action"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#687173]">
                Make a shareable link so you can get paid by email, text, or on social media.
              </p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-bold text-[#2c2e2f]">Product or service name</span>
                  <input
                    type="text"
                    value={paymentLinkForm.name}
                    onChange={(event) => updatePaymentLinkField('name', event.target.value)}
                    aria-invalid={Boolean(paymentLinkErrors.name)}
                    aria-describedby={paymentLinkErrors.name ? 'paypal-payment-name-error' : undefined}
                    className="mt-2 h-12 w-full rounded border border-[#92979d] bg-white px-3 text-base font-semibold text-[#0c0c0d] outline-none transition focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                  />
                  {paymentLinkErrors.name ? (
                    <span id="paypal-payment-name-error" className="mt-1 block text-xs font-bold text-[#8f2b0f]" role="alert">
                      {paymentLinkErrors.name}
                    </span>
                  ) : null}
                </label>

                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_112px]">
                  <label className="block min-w-0">
                    <span className="text-sm font-bold text-[#2c2e2f]">Price</span>
                    <div className="mt-2 flex h-12 overflow-hidden rounded border border-[#92979d] bg-white focus-within:border-[#0070e0] focus-within:ring-2 focus-within:ring-[#0070e0]/20">
                      <span className="grid w-10 place-items-center text-base font-bold text-[#687173]">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={paymentLinkForm.price}
                        onChange={(event) => updatePaymentLinkField('price', event.target.value)}
                        aria-invalid={Boolean(paymentLinkErrors.price)}
                        aria-describedby={paymentLinkErrors.price ? 'paypal-payment-price-error' : undefined}
                        className="min-w-0 flex-1 border-0 px-0 text-base font-semibold text-[#0c0c0d] outline-none"
                      />
                    </div>
                    {paymentLinkErrors.price ? (
                      <span id="paypal-payment-price-error" className="mt-1 block text-xs font-bold text-[#8f2b0f]" role="alert">
                        {paymentLinkErrors.price}
                      </span>
                    ) : null}
                  </label>
                  <label className="block min-w-0">
                    <span className="text-sm font-bold text-[#2c2e2f]">Currency</span>
                    <select
                      value={paymentLinkForm.currency}
                      onChange={(event) => updatePaymentLinkField('currency', event.target.value)}
                      className="mt-2 h-12 w-full rounded border border-[#92979d] bg-white px-3 text-base font-bold text-[#0c0c0d] outline-none transition focus:border-[#0070e0] focus:ring-2 focus:ring-[#0070e0]/20"
                    >
                      <option>USD</option>
                      <option>EUR</option>
                      <option>GBP</option>
                    </select>
                  </label>
                </div>
              </div>

              {paymentLinkStatus === 'success' ? (
                <div className="mt-5 rounded-xl border border-[#bfe6cf] bg-[#f2fbf6] p-4" role="status">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[#137333]" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0c0c0d]">Payment link is ready</p>
                      <p className="mt-1 break-all text-xs font-semibold leading-5 text-[#687173]">{generatedPaymentLink}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={copyGeneratedPaymentLink}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#0070e0] transition hover:underline active:scale-95"
                  >
                    <Copy size={15} />
                    Copy link
                  </button>
                </div>
              ) : null}

              <div className="mt-6 grid gap-3">
                <button
                  type="submit"
                  disabled={paymentLinkStatus === 'building'}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#0070e0] px-5 text-base font-bold text-white transition hover:bg-[#003087] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {paymentLinkStatus === 'building' ? <RefreshCw size={16} className="animate-spin" /> : null}
                  Build It
                </button>
                <Link
                  to="/miniapp/studio?type=email&service=paypal&mode=custom-mail"
                  className="inline-flex h-10 items-center justify-center text-base font-bold text-[#0070e0] transition hover:underline active:scale-95"
                >
                  Customize
                </Link>
              </div>
            </form>
          </aside>
        </section>

        {paypalSubpage === 'activity' ? (
          <section className="mt-10 border-t border-[#e0e3e7] pt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-[#687173]">Activity</p>
                <h2 className="mt-2 text-3xl font-bold text-[#0c0c0d]">Transactions and statements</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#687173]">
                  Review recent payments, bank movement, disputes, and monthly reporting from the same wallet surface.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-full border border-[#0070e0] px-4 py-2 text-sm font-bold text-[#0070e0] transition hover:bg-[#f5faff]">
                  Download CSV
                </button>
                <Link to="/miniapp/analytics?provider=paypal" className="rounded-full bg-[#0070e0] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#003087]">
                  Reports
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {['All transactions', 'Statements', 'Disputes'].map((label, index) => (
                <article key={label} className="rounded-xl border border-[#e0e3e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                  <p className="text-sm font-bold text-[#003087]">{label}</p>
                  <p className="mt-3 text-2xl font-bold text-[#0c0c0d]">{index === 0 ? activityRows.length : index === 1 ? '12' : '0'}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#687173]">
                    {index === 0 ? 'Visible in the current filtered table.' : index === 1 ? 'Monthly records ready to export.' : 'No open cases require action.'}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {paypalSubpage === 'payment-links' ? (
          <section className="mt-10 border-t border-[#e0e3e7] pt-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <p className="text-sm font-bold uppercase text-[#687173]">Pay and get paid</p>
                <h2 className="mt-2 text-3xl font-bold text-[#0c0c0d]">Payment links and buttons</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#687173]">
                  Create links, buttons, and QR-ready checkout moments for product drops, invoices, and message-based sales.
                </p>
                <div className="mt-6 overflow-hidden rounded-xl border border-[#e0e3e7] bg-white">
                  {[
                    ['Payment link', generatedPaymentLink, paymentLinkStatus === 'success' ? 'Ready' : 'Draft'],
                    ['Button embed', 'Checkout button for websites and shops', 'Configured'],
                    ['QR code', 'Printable scan-to-pay experience', 'Available']
                  ].map(([label, body, status]) => (
                    <div key={label} className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0f2] px-5 py-4 last:border-b-0">
                      <div>
                        <p className="text-base font-bold text-[#0c0c0d]">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-[#687173]">{body}</p>
                      </div>
                      <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-bold text-[#003087]">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <aside className="rounded-xl border border-[#e0e3e7] bg-[#f7f9fa] p-5">
                <p className="text-base font-bold text-[#0c0c0d]">Link preview</p>
                <div className="mt-4 rounded-xl border border-[#d6d9dc] bg-white p-4">
                  <p className="text-sm font-bold text-[#2c2e2f]">{paymentLinkForm.name || 'Product or service'}</p>
                  <p className="mt-2 text-3xl font-bold text-[#0c0c0d]">
                    {paymentLinkForm.price ? `$${paymentLinkForm.price}` : '$0.00'}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#687173]">{paymentLinkForm.currency}</p>
                  <button type="button" className="mt-4 h-11 w-full rounded-full bg-[#0070e0] text-sm font-bold text-white">
                    Pay now
                  </button>
                </div>
              </aside>
            </div>
          </section>
        ) : null}

        {paypalSubpage === 'mail' ? (
          <section className="mt-10 border-t border-[#e0e3e7] pt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-[#687173]">Mail tools</p>
                <h2 className="mt-2 text-3xl font-bold text-[#0c0c0d]">PayPal mail workspace</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#687173]">
                  Build custom and deposit mail from the PayPal wallet area while keeping history, provider actions, and delivery context together.
                </p>
              </div>
              <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-bold text-[#003087]">
                {paypalMailMode === 'deposit-mail' ? 'Deposit mail selected' : 'Custom mail selected'}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {paypalWalletMailTasks.map((task) => {
                const Icon = task.icon;
                const studioTarget = task.label === 'Custom Mail' ? customMailTarget : task.label === 'Deposit Mail' ? depositMailTarget : task.to;
                return (
                  <article key={task.label} className="rounded-xl border border-[#e0e3e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#eef6ff] text-[#0070e0]">
                        <Icon size={20} />
                      </span>
                      <span className="rounded-full bg-[#f7f9fa] px-2 py-1 text-[11px] font-bold text-[#687173]">{task.badge}</span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-[#0c0c0d]">{task.label}</h3>
                    <p className="mt-2 min-h-[72px] text-sm font-semibold leading-6 text-[#687173]">{task.body}</p>
                    <Link to={studioTarget} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#0070e0] hover:underline">
                      Open
                      <ArrowRight size={15} />
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {paypalSubpage === 'settings' ? (
          <section className="mt-10 border-t border-[#e0e3e7] pt-8">
            <div>
              <p className="text-sm font-bold uppercase text-[#687173]">Settings</p>
              <h2 className="mt-2 text-3xl font-bold text-[#0c0c0d]">Business account settings</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#687173]">
                Manage business profile, wallet preferences, service operations, and security checks from one account page.
              </p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ['Business profile', 'Name, profile link, public checkout identity, and contact defaults.', '/miniapp/profile'],
                ['Wallet preferences', 'Currencies, bank transfer routing, available balance, and funding sources.', '/miniapp/wallet?service=paypal'],
                ['Service operations', 'Provider health, API credentials, webhook delivery, invoices, and payouts.', providerTarget],
                ['Security', 'Session review, approval rules, audit trail, and risk controls.', '/miniapp/security?provider=paypal']
              ].map(([label, body, to]) => (
                <Link
                  key={label}
                  to={to}
                  className="rounded-xl border border-[#e0e3e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition hover:border-[#0070e0] hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]"
                >
                  <p className="text-lg font-bold text-[#0c0c0d]">{label}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#687173]">{body}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#0070e0]">
                    Manage
                    <ArrowRight size={15} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <BottomSheet
        open={mobileMoneySheetOpen}
        onClose={() => setMobileMoneySheetOpen(false)}
        title="Manage sandbox money"
        description="Choose a test-wallet task. These actions stay in Transferly's PayPal sandbox workspace."
        closeLabel="Close Manage money"
        panelClassName="max-h-[min(720px,calc(var(--tg-viewport-stable-height,100dvh)-24px))] overflow-y-auto border-[#d6d9dc] bg-white text-[#0c0c0d]"
      >
        <div className="grid gap-2">
          {paypalOperationTabs.map((tab) => {
            const Icon = tab.icon;
            const descriptions = {
              send: 'Validate a recipient and send a sandbox payment.',
              invoices: 'Create, send, and reconcile test invoices.',
              payouts: 'Prepare a sandbox payout batch for review.',
              tracking: 'Find a sandbox payment or payout reference.'
            };
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => openSandboxOperation(tab.id)}
                className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-[#e0e3e7] bg-white p-3 text-left transition hover:border-[#0070e0] hover:bg-[#f5faff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070e0]"
                aria-label={`Open ${tab.label} sandbox flow`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef6ff] text-[#0070e0]">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#003087]">{tab.label}</span>
                  <span className="mt-0.5 block text-xs font-semibold leading-5 text-[#687173]">{descriptions[tab.id]}</span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setMobileMoneySheetOpen(false);
              window.requestAnimationFrame(() => activityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            }}
            className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-[#e0e3e7] bg-white p-3 text-left transition hover:border-[#0070e0] hover:bg-[#f5faff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070e0]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef6ff] text-[#0070e0]">
              <Activity size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#003087]">Review activity</span>
              <span className="mt-0.5 block text-xs font-semibold leading-5 text-[#687173]">See recent invoices and payouts in compact wallet cards.</span>
            </span>
          </button>
          <Link
            to="/miniapp/wallet?service=paypal"
            onClick={() => setMobileMoneySheetOpen(false)}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-[#e0e3e7] bg-white p-3 text-left transition hover:border-[#0070e0] hover:bg-[#f5faff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070e0]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef6ff] text-[#0070e0]">
              <WalletCards size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#003087]">Transferly wallet</span>
              <span className="mt-0.5 block text-xs font-semibold leading-5 text-[#687173]">Manage the internal ledger balance separately from provider data.</span>
            </span>
          </Link>
        </div>
      </BottomSheet>

      <footer className="border-t border-[#e0e3e7] bg-[#f7f9fa]">
        <div className="mx-auto max-w-[1180px] px-4 py-8 text-sm sm:px-6">
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {paypalWalletFooterLinks.map((label) => (
              <Link key={label} to={label === 'Developers' ? providerTarget : '/miniapp/support'} className="font-bold text-[#003087] hover:underline">
                {label}
              </Link>
            ))}
          </div>

          <div className="relative mt-5 inline-flex flex-wrap gap-x-5 gap-y-3">
            <button
              type="button"
              onClick={() => setLanguageMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 font-bold text-[#003087] hover:underline"
              aria-expanded={languageMenuOpen}
              aria-controls="paypal-language-menu"
            >
              English
              <ChevronDown size={14} className={languageMenuOpen ? 'rotate-180 transition' : 'transition'} />
            </button>
            {languageMenuOpen ? (
              <div id="paypal-language-menu" className="absolute left-0 top-8 z-20 w-44 rounded-xl border border-[#d6d9dc] bg-white p-2 shadow-[0_14px_32px_rgba(0,0,0,0.14)]">
                {paypalWalletLanguageLinks.map((label) => (
                  <button key={label} type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-[#003087] hover:bg-[#f5f7fa]">
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-[#687173]">
            <p>Copyright © 1999-2026 PayPal. All rights reserved.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Link to="/miniapp/support" className="hover:text-[#003087] hover:underline">Privacy</Link>
              <Link to="/miniapp/support" className="hover:text-[#003087] hover:underline">Legal</Link>
              <Link to="/miniapp/support" className="hover:text-[#003087] hover:underline">Policy updates</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MiniAppMailServicePicker({ service }) {
  if (service.slug === 'paypal') {
    return <MiniAppPayPalWalletServicePage service={service} />;
  }

  const customMailTarget = `/miniapp/studio?type=email&service=${service.slug}&mode=custom-mail`;
  const depositMailTarget = `/miniapp/studio?type=email&service=${service.slug}&mode=deposit-mail`;
  const historyTarget = `/miniapp/vault?service=${service.slug}`;
  const providerTarget = getMiniAppLaunchTarget(service);
  const showProviderLink = service.category === 'Payment Providers';

  const actions = [
    { label: 'Custom Mail', to: customMailTarget, icon: FileText },
    { label: 'Deposit Mail', to: depositMailTarget, icon: CreditCard },
    { label: 'Mail History', to: historyTarget, icon: History }
  ];

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] px-5 py-7 text-center shadow-sm">
        <ServiceLogo service={service} size="lg" className="mx-auto" />
        <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{service.title}</h2>
        <p className="mt-2 text-sm font-bold text-[var(--tg-subtitle-text-color)]">Choose the type of mail to Send</p>

        <div className="mt-6 space-y-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.to}
                className="group flex min-h-[58px] items-center justify-between gap-3 rounded-[20px] bg-[var(--tg-secondary-bg-color)] px-4 text-left text-[var(--tg-text-color)] transition hover:bg-[color-mix(in_srgb,var(--tg-secondary-bg-color),var(--tg-button-color)_8%)] active:scale-[0.98]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[var(--tg-section-bg-color)] text-[var(--tg-button-color)]">
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-black">{action.label}</span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-[var(--tg-button-color)] transition group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>

        {showProviderLink ? (
          <Link
            to={providerTarget}
            onMouseEnter={prefetchProviderWorkspace}
            onFocus={prefetchProviderWorkspace}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--tg-button-color)] px-4 py-3 text-xs font-black text-[var(--tg-button-text-color)] transition active:scale-95"
          >
            Open {service.title} provider workspace
            <ShieldCheck size={15} />
          </Link>
        ) : null}
      </section>

      <Link
        to="/miniapp"
        className="mx-auto flex w-fit items-center gap-2 rounded-full bg-[var(--tg-section-bg-color)] px-4 py-2 text-sm font-black text-[var(--tg-button-color)] transition active:scale-95"
      >
        <ArrowLeft size={16} />
        Back to Wallet Home
      </Link>
    </div>
  );
}

function MiniAppServiceDetail({ slug, profile, config }) {
  const service = getServiceBySlug(slug);

  if (!service) {
    return (
      <div className="space-y-4">
        <Link
          to="/miniapp/services"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--tg-section-bg-color)] px-4 py-2 text-sm font-black text-[var(--tg-button-color)] transition active:scale-95"
        >
          <ArrowLeft size={16} />
          Back to Services
        </Link>
        <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Missing service</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Service not found</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
            This catalog entry is not available in the Transferly mini app.
          </p>
        </section>
      </div>
    );
  }

  if (miniAppMailServiceSlugs.has(service.slug)) {
    return <MiniAppMailServicePicker service={service} />;
  }

  const preview = getServicePreview(service);
  const estimatedCost = getServiceEstimatedCost(service, config);
  const recommendedPacks = getRecommendedPointPacks(service, config);
  const relatedServices = getRelatedServices(service.slug, 3);
  const points = Number(profile?.points || 0);
  const needsTopUp = estimatedCost !== null && points < estimatedCost;
  const launchTarget = getMiniAppLaunchTarget(service);
  const isLaunchable = isServiceLaunchable(service);
  const statusLabel = getServiceStatusLabel(service);
  const launchLabel = service.launchLabel || 'Open Service';

  return (
    <div className="space-y-4">
      <Link
        to="/miniapp/services"
        className="inline-flex items-center gap-2 rounded-full bg-[var(--tg-section-bg-color)] px-4 py-2 text-sm font-black text-[var(--tg-button-color)] transition active:scale-95"
      >
        <ArrowLeft size={16} />
        Back to Services
      </Link>

      <section
        className="overflow-hidden rounded-[32px] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.24)]"
        style={{ background: `linear-gradient(135deg, ${service.accent?.bg || '#111827'}, #2b211b)` }}
      >
        <div className="flex items-start justify-between gap-4">
          <ServiceLogo service={service} size="lg" />
          <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
            {service.badge || service.category}
          </span>
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-white/65">{preview.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">{service.title}</h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/76">{service.description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {isLaunchable ? (
            <Link
              to={launchTarget}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#17120e] transition active:scale-95"
            >
              {launchLabel}
              <ArrowRight size={16} />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/15 px-5 py-3 text-sm font-black text-white/60"
            >
              {statusLabel}
            </button>
          )}
          {needsTopUp ? (
            <Link
              to={`/miniapp/wallet?service=${service.slug}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-black text-white transition active:scale-95"
            >
              Buy Points
              <Zap size={16} />
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <section className="rounded-[26px] bg-[var(--tg-section-bg-color)] p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Status</p>
          <p className="mt-3 text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">
            {statusLabel}
          </p>
        </section>
        <section className="rounded-[26px] bg-[var(--tg-section-bg-color)] p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Estimated cost</p>
          <p className="mt-3 text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">
            {estimatedCost === null ? 'No points' : `${estimatedCost.toLocaleString()} pts`}
          </p>
        </section>
        <section className="rounded-[26px] bg-[var(--tg-section-bg-color)] p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Balance</p>
          <p className="mt-3 text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">
            {points.toLocaleString()} pts
          </p>
        </section>
      </div>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <h3 className="text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">{preview.headline}</h3>
        <p className="mt-3 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">{service.detail}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {preview.bullets.map((bullet) => (
            <div key={bullet} className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] px-4 py-4 text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]">
              {bullet}
            </div>
          ))}
        </div>
      </section>

      {estimatedCost !== null ? (
        <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Recommended packs</p>
              <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">
                {needsTopUp ? 'Top up before launch' : 'Ready to launch'}
              </h3>
            </div>
            <Link to={`/miniapp/wallet?service=${service.slug}`} className="text-sm font-black text-[var(--tg-button-color)]">
              Open wallet
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recommendedPacks.map((pack) => (
              <div key={pack} className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] px-4 py-4 text-center">
                <p className="text-lg font-black tracking-[-0.035em] text-[var(--tg-text-color)]">{pack.toLocaleString()}</p>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">points</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {relatedServices.length ? (
        <section className="space-y-3">
          <h3 className="text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">Related Services</h3>
          <div className="grid grid-cols-3 gap-3">
            {relatedServices.map((related) => (
              <Link
                key={related.slug}
                to={getMiniAppServiceTarget(related)}
                onMouseEnter={prefetchProviderWorkspace}
                onFocus={prefetchProviderWorkspace}
                className="rounded-[24px] bg-[var(--tg-section-bg-color)] p-3 text-center text-[var(--tg-text-color)] transition active:scale-[0.98]"
              >
                <ServiceLogo service={related} size="md" className="mx-auto" />
                <span className="mt-3 block truncate text-xs font-black">{related.title}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HomeSection({ profile, telegram, receipts, topUpOrders, paymentIssues, telegramAuthState, loading }) {
  return (
    <div className="space-y-5">
      <HeroPanel profile={profile} telegram={telegram} receipts={receipts} topUpOrders={topUpOrders} />
      <WorkspaceStatusStrip
        telegram={telegram}
        telegramAuthState={telegramAuthState}
        loading={loading}
        paymentIssues={paymentIssues}
      />
      <LaunchPath />
      <FeaturedStrip />
      <ServiceRail services={miniAppServiceHighlights} />
      <MarketplaceBoard />
      <AllServicesGrid />
    </div>
  );
}

function buildSupportContext({ source, telegram, profile, user, receipts, topUpOrders, paymentIssues }) {
  const latestOrder = topUpOrders[0];
  const latestReceipt = receipts[0];

  return [
    'Transferly Mini App support context',
    `Screen: ${source || 'support'}`,
    `Telegram: ${telegram.available ? 'detected' : 'browser preview'}`,
    `Telegram user: ${telegram.user?.username ? `@${telegram.user.username}` : telegram.user?.id || 'not available'}`,
    `Transferly user: ${user?.email || user?.id || 'guest'}`,
    `Points: ${Number(profile?.points || 0).toLocaleString()}`,
    `Latest order: ${latestOrder?.order_id || latestOrder?.id || 'none'} ${latestOrder?.status || ''}`.trim(),
    `Latest receipt: ${latestReceipt?.id || latestReceipt?.title || 'none'}`,
    `Open payment issues: ${paymentIssues.length.toLocaleString()}`
  ].join('\n');
}

function SupportSection({ telegram, profile, user, receipts, topUpOrders, paymentIssues }) {
  const location = useLocation();
  const { configureMainButton, notify } = telegram;
  const [query, setQuery] = useState('');
  const [openQuestion, setOpenQuestion] = useState(supportFaqs[0]?.question || '');
  const supportContext = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return buildSupportContext({
      source: params.get('from') || params.get('screen') || 'support',
      telegram,
      profile,
      user,
      receipts,
      topUpOrders,
      paymentIssues
    });
  }, [location.search, paymentIssues, profile, receipts, telegram, topUpOrders, user]);

  const copyContext = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(supportContext);
      notify('success');
      toast.success('Support context copied');
    } catch {
      notify('error');
      toast.error('Unable to copy support context');
    }
  }, [notify, supportContext]);

  useEffect(() => {
    return configureMainButton?.({
      text: 'Copy Support Context',
      enabled: true,
      onClick: copyContext
    });
  }, [configureMainButton, copyContext]);

  const filteredFaqs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return supportFaqs;
    }

    return supportFaqs.filter((faq) => {
      const haystack = `${faq.question} ${faq.answer}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [query]);

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
            <LifeBuoy size={26} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Support desk</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Guided help with context</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--tg-subtitle-text-color)]">
              The premium support flow should attach current screen, user, order, receipt, and provider context before handoff.
            </p>
          </div>
        </div>
      </section>
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Attached context</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Ready for support handoff</h3>
            <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4 text-xs font-bold leading-6 text-[var(--tg-subtitle-text-color)]">
              {supportContext}
            </pre>
          </div>
          <button
            type="button"
            onClick={copyContext}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)] shadow-sm transition active:scale-95"
            aria-label="Copy support context"
          >
            <Copy size={19} />
          </button>
        </div>
      </section>
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">
          <Search size={15} />
          Help search
        </div>
        <label className="mt-4 flex items-center gap-3 rounded-[22px] bg-[var(--tg-secondary-bg-color)] px-4 py-3">
          <Search size={18} className="text-[var(--tg-hint-color)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search support topics"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--tg-text-color)] outline-none placeholder:text-[var(--tg-hint-color)]"
          />
        </label>
        <div className="mt-4 space-y-2">
          {filteredFaqs.length ? filteredFaqs.map((faq) => {
            const open = openQuestion === faq.question;
            return (
              <button
                key={faq.question}
                type="button"
                onClick={() => setOpenQuestion(open ? '' : faq.question)}
                className="w-full rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4 text-left transition active:scale-[0.99]"
                aria-expanded={open}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-start gap-3">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--tg-button-color)]" />
                    <span className="text-sm font-black leading-6 text-[var(--tg-text-color)]">{faq.question}</span>
                  </span>
                  <ChevronDown
                    size={18}
                    className={`mt-1 shrink-0 text-[var(--tg-hint-color)] transition ${open ? 'rotate-180' : ''}`}
                  />
                </span>
                {open ? (
                  <span className="mt-3 block pl-8 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
                    {faq.answer}
                  </span>
                ) : null}
              </button>
            );
          }) : (
            <div className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4 text-sm font-bold text-[var(--tg-hint-color)]">
              No support topics matched. Copy the support context and send it to the bot/admin.
            </div>
          )}
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard icon={CreditCard} title="Funding issue" body="Review wallet orders, point release state, and funding context." to="/miniapp/wallet" badge="Points" />
        <ActionCard icon={Receipt} title="Receipt issue" body="Open vault, choose a receipt, and attach details." to="/miniapp/vault" badge="Vault" />
        <ActionCard icon={Bot} title="Bot access" body="Check Telegram identity and access state before support escalation." to="/miniapp/profile" badge={telegram.available ? 'Verified' : 'Preview'} />
        <ActionCard icon={LifeBuoy} title="Help center" body="Use the existing FAQ and help page while Mini App support grows." to="/help" badge="FAQ" />
      </div>
    </div>
  );
}

function OrdersSection({ topUpOrders, telegram }) {
  const [orderNumber, setOrderNumber] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const counts = useMemo(() => {
    return orderFilterOptions.reduce((acc, option) => {
      acc[option.id] = option.id === 'all'
        ? topUpOrders.length
        : topUpOrders.filter((order) => normalizeOrderStatus(order.status) === option.id).length;
      return acc;
    }, {});
  }, [topUpOrders]);

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return topUpOrders.filter((order) => {
      const normalizedStatus = normalizeOrderStatus(order.status);
      const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
      const haystack = [
        order.order_id,
        order.id,
        order.amount_label,
        order.points,
        order.method_title,
        order.status
      ].filter(Boolean).join(' ').toLowerCase();

      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [query, statusFilter, topUpOrders]);

  const goToOrder = () => {
    const value = orderNumber.trim();
    if (!value) {
      toast.error('Enter order number');
      telegram.notify('error');
      return;
    }

    setQuery(value);
    setStatusFilter('all');
    telegram.impact('light');
  };

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h2 className="text-3xl font-black tracking-[-0.045em] text-[var(--tg-text-color)]">Orders</h2>
        <p className="text-sm font-semibold text-[var(--tg-subtitle-text-color)]">Track point orders, release status, and vendor handoff records.</p>
      </section>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex items-center gap-3 rounded-[22px] bg-[var(--tg-secondary-bg-color)] px-4 py-3">
            <Search size={18} className="shrink-0 text-[var(--tg-hint-color)]" />
            <input
              type="search"
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  goToOrder();
                }
              }}
              placeholder="Enter order number"
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--tg-text-color)] outline-none placeholder:text-[var(--tg-hint-color)]"
            />
          </label>
          <button
            type="button"
            onClick={goToOrder}
            className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)] transition active:scale-95"
          >
            Go to order
            <ArrowRight size={16} />
          </button>
        </div>

        <label className="mt-3 flex items-center gap-3 rounded-[22px] bg-[var(--tg-secondary-bg-color)] px-4 py-3">
          <Search size={18} className="shrink-0 text-[var(--tg-hint-color)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by Order number or amount"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--tg-text-color)] outline-none placeholder:text-[var(--tg-hint-color)]"
          />
        </label>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {orderFilterOptions.map((option) => {
            const active = statusFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setStatusFilter(option.id);
                  telegram.impact('light');
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition active:scale-95 ${
                  active
                    ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
                    : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-hint-color)]'
                }`}
                aria-pressed={active}
              >
                {option.label} {Number(counts[option.id] || 0).toLocaleString()}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        {filteredOrders.length ? filteredOrders.map((order) => {
          const normalizedStatus = normalizeOrderStatus(order.status);
          const statusLabel = orderFilterOptions.find((option) => option.id === normalizedStatus)?.label || 'In progress';

          return (
            <article key={order.order_id || order.id} className="rounded-[26px] bg-[var(--tg-section-bg-color)] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[var(--tg-text-color)]">{order.order_id || order.id || 'Order'}</p>
                  <p className="mt-1 text-xs font-bold text-[var(--tg-hint-color)]">{formatOrderDate(order.created_at)}</p>
                </div>
                <span className="rounded-full bg-[var(--tg-secondary-bg-color)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tg-button-color)]">
                  {statusLabel}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] bg-[var(--tg-secondary-bg-color)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Amount</p>
                  <p className="mt-1 text-sm font-black text-[var(--tg-text-color)]">
                    {order.amount_label || `${Number(order.points || 0).toLocaleString()} pts`}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[var(--tg-secondary-bg-color)] p-3 sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Method</p>
                  <p className="mt-1 truncate text-sm font-black text-[var(--tg-text-color)]">{order.method_title || 'Funding method'}</p>
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-[28px] bg-[var(--tg-section-bg-color)] p-8 text-center shadow-sm">
            <CreditCard className="mx-auto text-[var(--tg-button-color)]" size={30} />
            <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">No orders yet</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-hint-color)]">
              Point orders created from Buy Points will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileSection({ telegram, profile, user }) {
  const { configureMainButton, impact, notify } = telegram;
  const [activeTab, setActiveTab] = useState('Personal info');
  const referralCode = profile?.referral_code || 'Not assigned';
  const telegramName = [telegram.user?.first_name, telegram.user?.last_name].filter(Boolean).join(' ');
  const telegramLaunchDetected = Boolean(telegram.available || telegram.initData);
  const displayName = telegramName || profile?.name || user?.name || (telegramLaunchDetected ? 'Telegram user' : 'Guest preview');
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0].toUpperCase())
    .join('') || displayName.slice(0, 1).toUpperCase();
  const username = telegram.user?.username ? `@${telegram.user.username}` : profile?.username || user?.username || 'Not connected';
  const email = user?.email || profile?.email || 'Telegram miniapp user';
  const memberSince = formatOrderDate(profile?.created_at || user?.created_at);
  const points = Number(profile?.points || 0);
  const phoneCountryOptions = ['NG', 'US', 'GB', 'CA', 'GH', 'KE', 'ZA'];
  const storedPhoneCountry = profile?.phone_country || profile?.country || user?.country || 'NG';
  const phoneCountry = phoneCountryOptions.includes(storedPhoneCountry) ? storedPhoneCountry : 'NG';
  const whatsAppNumber = profile?.whatsapp || profile?.phone || user?.phone || '';
  const referralLink = referralCode !== 'Not assigned'
    ? `https://t.me/TransferlyBot?start=${referralCode}`
    : referralCode;

  const copyReferral = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      notify('success');
      toast.success('Referral link copied');
    } catch {
      toast.error('Unable to copy referral link');
    }
  }, [notify, referralLink]);

  const saveProfilePreview = () => {
    impact('light');
    toast.success('Profile preferences saved');
  };

  const logoutPreview = () => {
    notify('success');
    toast.success('Telegram mini app sessions are controlled by the bot');
  };

  useEffect(() => {
    return configureMainButton?.({
      text: 'Copy Ref Link',
      enabled: referralCode !== 'Not assigned',
      onClick: copyReferral
    });
  }, [configureMainButton, copyReferral, referralCode]);

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--tg-button-color)] text-xl font-black text-[var(--tg-button-text-color)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Account identity</p>
            <h2 className="mt-2 truncate text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">
              {displayName}
            </h2>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--tg-hint-color)]">
              {username}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--tg-secondary-bg-color)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
                USER
              </span>
              <span className="rounded-full bg-[var(--tg-secondary-bg-color)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
                Member since {memberSince}
              </span>
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard icon={UserRound} label="User role" value="USER" tone={user ? 'accent' : 'warn'} />
        <StatCard icon={WalletCards} label="Total balance" value={`${points.toLocaleString()} pts`} tone="accent" />
        <StatCard icon={CreditCard} label="Naira/pt" value="₦1" />
        <StatCard icon={Star} label="Referrals" value={Number(profile?.referral_count || 0).toLocaleString()} />
        <button
          type="button"
          onClick={copyReferral}
          className="rounded-[24px] bg-[var(--tg-section-bg-color)] p-4 text-left shadow-sm transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
            <Copy size={15} />
            Copy Ref Link
          </div>
          <p className="mt-3 break-all text-lg font-black tracking-[-0.03em] text-[var(--tg-text-color)]">{referralCode}</p>
        </button>
      </div>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Referral</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Invite and earn</h3>
          </div>
          <button
            type="button"
            onClick={copyReferral}
            className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[var(--tg-button-color)] px-4 py-3 text-xs font-black text-[var(--tg-button-text-color)] transition active:scale-95"
          >
            <Copy size={15} />
            Copy
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4">
            <p className="text-xs font-black text-[var(--tg-button-color)]">01</p>
            <h4 className="mt-3 text-lg font-black tracking-[-0.03em] text-[var(--tg-text-color)]">Share the Love</h4>
            <p className="mt-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
              Send your Transferly bot referral link to trusted customers and operators.
            </p>
          </div>
          <div className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4">
            <p className="text-xs font-black text-[var(--tg-button-color)]">02</p>
            <h4 className="mt-3 text-lg font-black tracking-[-0.03em] text-[var(--tg-text-color)]">Get Rewarded</h4>
            <p className="mt-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
              Track referred users and keep rewards visible inside the miniapp profile.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Profile Information</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{displayName}</h3>
          </div>
          <span className="rounded-full bg-[var(--tg-secondary-bg-color)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
            {telegram.available ? 'Telegram' : 'Preview'}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ['Name', displayName],
            ['Email', email],
            ['Username', username]
          ].map(([label, value]) => (
            <label key={label}>
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">{label}</span>
              <input
                value={value}
                readOnly
                className="mt-2 w-full rounded-[18px] border border-black/5 bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-bold text-[var(--tg-text-color)] outline-none"
              />
            </label>
          ))}
          <label>
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Phone number country</span>
            <select
              value={phoneCountry}
              onChange={() => {}}
              className="mt-2 w-full rounded-[18px] border border-black/5 bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-bold text-[var(--tg-text-color)] outline-none"
              aria-label="Phone number country"
            >
              {phoneCountryOptions.map((countryCode) => (
                <option key={countryCode} value={countryCode}>{countryCode}</option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">WhatsApp Number</span>
            <input
              value={whatsAppNumber}
              readOnly
              placeholder="Enter Phone Number"
              className="mt-2 w-full rounded-[18px] border border-black/5 bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-bold text-[var(--tg-text-color)] outline-none placeholder:text-[var(--tg-hint-color)]"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {profileTabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  telegram.impact('light');
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition active:scale-95 ${
                  active
                    ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
                    : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-hint-color)]'
                }`}
                aria-pressed={active}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-4">
          <p className="text-sm font-black text-[var(--tg-text-color)]">{activeTab}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
            {activeTab === 'Fees & pricing' ? 'Review point costs and current service pricing from the miniapp workspace.' : null}
            {activeTab === 'Contact Telegram' ? 'Use bot-first support and verified Telegram handoff for account changes.' : null}
            {activeTab === 'Personal info' ? 'Profile details are read from Telegram and the linked Transferly account.' : null}
            {activeTab === 'Security' ? 'Sessions, identity, and sensitive actions stay tied to the Telegram launch context.' : null}
            {activeTab === 'Danger zone' ? 'Account-level destructive actions require support verification outside this preview.' : null}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={saveProfilePreview}
            className="rounded-[20px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)] transition active:scale-95"
          >
            Save
          </button>
          <button
            type="button"
            onClick={logoutPreview}
            className="rounded-[20px] bg-[var(--tg-secondary-bg-color)] px-5 py-3 text-sm font-black text-[var(--tg-text-color)] transition active:scale-95"
          >
            Logout
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingsSection({ telegram, profile, user }) {
  const navigate = useNavigate();
  const {
    configureMainButton,
    hapticsEnabled,
    impact,
    setHapticsEnabled
  } = telegram;
  const [defaultScreen, setDefaultScreen] = useState(() => {
    const stored = readStoredMiniAppSetting(DEFAULT_SCREEN_KEY, 'studio');
    return defaultScreenOptions.some((option) => option.id === stored) ? stored : 'studio';
  });

  const selectedScreen = defaultScreenOptions.find((option) => option.id === defaultScreen) || defaultScreenOptions[1];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEFAULT_SCREEN_KEY, defaultScreen);
    }
  }, [defaultScreen]);

  const openSelectedScreen = useCallback(() => {
    impact('medium');
    navigate(selectedScreen.to);
  }, [impact, navigate, selectedScreen.to]);

  useEffect(() => {
    return configureMainButton?.({
      text: 'Open Default Screen',
      enabled: true,
      onClick: openSelectedScreen
    });
  }, [configureMainButton, openSelectedScreen]);

  const toggleHaptics = () => {
    const nextValue = !hapticsEnabled;
    setHapticsEnabled(nextValue);

    if (nextValue) {
      impact('light');
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
            <Settings size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Mini App settings</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Telegram-native preferences</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--tg-subtitle-text-color)]">
              Tune the native Telegram controls, default workspace route, and account handoff state for this device.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Smartphone} label="Runtime" value={telegram.available ? 'Telegram' : 'Preview'} tone={telegram.available ? 'accent' : 'warn'} />
        <StatCard icon={Vibrate} label="Haptics" value={hapticsEnabled ? 'Enabled' : 'Muted'} />
        <StatCard icon={UserRound} label="Account" value={user || profile ? 'Linked' : 'Guest'} tone={user || profile ? 'accent' : 'warn'} />
      </div>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">
              <Vibrate size={15} />
              Telegram haptics
            </div>
            <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">
              {hapticsEnabled ? 'Feedback is on' : 'Feedback is muted'}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
              Controls tactile feedback for Mini App buttons and successful actions on Telegram clients that support haptics.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hapticsEnabled}
            aria-label="Telegram haptics"
            onClick={toggleHaptics}
            className={`flex h-12 w-24 shrink-0 items-center rounded-full p-1 transition active:scale-95 ${
              hapticsEnabled
                ? 'justify-end bg-[var(--tg-button-color)]'
                : 'justify-start bg-[var(--tg-secondary-bg-color)]'
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tg-button-text-color)] text-[var(--tg-button-color)] shadow-sm">
              <Vibrate size={17} />
            </span>
          </button>
        </div>
      </section>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Default screen</p>
            <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--tg-text-color)]">
              Open {selectedScreen.label}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
              Save the first workspace you want one tap away from the native Main Button.
            </p>
          </div>
          <button
            type="button"
            onClick={openSelectedScreen}
            className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)] shadow-sm transition active:scale-[0.98]"
          >
            Open
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {defaultScreenOptions.map((option) => {
            const Icon = option.icon;
            const active = option.id === defaultScreen;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setDefaultScreen(option.id);
                  telegram.impact('light');
                }}
                className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-[22px] px-3 py-3 text-xs font-black transition active:scale-[0.98] ${
                  active
                    ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
                    : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-hint-color)]'
                }`}
                aria-pressed={active}
              >
                <Icon size={19} />
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard icon={UserRound} title="Identity" body="Review Telegram user, referral code, admin state, and linked Transferly account." to="/miniapp/profile" badge="Account" />
        <ActionCard icon={LifeBuoy} title="Support context" body="Copy a current support bundle with runtime, account, wallet, and latest receipt details." to="/miniapp/support?from=settings" badge="Help" />
      </div>
    </div>
  );
}

export default function MiniAppPage() {
  const {
    section: routeSection = '',
    slug = '',
    lane = '',
    '*': routeTail = ''
  } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Provider workspace routes use a literal /miniapp/services prefix, so
  // they do not receive the generic :section param from the shared page route.
  const section = useMemo(() => {
    if (routeSection) {
      return routeSection;
    }

    const [root, pathSection] = location.pathname.split('/').filter(Boolean);
    return root === 'miniapp' ? (pathSection || 'home') : 'home';
  }, [location.pathname, routeSection]);
  const telegram = useTelegramMiniApp();
  const {
    config,
    user,
    loading,
    profile,
    receipts,
    topUpOrders,
    paymentIssues,
    telegramAuthState
  } = useAppContext();
  const activeSection = sectionMeta[section] ? section : 'home';
  const queryService = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('service') || '';
  }, [location.search]);
  const activeServiceSlug = activeSection === 'services' ? (slug || queryService) : '';
  const activeProviderLane = activeSection === 'services'
    ? (lane || routeTail.split('/').filter(Boolean)[0] || '')
    : '';
  const isProviderLaneRoute = Boolean(
    activeServiceSlug &&
    activeProviderLane &&
    isProviderManifestSlug(activeServiceSlug) &&
    (activeServiceSlug === 'paypal' || location.state?.legacyProviderRedirect)
  );
  const isProviderWorkspaceRoute = isProviderLaneRoute;
  const activeService = activeServiceSlug ? getServiceBySlug(activeServiceSlug) : null;
  const isPayPalWalletService = activeSection === 'services' && activeServiceSlug === 'paypal' && !isProviderWorkspaceRoute;
  const meta = activeService
    ? { title: activeService.title, subtitle: 'Service details' }
    : sectionMeta[activeSection];
  const telegramLaunchDetected = Boolean(telegram.available || telegram.initData);
  const hasVerifiedUser = Boolean(user?.id);
  const authRetryVisible = telegramLaunchDetected && telegramAuthState === 'failed';
  const showTelegramLaunchNotice = !loading &&
    !hasVerifiedUser &&
    telegramAuthState !== 'authenticating' &&
    !authRetryVisible &&
    (!telegramLaunchDetected || ['pending', 'unavailable'].includes(telegramAuthState));

  useEffect(() => {
    if (activeSection !== 'home' || !telegram.startParam) {
      return;
    }

    const [rawTarget] = String(telegram.startParam).toLowerCase().split(':');
    const targetSection = startParamSections[rawTarget];
    if (targetSection) {
      navigate(`/miniapp/${targetSection}`, { replace: true });
    }
  }, [activeSection, navigate, telegram.startParam]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const provider = params.get('provider')?.toLowerCase();

    if (
      activeSection === 'services' &&
      activeServiceSlug &&
      activeServiceSlug === 'paypal' &&
      !activeProviderLane
    ) {
      navigate(`${getProviderWorkspaceRoute(activeServiceSlug)}${location.search}`, { replace: true });
      return;
    }

    if (provider === 'paypal' && activeSection === 'invoices') {
      const targetLane = getPreferredProviderLane(provider, providerCollectionLanePriority);
      navigate(buildProviderWorkspaceRedirect(location.search, getProviderWorkspaceRoute(provider, targetLane)), { replace: true });
      return;
    }

    if (provider === 'paypal' && activeSection === 'payouts') {
      const targetLane = getPreferredProviderLane(provider, providerSendingLanePriority);
      navigate(buildProviderWorkspaceRedirect(location.search, getProviderWorkspaceRoute(provider, targetLane)), { replace: true });
    }
  }, [activeProviderLane, activeSection, activeServiceSlug, location.search, navigate]);

  return (
    <MiniAppShell title={meta.title} subtitle={meta.subtitle} immersive={isPayPalWalletService}>
      {!isPayPalWalletService ? (
        <SessionHealthStrip
          telegram={telegram}
          telegramAuthState={telegramAuthState}
          loading={loading}
          user={user}
          profile={profile}
        />
      ) : null}
      {showTelegramLaunchNotice ? (
        <TelegramLaunchNotice telegramAuthState={telegramAuthState} botUrl={TELEGRAM_BOT_URL} />
      ) : null}
      {activeSection === 'home' ? (
        <HomeSection
          profile={profile}
          telegram={telegram}
          receipts={receipts}
          topUpOrders={topUpOrders}
          paymentIssues={paymentIssues}
          telegramAuthState={telegramAuthState}
          loading={loading}
        />
      ) : null}
      {activeSection === 'services' ? (
        activeServiceSlug
          ? isProviderWorkspaceRoute
            ? (
              <React.Suspense fallback={<LoadingFallback variant="dashboard" />}>
                <ProviderWorkspaceFoundation slug={activeServiceSlug} lane={activeProviderLane} />
              </React.Suspense>
            )
            : activeServiceSlug === 'paypal' && activeService
              ? <React.Suspense fallback={<LoadingFallback variant="dashboard" />}>
                  <ProviderWorkspaceFoundation slug="paypal" lane="overview" />
                </React.Suspense>
              : <MiniAppServiceDetail slug={activeServiceSlug} profile={profile} config={config} />
          : <ServicesSection />
      ) : null}
      {activeSection === 'studio' ? (
        <React.Suspense fallback={<LoadingFallback variant="dashboard" />}>
          <MiniAppReceiptStudio />
        </React.Suspense>
      ) : null}
      {activeSection === 'invoices' ? (
        <React.Suspense fallback={<LoadingFallback variant="dashboard" />}>
          <InvoicesSection />
        </React.Suspense>
      ) : null}
      {activeSection === 'payouts' ? (
        <React.Suspense fallback={<LoadingFallback variant="dashboard" />}>
          <PayoutsSection />
        </React.Suspense>
      ) : null}
      {activeSection === 'activity' ? (
        <React.Suspense fallback={<LoadingFallback variant="dashboard" />}>
          <ActivitySection />
        </React.Suspense>
      ) : null}
      {activeSection === 'analytics' ? (
        <React.Suspense fallback={<LoadingFallback variant="dashboard" />}>
          <AnalyticsSection />
        </React.Suspense>
      ) : null}
      {activeSection === 'notifications' ? (
        <React.Suspense fallback={<LoadingFallback variant="card" count={3} />}>
          <NotificationsSection />
        </React.Suspense>
      ) : null}
      {activeSection === 'clients' ? (
        <React.Suspense fallback={<LoadingFallback variant="card" count={4} />}>
          <ClientsSection />
        </React.Suspense>
      ) : null}
      {activeSection === 'risk' ? (
        <React.Suspense fallback={<LoadingFallback variant="card" count={3} />}>
          <RiskSection />
        </React.Suspense>
      ) : null}
      {activeSection === 'security' ? (
        <React.Suspense fallback={<LoadingFallback variant="card" count={2} />}>
          <SecuritySection />
        </React.Suspense>
      ) : null}
      {activeSection === 'vault' ? (
        <React.Suspense fallback={<LoadingFallback variant="dashboard" />}>
          <MiniAppReceiptVault />
        </React.Suspense>
      ) : null}
      {activeSection === 'orders' ? <OrdersSection topUpOrders={topUpOrders} telegram={telegram} /> : null}
      {activeSection === 'wallet' ? (
        <React.Suspense fallback={<LoadingFallback variant="card" count={2} />}>
          <MiniAppPointsWallet />
        </React.Suspense>
      ) : null}
      {activeSection === 'ops' ? (
        <React.Suspense fallback={<LoadingFallback variant="dashboard" />}>
          <ProviderCommandCenter />
        </React.Suspense>
      ) : null}
      {activeSection === 'support' ? (
        <SupportSection
          telegram={telegram}
          profile={profile}
          user={user}
          receipts={receipts}
          topUpOrders={topUpOrders}
          paymentIssues={paymentIssues}
        />
      ) : null}
      {activeSection === 'profile' ? <ProfileSection telegram={telegram} profile={profile} user={user} /> : null}
      {activeSection === 'settings' ? <SettingsSection telegram={telegram} profile={profile} user={user} /> : null}
    </MiniAppShell>
  );
}
