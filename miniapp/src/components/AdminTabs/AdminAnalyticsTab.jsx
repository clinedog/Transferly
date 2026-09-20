import React, { useEffect, useState } from 'react';
import { downloadAdminFinanceAnalyticsCsv, downloadAdminFinanceAnalyticsPdf, getAdminFinanceAnalytics } from '../../lib/api';
import SurfaceCard from '../ui/SurfaceCard';

const periods = [
  ['today', 'Today'],
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['90d', '90 days']
  ,['custom', 'Custom']
];

function number(value) {
  return Number(value || 0).toLocaleString();
}

function Metric({ label, value, detail }) {
  return (
    <SurfaceCard className="p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">{value}</p>
      {detail ? <p className="mt-1 text-xs font-semibold text-[var(--tg-subtitle-text-color)]">{detail}</p> : null}
    </SurfaceCard>
  );
}

export default function AdminAnalyticsTab() {
  const [period, setPeriod] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });

  const downloadReport = async () => {
    const range = period === 'custom' && customRange.from && customRange.to
      ? { from: new Date(customRange.from).toISOString(), to: new Date(customRange.to).toISOString() }
      : {};
    const blob = await downloadAdminFinanceAnalyticsCsv({ period, ...range });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `transferly-finance-${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdfReport = async () => {
    const range = period === 'custom' && customRange.from && customRange.to
      ? { from: new Date(customRange.from).toISOString(), to: new Date(customRange.to).toISOString() }
      : {};
    const blob = await downloadAdminFinanceAnalyticsPdf({ period, ...range });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `transferly-finance-${period}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let active = true;
    setError('');
    const range = period === 'custom' && customRange.from && customRange.to
      ? { from: new Date(customRange.from).toISOString(), to: new Date(customRange.to).toISOString() }
      : {};
    getAdminFinanceAnalytics({ period, ...range })
      .then((payload) => { if (active) setAnalytics(payload.analytics); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Analytics unavailable.'); });
    return () => { active = false; };
  }, [period, customRange]);

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Financial intelligence</p><h2 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Authoritative analytics</h2><p className="mt-2 text-sm text-[var(--tg-subtitle-text-color)]">Aggregated from ledger, provider transaction, funding, and issue records.</p></div>
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-xl border border-[var(--miniapp-accent-border)] bg-[var(--tg-secondary-bg-color)] px-3 py-2 text-sm font-bold text-[var(--tg-text-color)]" aria-label="Analytics period">
            {periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {period === 'custom' ? <><input type="datetime-local" value={customRange.from} onChange={(event) => setCustomRange({ ...customRange, from: event.target.value })} className="rounded-xl border border-[var(--miniapp-accent-border)] bg-[var(--tg-secondary-bg-color)] px-2 py-2 text-xs text-[var(--tg-text-color)]" aria-label="Analytics from" /><input type="datetime-local" value={customRange.to} onChange={(event) => setCustomRange({ ...customRange, to: event.target.value })} className="rounded-xl border border-[var(--miniapp-accent-border)] bg-[var(--tg-secondary-bg-color)] px-2 py-2 text-xs text-[var(--tg-text-color)]" aria-label="Analytics to" /></> : null}
          <button type="button" onClick={downloadReport} className="rounded-xl border border-[var(--miniapp-accent-border)] px-3 py-2 text-sm font-black text-[var(--tg-text-color)]">Download CSV</button>
          <button type="button" onClick={downloadPdfReport} className="rounded-xl border border-[var(--miniapp-accent-border)] px-3 py-2 text-sm font-black text-[var(--tg-text-color)]">Download PDF</button>
        </div>
      </SurfaceCard>
      {error ? <SurfaceCard className="p-5 text-sm font-bold text-red-200">{error}</SurfaceCard> : null}
      {!analytics && !error ? <SurfaceCard className="p-5 text-sm font-bold text-[var(--tg-hint-color)]">Loading analytics…</SurfaceCard> : null}
      {analytics ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Net flow" value={`${number(analytics.net_flow_points)} pts`} detail={`${number(analytics.money_in_points)} in · ${number(analytics.money_out_points)} out`} />
        <Metric label="Provider volume" value={number(analytics.payment_volume_minor)} detail={`${number(analytics.payment_count)} transactions · ${number(analytics.payment_average_value_minor)} average`} />
        <Metric label="Payment success" value={analytics.payment_success_rate == null ? '—' : `${(analytics.payment_success_rate * 100).toFixed(1)}%`} detail={`${number(analytics.payment_success_count)} successful · ${number(analytics.payment_failure_count)} failed`} />
        <Metric label="Funding volume" value={number(analytics.funding_volume_minor)} detail={`${number(analytics.funding_collected_count)} collected · ${number(analytics.funding_pending_count)} pending`} />
        <Metric label="Ledger activity" value={number(analytics.ledger_transaction_count)} detail="Authoritative point-ledger entries" />
        <Metric label="Open issues" value={number(analytics.open_payment_issues)} detail="Payment operations exceptions" />
        <Metric label="Payout volume" value={number(analytics.payout_volume_minor)} detail={`${number(analytics.payout_count)} payouts · ${number(analytics.payout_average_value_minor)} average · ${analytics.payout_success_rate == null ? '—' : `${(analytics.payout_success_rate * 100).toFixed(1)}% success`}`} />
        <Metric label="Invoice revenue" value={number(analytics.invoice_revenue_minor)} detail={`${number(analytics.invoice_average_value_minor)} average · ${number(analytics.invoice_outstanding_minor)} outstanding · ${number(analytics.invoice_overdue_minor)} overdue`} />
      </div> : null}
      {analytics?.provider_distribution?.length ? <SurfaceCard className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Provider analytics</p>
        <div className="mt-4 space-y-3">{analytics.provider_distribution.map((provider) => <div key={provider.provider} className="grid gap-2 border-b border-[var(--miniapp-accent-border)] pb-3 text-sm sm:grid-cols-6"><span className="font-black text-[var(--tg-text-color)]">{provider.provider}</span><span className="text-[var(--tg-subtitle-text-color)]">{number(provider.count)} transactions</span><span className="text-[var(--tg-subtitle-text-color)]">{number(provider.volume_minor)} volume</span><span className="text-[var(--tg-subtitle-text-color)]">{provider.success_rate == null ? '—' : `${(provider.success_rate * 100).toFixed(1)}% success`}</span><span className="text-[var(--tg-subtitle-text-color)]">{number(provider.fees_minor)} fees</span><span className="text-[var(--tg-subtitle-text-color)]">{provider.average_latency_ms == null ? '—' : `${Math.round(provider.average_latency_ms)} ms latency`}</span></div>)}</div>
      </SurfaceCard> : null}
    </div>
  );
}
