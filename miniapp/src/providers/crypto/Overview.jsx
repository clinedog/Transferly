import React from 'react';
import { Bitcoin, Link, AlertCircle, Zap } from 'lucide-react';
import { ProviderOverview } from '../shared/BaseProviderUI';

/**
 * CryptoOverview — Overview tab for the Crypto Commerce (Coinbase Commerce) workspace.
 *
 * Adds crypto-specific callouts: charge count, pricing type, and
 * quick-action chips for crypto payment operations.
 */
export default function CryptoOverview({ manifest, dashboard, snapshot, loading, error }) {
  const charges = Array.isArray(dashboard?.charges?.data)
    ? dashboard.charges.data
    : [];

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
            { icon: Bitcoin, label: 'Create Charge', hint: 'Generate a Coinbase Commerce crypto payment request' },
            { icon: Link, label: 'Hosted URL', hint: 'Open hosted_url for buyer payment' },
            { icon: AlertCircle, label: 'Pending Charges', hint: 'View charges awaiting confirmation' },
            { icon: Zap, label: 'Webhook Events', hint: 'Crypto Commerce webhook delivery log' }
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

        {/* Crypto stat callouts */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              Charges
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              {dashboard?.charges?.pagination?.total ?? charges.length > 0 ? charges.length : '—'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              charge:confirmed → pending_balance · HMAC-SHA256 verified
            </p>
          </div>
          <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--miniapp-text-muted)]">
              Pricing type
            </p>
            <p className="mt-2 text-base font-black text-[var(--miniapp-text-primary)]">
              fixed_price
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">
              Buyer pays exact fiat-equivalent in chosen crypto
            </p>
          </div>
        </div>

        {/* Key notes */}
        <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] px-4 py-3 space-y-1">
          <p className="text-xs font-black text-[var(--miniapp-text-muted)]">
            Crypto Commerce has <span className="font-black text-[var(--miniapp-text-primary)]">no direct payout API</span>.
            Funds are received as crypto charges and reconciled via the hosted checkout.
          </p>
          <p className="text-xs font-semibold text-[var(--miniapp-text-muted)]">
            Webhook verified via{' '}
            <span className="font-black text-[var(--miniapp-text-primary)]">X-CC-Webhook-Signature</span>{' '}
            (HMAC-SHA256 · CRYPTO_COMMERCE_WEBHOOK_SECRET).
          </p>
        </div>
      </section>
    </ProviderOverview>
  );
}
