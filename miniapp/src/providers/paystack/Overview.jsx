import React from 'react';
import { CreditCard, ArrowUpRight, CheckCircle, Zap } from 'lucide-react';
import { ProviderOverview } from '../shared/BaseProviderUI';

/**
 * PaystackOverview — Overview tab for the Paystack provider workspace.
 *
 * Adds Paystack-specific callouts: NGN balance, transaction count,
 * and quick-action chips for Paystack-branded operations.
 */
export default function PaystackOverview({ manifest, dashboard, snapshot, loading, error }) {
  // Paystack balance is an array of { currency, balance } objects
  const balances = Array.isArray(dashboard?.balances)
    ? dashboard.balances
    : (Array.isArray(dashboard?.balances?.data) ? dashboard.balances.data : []);
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
            { icon: CreditCard, label: 'Initialize Transaction', hint: 'Create a Paystack payment (charge)' },
            { icon: ArrowUpRight, label: 'Initiate Transfer', hint: 'Send NGN via Paystack transfer' },
            { icon: CheckCircle, label: 'Verify Transaction', hint: 'Verify a charge reference' },
            { icon: Zap, label: 'Webhook Events', hint: 'Paystack webhook delivery log' }
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

        {/* Paystack stat callouts */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              NGN Balance
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              {ngnBalance ? `₦${(ngnBalance.balance / 100).toLocaleString()}` : '—'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              Kobo-denominated · Paystack /balance endpoint
            </p>
          </div>
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              Transactions
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              {dashboard?.transactions?.total ?? '—'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              charge.success → pending_balance · HMAC-SHA512 verified
            </p>
          </div>
        </div>

        {/* Key note */}
        <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] px-4 py-3">
          <p className="text-xs font-black text-[var(--miniapp-text-muted)]">
            Amounts are in <span className="font-black text-[var(--miniapp-text-primary)]">kobo</span> (1 NGN = 100 kobo).
            Webhook secret verified via{' '}
            <span className="font-black text-[var(--miniapp-text-primary)]">X-Paystack-Signature</span> (HMAC-SHA512).
          </p>
        </div>
      </section>
    </ProviderOverview>
  );
}
