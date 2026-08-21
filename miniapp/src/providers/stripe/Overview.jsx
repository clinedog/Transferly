import React from 'react';
import { CreditCard, ArrowRightLeft, AlertCircle, Zap } from 'lucide-react';
import { ProviderOverview } from '../shared/BaseProviderUI';

/**
 * StripeOverview — Overview tab for the Stripe Connect provider workspace.
 *
 * Adds Stripe-specific callouts: payment intents summary, connected account
 * status, quick-action chips for Stripe-branded actions.
 */
export default function StripeOverview({ manifest, dashboard, snapshot, loading, error }) {
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
            { icon: CreditCard, label: 'Payment Intents', hint: 'Browse Stripe payment intents' },
            { icon: ArrowRightLeft, label: 'Transfer Funds', hint: 'Transfer to connected account' },
            { icon: AlertCircle, label: 'Disputes', hint: 'Review open Stripe disputes' },
            { icon: Zap, label: 'Webhook Events', hint: 'Stripe webhook delivery log' }
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

        {/* Stripe stat callouts */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              Payment Intents
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              {dashboard?.payments?.total ?? '—'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              Stripe Connect · payment_intent.succeeded → pending_balance
            </p>
          </div>
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              Connected Account
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              {snapshot?.connectedAccountId ? 'Linked' : '—'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              Transfers use transfer_to_connected_account mode
            </p>
          </div>
        </div>

        {/* Payouts-enabled flag */}
        <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] px-4 py-3">
          <p className="text-xs font-black text-[var(--miniapp-text-muted)]">
            Payouts enabled:{' '}
            <span className="font-black text-[var(--miniapp-text-primary)]">
              {snapshot?.payoutsEnabled ? 'yes' : 'no — set STRIPE_PAYOUTS_ENABLED=true'}
            </span>
            {' · '}
            API version:{' '}
            <span className="font-black text-[var(--miniapp-text-primary)]">
              {snapshot?.apiVersion ?? '2026-02-25.clover'}
            </span>
          </p>
        </div>
      </section>
    </ProviderOverview>
  );
}
