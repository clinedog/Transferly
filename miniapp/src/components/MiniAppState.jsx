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
  }
};

const alertTones = new Set(['error', 'offline', 'unavailable', 'rate-limited', 'forbidden', 'auth', 'provider', 'config']);

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
        className="flex max-w-sm flex-col items-center gap-4 rounded-[8px] border border-[var(--miniapp-border-color,rgba(245,248,255,0.12))] bg-[var(--tg-section-bg-color,#15263a)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
        role={isAlert ? 'alert' : 'status'}
        aria-live={isAlert ? 'assertive' : 'polite'}
        aria-label={title || config.title}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-[var(--miniapp-border-color,rgba(245,248,255,0.12))] bg-[var(--tg-secondary-bg-color,#111f32)] shadow-sm">
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
            className="miniapp-pressable miniapp-touch-target inline-flex items-center gap-2 rounded-[8px] bg-[var(--tg-button-color,#2aabee)] px-5 text-sm font-black text-[var(--tg-button-text-color,#ffffff)] shadow-sm motion-safe:transition disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100"
          >
            <RefreshCw className={`h-4 w-4 ${actionDisabled ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            {actionLabel || 'Try again'}
          </button>
        )}
      </section>
    </main>
  );
}
