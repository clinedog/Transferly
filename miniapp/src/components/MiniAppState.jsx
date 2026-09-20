import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  PlugZap,
  RefreshCw,
  ServerCrash,
  ShieldAlert,
  TimerReset,
  WifiOff
} from 'lucide-react';

const stateTone = {
  loading: {
    icon: Loader2,
    iconClassName: 'motion-safe:animate-spin text-[var(--tg-button-color)]',
    title: 'Loading workspace',
    description: 'Preparing your wallet command center.'
  },
  empty: {
    icon: AlertCircle,
    iconClassName: 'text-[var(--tg-hint-color)]',
    title: 'Nothing here yet',
    description: 'New activity will appear here as soon as it is available.'
  },
  success: {
    icon: CheckCircle2,
    iconClassName: 'text-emerald-500',
    title: 'Done',
    description: 'Your action was completed.'
  },
  processing: {
    icon: Loader2,
    iconClassName: 'motion-safe:animate-spin text-[var(--tg-button-color)]',
    title: 'Processing',
    description: 'The financial action is in progress. Transferly is waiting for provider confirmation.'
  },
  unknown: {
    icon: AlertCircle,
    iconClassName: 'text-slate-500',
    title: 'State is still unknown',
    description: 'Transferly is waiting on authoritative provider or ledger confirmation before this action is marked complete.'
  },
  reconciling: {
    icon: RefreshCw,
    iconClassName: 'motion-safe:animate-spin text-amber-500',
    title: 'Reconciliation required',
    description: 'This transaction needs review because the provider outcome is not yet confirmed.'
  },
  reconciliation: {
    icon: RefreshCw,
    iconClassName: 'motion-safe:animate-spin text-amber-500',
    title: 'Reconciliation required',
    description: 'This transaction needs review because the provider outcome is not yet confirmed.'
  },
  error: {
    icon: AlertCircle,
    iconClassName: 'text-red-500',
    title: 'Unable to load this view',
    description: 'Try again or return to another section.'
  },
  offline: {
    icon: WifiOff,
    iconClassName: 'text-amber-500',
    title: 'You appear offline',
    description: 'Transferly will reconnect when your network is available again.'
  },
  unavailable: {
    icon: ServerCrash,
    iconClassName: 'text-amber-500',
    title: 'Transferly is temporarily unavailable',
    description: 'The service is not reachable right now. Retry when the connection recovers.'
  },
  'rate-limited': {
    icon: TimerReset,
    iconClassName: 'text-amber-500',
    title: 'Too many requests',
    description: 'Wait a moment before retrying this action.'
  },
  forbidden: {
    icon: ShieldAlert,
    iconClassName: 'text-red-500',
    title: 'Access restricted',
    description: 'This workspace requires additional Transferly permissions.'
  },
  auth: {
    icon: LockKeyhole,
    iconClassName: 'text-[var(--tg-button-color)]',
    title: 'Secure session required',
    description: 'Open Transferly from Telegram again or retry session verification.'
  },
  provider: {
    icon: PlugZap,
    iconClassName: 'text-amber-500',
    title: 'Provider workspace unavailable',
    description: 'This provider lane is not ready for live actions yet.'
  },
  config: {
    icon: ShieldAlert,
    iconClassName: 'text-red-500',
    title: 'Configuration required',
    description: 'Transferly needs a production setting before this view can run safely.'
  },
  'session-expired': {
    icon: LockKeyhole,
    iconClassName: 'text-[var(--tg-button-color)]',
    title: 'Secure session required',
    description: 'Open Transferly from Telegram again or retry session verification.'
  },
  'coming-soon': {
    icon: PlugZap,
    iconClassName: 'text-[var(--miniapp-accent-pink)]',
    title: 'Coming soon',
    description: 'This capability is not available yet. Check back later.'
  },
  sandbox: {
    icon: PlugZap,
    iconClassName: 'text-[var(--tg-button-color)]',
    title: 'Sandbox mode',
    description: 'This operation is running in a safe test environment. Real funds are not affected.'
  },
  maintenance: {
    icon: ServerCrash,
    iconClassName: 'text-amber-400',
    title: 'Maintenance in progress',
    description: 'This Transferly capability is temporarily paused while we improve reliability.'
  }
};

const alertTones = new Set(['error', 'offline', 'unavailable', 'rate-limited', 'forbidden', 'auth', 'provider', 'config', 'unknown', 'reconciling', 'reconciliation', 'session-expired', 'maintenance']);

export function MiniAppState({
  tone = 'loading',
  title,
  description,
  secondaryDetail,
  requestId,
  retryAfter,
  actionLabel,
  onAction,
  actionDisabled = false,
  compact = false
}) {
  const config = stateTone[tone] || stateTone.loading;
  const Icon = config.icon;
  const isAlert = alertTones.has(tone);

  return (
    <main
      className={`flex w-full items-center justify-center px-5 text-center ${compact ? 'min-h-[240px]' : 'min-h-screen bg-[var(--tg-bg-color,#0b1524)]'}`}
    >
      <section
        className="flex max-w-sm flex-col items-center gap-4 rounded-[var(--miniapp-radius-card,24px)] border border-[var(--miniapp-border)] bg-[var(--miniapp-card-surface)] p-6 shadow-[var(--miniapp-shadow-card)]"
        role={isAlert ? 'alert' : 'status'}
        aria-live={isAlert ? 'assertive' : 'polite'}
        aria-label={title || config.title}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--miniapp-border)] bg-[var(--miniapp-panel-bg)] shadow-sm">
          <Icon className={`h-6 w-6 ${config.iconClassName}`} aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-black text-[var(--tg-text-color,#111827)]">
            {title || config.title}
          </h1>
          <p className="text-sm font-semibold leading-6 text-[var(--tg-hint-color,#64748b)]">
            {description || config.description}
          </p>
          {secondaryDetail && (
            <p className="text-xs font-semibold leading-5 text-[var(--tg-hint-color,#64748b)]">
              {secondaryDetail}
            </p>
          )}
          {requestId && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tg-hint-color,#64748b)]">
              Request ID: {requestId}
            </p>
          )}
          {retryAfter ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tg-hint-color,#64748b)]">
              Retry after: {retryAfter}s
            </p>
          ) : null}
        </div>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            aria-busy={actionDisabled ? 'true' : undefined}
            aria-label={actionLabel || 'Try again'}
            className="miniapp-pressable miniapp-touch-target inline-flex items-center gap-2 rounded-full bg-[var(--tg-button-color)] px-5 text-sm font-black text-[var(--tg-button-text-color)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--miniapp-focus-ring)] motion-safe:transition disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100"
          >
            <RefreshCw className={`h-4 w-4 ${actionDisabled ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            {actionLabel || 'Try again'}
          </button>
        )}
      </section>
    </main>
  );
}
