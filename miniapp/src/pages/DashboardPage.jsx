import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileClock,
  LifeBuoy,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useAppContext } from '../context/AppContext';
import ServiceLogo from '../components/ServiceLogo';
import { dashboardPreviewSlugs, getServiceBySlug } from '../lib/servicesCatalog';
import { isServiceAvailable } from '../lib/serviceCatalogueContract';
import { StatusBadge } from '../components/ui';

// PayPal is the hero service for this MVP
const heroService = {
  slug: 'paypal',
  title: 'PayPal',
  badge: 'Live',
  status: 'available',
  description: 'Send invoices, request payouts, and manage your PayPal payments directly.',
  launchTo: '/services/paypal',
  launchLabel: 'Open PayPal',
  accent: { bg: '#003087', fg: '#ffffff', edge: '#1d4ed8' },
  mark: 'PP',
};

// Coming soon services - intentional, not broken
const comingSoonServices = [
  { slug: 'stripe', title: 'Stripe' },
  { slug: 'paystack', title: 'Paystack' },
  { slug: 'flutterwave', title: 'Flutterwave' },
  { slug: 'crypto', title: 'Crypto' },
];

const TELEGRAM_MODAL_KEY = 'transferly_telegram_community_seen';

function TelegramCommunityModal() {
  const [open, setOpen] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(TELEGRAM_MODAL_KEY) !== 'true';
  });

  const close = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TELEGRAM_MODAL_KEY, 'true');
    }
    setOpen(false);
  };

  if (!open) return null;

  const benefits = [
    { icon: LifeBuoy, text: 'Get help & answers to your questions' },
    { icon: Wallet, text: 'Learn how to buy & manage points' },
    { icon: CheckCircle2, text: "Report vendors who haven't released points" },
    { icon: Sparkles, text: 'Updates, tips & community support' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8">
      <div className="relative w-full max-w-md rounded-[30px] bg-white p-6 shadow-[0_32px_100px_rgba(15,23,42,0.28)]">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          aria-label="Close"
        >
          <X size={17} />
        </button>

        <div className="pr-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#229ed9]/10 text-[#229ed9]">
            <Users size={24} />
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950">
            Join our Telegram Community
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Stay connected for updates, support & more</p>
        </div>

        <div className="mt-6 space-y-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.text}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#229ed9]/10 text-[#229ed9]">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="text-sm font-bold text-slate-700">{benefit.text}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-3">
          <a
            href="https://t.me/+DhQqLRVqOHpmMmQ0"
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#229ed9] px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
          >
            Join Telegram Channel
          </a>
          <button
            type="button"
            onClick={close}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-slate-300"
          >
            I&apos;ve already joined
          </button>
        </div>
      </div>
    </div>
  );
}

function PointsConversionNote() {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
      1 Point = ₦1
    </p>
  );
}

export default function DashboardPage() {
  const { user, profile, config, topUpOrders, pointsFundingRequests } = useAppContext();
  const brand = config?.brand_color || '#f8812d';
  const firstName = (profile?.name || user?.email || 'there').split(' ')[0];

  // PayPal-focused service preview: PayPal first, then other available services
  const availableServices = useMemo(
    () =>
      dashboardPreviewSlugs
        .map((slug) => getServiceBySlug(slug))
        .filter(Boolean)
        .filter(isServiceAvailable),
    []
  );

  const awaitingFunding = useMemo(
    () =>
      (pointsFundingRequests || []).filter((r) =>
        ['PAYMENT_INSTRUCTIONS', 'PAYMENT_REPORTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'].includes(
          r.status
        )
      ),
    [pointsFundingRequests]
  );

  const recentTopUp = topUpOrders[0] || null;
  const pointsBalance = Number(profile?.points || 0);

  const quickActions = [
    { label: 'Buy Points', icon: TrendingUp, to: '/buy-point', tone: 'primary' },
    { label: 'Services', icon: Sparkles, to: '/services', tone: 'default' },
    { label: 'Orders', icon: FileClock, to: '/orders', tone: 'default' },
    { label: 'Transactions', icon: Wallet, to: '/history', tone: 'default' },
  ];

  return (
    <DashboardLayout>
      <TelegramCommunityModal />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        {/* Header - Welcome with action */}
        <section className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Dashboard</p>
          <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950">
            Welcome back, {firstName}
          </h1>
        </section>

        {/* BALANCE HERO - Answers "How many points do I have?" */}
        <section>
          <div
            className="rounded-[28px] p-6 text-white shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
            style={{ background: `linear-gradient(135deg, #0f172a 0%, #1e293b 100%)` }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
                  Available Balance
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-[-0.04em] md:text-6xl">
                    {pointsBalance.toLocaleString()}
                  </span>
                  <span className="text-lg font-semibold text-white/70">Points</span>
                </div>
                <p className="mt-1 text-sm font-bold text-white/60">
                  ≈ ₦{pointsBalance.toLocaleString()}
                </p>
                <PointsConversionNote />
              </div>
              <div className="hidden md:block">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${brand}33` }}
                >
                  <Wallet className="h-7 w-7" style={{ color: brand }} />
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => (window.location.href = '/buy-point')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white transition active:scale-[0.99]"
                style={{ backgroundColor: brand }}
              >
                <TrendingUp size={16} />
                Buy Points
              </button>
              <Link
                to="/wallet"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                <Wallet size={16} />
                View Wallet
              </Link>
            </div>
          </div>
        </section>

        {/* ATTENTION BANNER - If funding needs review */}
        {awaitingFunding.length > 0 ? (
          <section>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Clock3 size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-amber-900">
                    {awaitingFunding.length} funding {awaitingFunding.length === 1 ? 'request' : 'requests'} awaiting review
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-amber-800/80">
                    Your payment evidence is being verified. No action needed.
                  </p>
                </div>
                <Link
                  to="/wallet"
                  className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white transition hover:bg-amber-700"
                >
                  Review
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* QUICK ACTIONS - Answers "What can I do now?" */}
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  to={action.to}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: action.tone === 'primary' ? `${brand}1a` : '#f1f5f9' }}
                  >
                    <Icon
                      size={18}
                      style={{ color: action.tone === 'primary' ? brand : '#475569' }}
                    />
                  </div>
                  <span className="text-xs font-black">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* PAYPAL HERO - The active service */}
        <section>
          <Link
            to={heroService.launchTo}
            className="group flex items-center gap-4 rounded-3xl p-5 text-white shadow-[0_18px_48px_rgba(0,48,135,0.28)] transition hover:translate-y-[-2px]"
            style={{ backgroundColor: heroService.accent.bg }}
          >
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              {heroService.mark}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-black tracking-[-0.02em]">{heroService.title}</p>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-200">
                  Available Now
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white/75">
                {heroService.description}
              </p>
            </div>
            <ArrowRight
              size={20}
              className="shrink-0 text-white/60 transition group-hover:translate-x-1 group-hover:text-white"
            />
          </Link>
        </section>

        {/* AVAILABLE + COMING SOON SERVICES */}
        <section>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Available */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Available Services
              </p>
              <div className="space-y-2">
                {availableServices
                  .filter((s) => s.slug !== heroService.slug)
                  .slice(0, 3)
                  .map((service) => (
                    <Link
                      key={service.slug}
                      to={`/services/${service.slug}`}
                      className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <ServiceLogo service={service} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-950">
                          {service.title}
                        </p>
                        {service.description ? (
                          <p className="truncate text-xs font-semibold text-slate-500">
                            {service.description}
                          </p>
                        ) : null}
                      </div>
                      <ArrowRight
                        size={16}
                        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
                      />
                    </Link>
                  ))}
              </div>
            </div>
            {/* Coming Soon */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                More Coming Soon
              </p>
              <div className="space-y-2">
                {comingSoonServices.map((svc) => (
                  <div
                    key={svc.slug}
                    className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200/50 text-slate-400">
                      <Sparkles size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-500">{svc.title}</p>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Coming Soon
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* RECENT ACTIVITY - Answers "What needs my attention?" */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Recent Activity
            </p>
            <Link
              to="/history"
              className="text-xs font-black text-slate-600 transition hover:text-slate-950"
            >
              View all
            </Link>
          </div>

          {recentTopUp || awaitingFunding.length > 0 ? (
            <div className="space-y-2">
              {awaitingFunding.slice(0, 3).map((req) => (
                <Link
                  key={req.id || req.order_id}
                  to="/wallet"
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-slate-300"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Clock3 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">
                      {Number(req.points || req.display_amount || 0).toLocaleString()} Points &middot; Under Review
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {new Date(req.created_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status="pending" size="sm" animated={false} />
                </Link>
              ))}
              {recentTopUp ? (
                <Link
                  to="/orders"
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-slate-300"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50" style={{ color: brand }}>
                    <TrendingUp size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">
                      {recentTopUp.amount_label || `${Number(recentTopUp.points || 0).toLocaleString()} pts`}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {new Date(recentTopUp.created_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge
                    status={recentTopUp.status === 'completed' ? 'completed' : 'pending'}
                    size="sm"
                    animated={false}
                  />
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
              <p className="text-sm font-black text-slate-700">No recent activity</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Your funding and service activity will appear here.
              </p>
              <Link
                to="/buy-point"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-black"
                style={{ color: brand }}
              >
                Buy Points <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
