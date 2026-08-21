import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  LifeBuoy,
  Settings,
  ShieldCheck,
  WalletCards
} from 'lucide-react';

const DEFAULT_TELEGRAM_BOT_URL = 'https://t.me/TransferlyBot';

export function TelegramLaunchNotice({ telegramAuthState, botUrl = DEFAULT_TELEGRAM_BOT_URL }) {
  const authFailed = telegramAuthState === 'failed';

  return (
    <section
      aria-label="Telegram launch required"
      className="overflow-hidden rounded-[30px] border border-[var(--tg-button-color)]/25 bg-[var(--tg-section-bg-color)] shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
    >
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex min-w-0 gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
            <Bot size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-button-color)]">
              Telegram required
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">
              Open Transferly from Telegram
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
              {authFailed
                ? 'Telegram sign-in could not be verified. Relaunch from the bot so orders, wallet actions, and receipts attach to your account.'
                : 'Browser preview is available, but wallet actions, receipt history, and orders need a Telegram session from the bot.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <a
            href={botUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[var(--tg-button-color)] px-4 py-3 text-sm font-black text-[var(--tg-button-text-color)] transition active:scale-[0.98]"
          >
            Open in Telegram
            <ArrowRight size={16} />
          </a>
          <Link
            to="/miniapp/support?from=telegram-launch"
            className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-black text-[var(--tg-text-color)] transition active:scale-[0.98]"
          >
            Support
            <LifeBuoy size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SessionHealthStrip({ telegram, telegramAuthState, loading, user, profile }) {
  const points = Number(profile?.points || 0).toLocaleString();
  const telegramLaunchDetected = Boolean(telegram.available || telegram.initData);
  const sessionLabel = (() => {
    if (telegramAuthState === 'failed') {
      return 'Retry needed';
    }

    if (telegramAuthState === 'authenticating' || (telegramLaunchDetected && loading)) {
      return 'Checking';
    }

    if (telegramAuthState === 'authenticated' && user?.id) {
      return 'Verified';
    }

    if (telegramLaunchDetected && !user?.id) {
      return 'Telegram pending';
    }

    return 'Preview mode';
  })();

  const sessionDetail = (() => {
    if (telegramAuthState === 'failed') {
      return 'Use Retry to reconnect';
    }

    if (telegramAuthState === 'authenticating' || (telegramLaunchDetected && loading)) {
      return 'Validating launch data';
    }

    if (telegramAuthState === 'authenticated' && user?.id) {
      return telegramLaunchDetected ? 'Telegram session detected' : 'Browser preview mode';
    }

    if (telegramLaunchDetected) {
      return 'Telegram session detected';
    }

    return 'Browser preview mode';
  })();

  const items = [
    {
      label: telegramLaunchDetected ? 'Telegram launch' : 'Browser launch',
      detail: telegramLaunchDetected ? 'WebApp detected' : 'Open from Telegram',
      icon: Bot,
      tone: telegramLaunchDetected ? 'success' : 'warn'
    },
    {
      label: sessionLabel,
      detail: sessionDetail,
      icon: telegramAuthState === 'failed' ? AlertCircle : ShieldCheck,
      tone: telegramAuthState === 'failed' ? 'danger' : user?.id ? 'success' : 'warn'
    },
    {
      label: user?.id ? `${points} pts` : 'Wallet locked',
      detail: user?.id ? 'Balance ready' : 'Session required',
      icon: WalletCards,
      tone: user?.id ? 'success' : 'warn'
    },
    {
      label: loading ? 'Syncing' : user?.id ? 'Online' : 'Limited',
      detail: loading ? 'Refreshing account' : user?.id ? 'API connected' : 'Read-only preview',
      icon: loading ? Clock3 : CheckCircle2,
      tone: user?.id ? 'success' : 'info'
    }
  ];

  return (
    <section
      aria-label="Mini app session health"
      className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Session health</p>
          <h2 className="mt-1 text-xl font-black text-[var(--tg-text-color)]">Wallet readiness</h2>
        </div>
        <Link
          to="/miniapp/settings?from=session-health"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--tg-secondary-bg-color)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)]"
        >
          Settings
          <Settings size={14} />
        </Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const toneClass =
            item.tone === 'danger'
              ? 'text-[var(--tg-destructive-text-color)]'
              : item.tone === 'success'
                ? 'text-[var(--tg-button-color)]'
                : 'text-[var(--tg-hint-color)]';

          return (
            <div key={item.label} className="rounded-[22px] bg-[var(--tg-secondary-bg-color)] p-3">
              <Icon className={toneClass} size={18} />
              <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">{item.label}</p>
              <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
