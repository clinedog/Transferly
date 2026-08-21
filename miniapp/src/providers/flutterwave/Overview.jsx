import React from 'react';
import { Banknote, ArrowUpRight, Globe, Zap } from 'lucide-react';
import { ProviderOverview } from '../shared/BaseProviderUI';

/**
 * FlutterwaveOverview — Overview tab for the Flutterwave provider workspace.
 *
 * Adds Flutterwave-specific callouts: NGN/multi-currency balance,
 * transaction count, and quick-action chips.
 */
export default function FlutterwaveOverview({ manifest, dashboard, snapshot, loading, error }) {
  const balances = Array.isArray(dashboard?.balances)
    ? dashboard.balances
    : [];
  const ngnBalance = balances.find((b) => b.currency === 'NGN');

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
            { icon: Banknote, label: 'Initiate Payment', hint: 'Create a Flutterwave hosted checkout' },
            { icon: ArrowUpRight, label: 'Bank Transfer', hint: 'Send funds via Flutterwave transfer' },
            { icon: Globe, label: 'All Balances', hint: 'View all Flutterwave currency balances' },
            { icon: Zap, label: 'Webhook Events', hint: 'Flutterwave webhook delivery log' }
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

        {/* Flutterwave stat callouts */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              NGN Balance
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              {ngnBalance
                ? `₦${Number(ngnBalance.available_balance ?? ngnBalance.ledger_balance ?? 0).toLocaleString()}`
                : (balances.length > 0 ? `${balances.length} currencies` : '—')}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              Multi-currency · /balances/:currency
            </p>
          </div>
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              Transactions
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              {dashboard?.transactions?.meta?.total ?? dashboard?.transactions?.total ?? '—'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              charge.completed → pending_balance · verif-hash verified
            </p>
          </div>
        </div>

        {/* Key note */}
        <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] px-4 py-3">
          <p className="text-xs font-black text-[var(--miniapp-text-muted)]">
            Webhook verified via{' '}
            <span className="font-black text-[var(--miniapp-text-primary)]">verif-hash</span>{' '}
            header (constant-time compare · FLUTTERWAVE_WEBHOOK_SECRET).
          </p>
        </div>
      </section>
    </ProviderOverview>
  );
}
