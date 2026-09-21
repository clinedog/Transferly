import React from 'react';
import { Activity, FileText, RefreshCw, Send, Settings, Shield, WalletCards, Zap } from 'lucide-react';
import { ProviderOverview } from '../shared/BaseProviderUI';

/**
 * PayPalOverview — Overview tab for the PayPal provider workspace.
 *
 * Injects PayPal-specific callouts (invoice summary, payout summary,
 * quick-action chips) below the shared metrics via the `children` slot.
 */
export default function PayPalOverview({ manifest, dashboard, snapshot, loading, error }) {
  const environment = String(snapshot?.environment ?? dashboard?.provider?.environment ?? dashboard?.environment ?? 'sandbox').toLowerCase().includes('prod') ? 'Live' : 'Sandbox';
  const cards = [
    ['Invoices', 'Create, send, refresh, and track hosted PayPal invoices.', 'Recipient link, status, reminders, and payment timeline', FileText],
    ['Payouts', 'Submit payout batches, track status, and review payout readiness.', 'Batch state, idempotent submission, and tracking details', Send],
    ['Transactions', 'Review provider transactions and reconcile activity.', 'Search, filter, and inspect linked records', Activity],
    ['Webhooks', 'Verify delivery health, event flow, and signature readiness.', 'Delivery posture, dead-letter checks, and timeline events', Zap],
    ['Readiness', 'Review configuration, environment, and setup status.', 'Sandbox/live mode, webhook state, and required env', Shield],
    ['Balance / Status', 'Operational snapshots and provider health at a glance.', 'Provider readiness, health, and activity status', WalletCards]
  ];
  const actions = ['Open Hosted Invoice', 'Copy Invoice Link', 'Send Reminder', 'Refresh Status', 'Create QR', 'Request Payout', 'View Transactions', 'View Webhooks', 'View Readiness', 'View Settings'];

  return (
    <ProviderOverview
      manifest={manifest}
      dashboard={dashboard}
      snapshot={snapshot}
      loading={loading}
      error={error}
    >
      <section className="space-y-4">
        <div className="rounded-[28px] border border-[#0070e0]/25 bg-[#0070e0]/10 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#0070e0] px-3 py-1 text-xs font-black text-white">{environment}</span>
            <span className="rounded-full border border-[#0070e0]/25 px-3 py-1 text-xs font-black text-[#0070e0]">Transferly Sandbox Simulator</span>
          </div>
          <h2 className="mt-3 text-2xl font-black text-[var(--miniapp-text-primary)]">Sandbox provider console</h2>
          <p className="mt-1 text-sm font-bold text-[var(--miniapp-text-muted)]">PayPal-compatible workflows inside Transferly</p>
          <p className="mt-2 text-xs font-black text-[#0070e0]">Synthetic test data only. No live PayPal account, credentials, or funds are accessed from this simulator.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(([title, copy, secondary, Icon]) => (
            <article key={title} className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
              <Icon size={18} className="text-[#0070e0]" aria-hidden="true" />
              <p className="mt-2 font-black text-[var(--miniapp-text-primary)]">{title}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-muted)]">{copy}</p>
              <p className="mt-2 text-xs font-black text-[#0070e0]">{secondary}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((label, index) => (
            <button key={label} type="button" className={`${index === 0 || index === 5 ? 'bg-[#0070e0] text-white' : 'border border-[#0070e0]/25 bg-[var(--miniapp-card-surface)] text-[var(--miniapp-text-primary)]'} inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3 text-xs font-black`}>
              {index === 3 ? <RefreshCw size={13} /> : index === 9 ? <Settings size={13} /> : null}
              {label}
            </button>
          ))}
        </div>
      </section>
    </ProviderOverview>
  );
}
