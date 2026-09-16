import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, WalletCards, Activity } from 'lucide-react';
import { getAdminFinanceOverview, getAdminRiskOverview, listAdminPointsFunding, listPaymentProviderHealth } from '../../lib/api';
import { useAppContext } from '../../context/AppContext';

function StatCard({ label, value, detail, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-950',
    blue: 'border-blue-100 bg-blue-50 text-blue-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    red: 'border-red-100 bg-red-50 text-red-950',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-950'
  };
  return <article className={'rounded-2xl border p-4 shadow-sm ' + tones[tone]}><p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{label}</p><p className="mt-2 text-3xl font-black">{value}</p>{detail ? <p className="mt-1 text-xs font-semibold opacity-70">{detail}</p> : null}</article>;
}

function providerStatus(provider) {
  return String(provider.status || provider.provider_status || 'unknown').replaceAll('_', ' ');
}

export default function AdminOverviewTab() {
  const { allUsers, fetchAllUsers } = useAppContext();
  const [state, setState] = useState({ loading: true, error: '', finance: {}, risk: {}, funding: [], providers: [] });

  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const results = await Promise.all([getAdminFinanceOverview(), getAdminRiskOverview(), listAdminPointsFunding({ status: 'PENDING_REVIEW', limit: 25 }), listPaymentProviderHealth()]);
      setState({ loading: false, error: '', finance: results[0]?.overview || {}, risk: results[1]?.overview || {}, funding: results[2]?.data || [], providers: results[3]?.data || [] });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Unable to load operations summary.' }));
      toast.error(error.message || 'Unable to load operations summary.');
    }
  };

  useEffect(() => { void fetchAllUsers(); void load(); }, []);

  if (state.loading) return <div className="flex items-center justify-center py-20" role="status" aria-live="polite"><RefreshCw className="h-8 w-8 animate-spin text-blue-600" /></div>;

  const finance = state.finance;
  const risk = state.risk;
  const reconciliationIssues = Number(finance.reconciliation_issues || 0);
  const pendingFunding = Number(finance.pending_funding || state.funding.length || 0);
  const providerIssues = state.providers.filter((provider) => !['healthy', 'ready', 'live'].includes(providerStatus(provider).toLowerCase()));
  const exceptionCount = pendingFunding + reconciliationIssues + Number(risk.open_cases || 0) + providerIssues.length;

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Operations command center</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Exception-first overview</h2><p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">Routine successful operations stay out of the queue. Focus attention on funding reviews, risk cases, provider incidents, and reconciliation work.</p></div><button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"><RefreshCw size={16} /> Refresh</button></header>
    {state.error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">{state.error}</div> : null}
    <section aria-label="Operational exceptions" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Open exceptions" value={exceptionCount.toLocaleString()} detail="Requires operator attention" tone={exceptionCount ? 'red' : 'green'} /><StatCard label="Funding reviews" value={pendingFunding.toLocaleString()} detail="Points not yet released" tone={pendingFunding ? 'amber' : 'green'} /><StatCard label="Risk cases" value={Number(risk.open_cases || 0).toLocaleString()} detail={Number(risk.critical_alerts || 0) + ' critical alerts'} tone={risk.open_cases ? 'red' : 'green'} /><StatCard label="Reconciliation" value={finance.reconciliation_status || 'UNKNOWN'} detail={reconciliationIssues + ' open issues'} tone={reconciliationIssues ? 'red' : 'green'} /><StatCard label="Provider incidents" value={providerIssues.length.toLocaleString()} detail={state.providers.length + ' providers monitored'} tone={providerIssues.length ? 'amber' : 'green'} /></section>
    <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 p-5"><ShieldAlert className="text-red-600" /><div><h3 className="text-lg font-black text-slate-950">Attention queue</h3><p className="text-sm font-semibold text-slate-500">Operational work grouped by financial risk.</p></div></div><div className="grid gap-3 p-5 sm:grid-cols-2"><div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><WalletCards className="text-amber-700" size={20} /><p className="mt-3 text-sm font-black text-amber-950">Funding requests</p><p className="mt-1 text-xs font-semibold text-amber-800">{pendingFunding} requests awaiting review or evidence.</p></div><div className="rounded-2xl border border-red-100 bg-red-50 p-4"><AlertTriangle className="text-red-700" size={20} /><p className="mt-3 text-sm font-black text-red-950">Risk and reconciliation</p><p className="mt-1 text-xs font-semibold text-red-800">{Number(risk.open_cases || 0) + reconciliationIssues} cases need investigation.</p></div></div></div>
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 p-5"><Activity className="text-blue-600" /><div><h3 className="text-lg font-black text-slate-950">Provider health</h3><p className="text-sm font-semibold text-slate-500">Backend-reported readiness and health only.</p></div></div><div className="space-y-3 p-5">{state.providers.slice(0, 6).map((provider) => { const status = providerStatus(provider); const healthy = ['healthy', 'ready', 'live'].includes(status.toLowerCase()); return <div key={provider.provider || provider.slug || provider.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3"><div><p className="text-sm font-black text-slate-950">{provider.display_name || provider.provider || provider.slug}</p><p className="text-xs font-semibold capitalize text-slate-500">{status}</p></div>{healthy ? <CheckCircle2 className="text-emerald-600" size={18} /> : <AlertTriangle className="text-amber-600" size={18} />}</div>; })}{!state.providers.length ? <p className="text-sm font-semibold text-slate-500">Provider health is unavailable.</p> : null}</div></div>
    </section>
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h3 className="text-lg font-black text-slate-950">Platform snapshot</h3><p className="text-sm font-semibold text-slate-500">Authoritative backend summaries, not frontend-calculated balances.</p></div><span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{allUsers.length} users loaded</span></div><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Points in circulation" value={Number(finance.total_points_in_circulation || 0).toLocaleString()} tone="green" /><StatCard label="Total funding" value={Number(finance.total_funding_minor || 0).toLocaleString()} detail="Minor currency units" tone="blue" /><StatCard label="Pending reviews" value={Number(finance.needs_review || 0).toLocaleString()} tone="amber" /><StatCard label="Critical alerts" value={Number(risk.critical_alerts || 0).toLocaleString()} tone="red" /></div></section>
  </div>;
}
