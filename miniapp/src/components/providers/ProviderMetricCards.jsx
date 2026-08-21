import React from 'react';
import { Activity, Gauge, ShieldCheck, WalletCards } from 'lucide-react';

function readBalanceSummary(balances) {
  const data = balances?.data || balances;
  const available = data?.available || data?.available_balance || data?.amount || data?.balance;
  const currency = data?.currency || data?.available_currency || data?.default_currency || '';

  if (available !== undefined && available !== null) {
    return `${available}${currency ? ` ${currency}` : ''}`;
  }

  return balances?.status || 'Not loaded';
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-1 ring-[var(--provider-accent-border)]">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{label}</p>
          <p className="mt-1 text-lg font-black text-[var(--tg-text-color)]">{value}</p>
          {detail ? <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}

export default function ProviderMetricCards({ dashboard, snapshot }) {
  const readyOperations = Array.isArray(dashboard?.preflight)
    ? dashboard.preflight.filter((item) => item.allowed).length
    : (dashboard?.readiness?.summary?.live_operations || 0);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        icon={Gauge}
        label="Readiness"
        value={dashboard?.readiness?.status || snapshot?.readiness?.status || 'preview'}
        detail={dashboard?.readiness?.ready ? 'Provider operations are available.' : 'Setup gates are explicit.'}
      />
      <Metric
        icon={Activity}
        label="Operations"
        value={`${readyOperations} ready`}
        detail="Actions stay behind preflight checks."
      />
      <Metric
        icon={WalletCards}
        label="Balance"
        value={readBalanceSummary(dashboard?.balances || snapshot?.balance)}
        detail="Balance data is shown only when supported."
      />
      <Metric
        icon={ShieldCheck}
        label="Risk"
        value={dashboard?.risk_flags?.summary || `${dashboard?.risk_flags?.items?.length || 0} flags`}
        detail="Reconciliation and risk signals stay visible."
      />
    </section>
  );
}
