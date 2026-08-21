import React from 'react';
import { Globe, DollarSign, RefreshCw, Zap } from 'lucide-react';
import { ProviderOverview } from '../shared/BaseProviderUI';

/**
 * WiseOverview — Overview tab for the Wise Platform provider workspace.
 *
 * Adds Wise-specific callouts: multi-currency balance summary,
 * transfer stats, and FX rate preview chip.
 */
export default function WiseOverview({ manifest, dashboard, snapshot, loading, error }) {
  // Flatten Wise balances array for the callout
  const balances = Array.isArray(dashboard?.balances)
    ? dashboard.balances
    : (dashboard?.balances?.data ?? []);

  return (
    <ProviderOverview
      manifest={manifest}
      dashboard={dashboard}
      snapshot={snapshot}
      loading={loading}
      error={error}
    >
      <section className="space-y-3">
        {/* Quick-action chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: Globe, label: 'Multi-Currency Balances', hint: 'View all Wise currency accounts' },
            { icon: DollarSign, label: 'Create Quote', hint: 'Preview FX rate and transfer cost' },
            { icon: RefreshCw, label: 'List Transfers', hint: 'Browse Wise transfer history' },
            { icon: Zap, label: 'Webhook Events', hint: 'Wise webhook delivery log' }
          ].map(({ icon: Icon, label, hint }) => (
            <button
              key={label}
              type="button"
              title={hint}
              aria-label={hint}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-2xl border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] px-3 text-xs font-black text-[var(--miniapp-text-primary)] transition-opacity hover:opacity-80 active:opacity-60"
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Wise stat callouts */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              Currency Accounts
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              {balances.length > 0 ? `${balances.length} accounts` : '—'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              Multi-currency borderless balances via /v4/profiles
            </p>
          </div>
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              Transfers
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              {dashboard?.transfers?.totalElements ?? dashboard?.transfers?.total ?? '—'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              Profile-scoped · transfers#state-change webhooks
            </p>
          </div>
        </div>

        {/* Profile ID status */}
        <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] px-4 py-3">
          <p className="text-xs font-black text-[var(--miniapp-text-muted)]">
            Profile configured:{' '}
            <span className="font-black text-[var(--miniapp-text-primary)]">
              {snapshot?.configured ? 'yes' : 'no — set WISE_API_TOKEN + WISE_PROFILE_ID'}
            </span>
          </p>
        </div>
      </section>
    </ProviderOverview>
  );
}
