import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { getAdminProductionReadiness } from '../../lib/api';
import SurfaceCard from '../ui/SurfaceCard';

const STATUS_STYLES = {
  PASS: 'text-emerald-300 bg-emerald-400/10 border-emerald-300/30',
  WARN: 'text-amber-200 bg-amber-300/10 border-amber-300/30',
  FAIL: 'text-red-200 bg-red-400/10 border-red-300/30',
  NOT_CONFIGURED: 'text-slate-200 bg-slate-400/10 border-slate-300/30'
};

function StatusIcon({ status }) {
  if (status === 'PASS') return <CheckCircle2 size={16} />;
  if (status === 'FAIL') return <XCircle size={16} />;
  return <ShieldAlert size={16} />;
}

export default function AdminReadinessTab() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAdminProductionReadiness()
      .then((result) => { if (active) setReport(result); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Readiness report unavailable.'); });
    return () => { active = false; };
  }, []);

  if (error) return <SurfaceCard className="p-5 text-sm font-bold text-red-200">{error}</SurfaceCard>;
  if (!report) return <SurfaceCard className="p-5 text-sm font-bold text-[var(--tg-hint-color)]">Loading production readiness…</SurfaceCard>;

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Production readiness</p><h2 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Operational scale gate</h2><p className="mt-2 max-w-2xl text-sm text-[var(--tg-subtitle-text-color)]">Machine-readable signals from queues, outbox processing, providers, reconciliation, environment, and security controls.</p></div>
          <div className="rounded-2xl border border-[var(--miniapp-accent-border)] bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-right"><p className="text-xs font-bold text-[var(--tg-hint-color)]">Final status</p><p className="mt-1 text-lg font-black text-[var(--tg-text-color)]">{report.status.replaceAll('_', ' ')}</p></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Object.entries(report.summary || {}).map(([key, value]) => <div key={key} className="rounded-2xl bg-[var(--tg-secondary-bg-color)] p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{key}</p><p className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">{value}</p></div>)}
        </div>
      </SurfaceCard>
      <div className="grid gap-3 lg:grid-cols-2">
        {report.checks.map((item) => <SurfaceCard as="article" key={`${item.category}-${item.name}`} className="p-4"><div className="flex items-start gap-3"><span className={`mt-0.5 rounded-full border p-1.5 ${STATUS_STYLES[item.status] || STATUS_STYLES.NOT_CONFIGURED}`} aria-label={item.status}><StatusIcon status={item.status} /></span><div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black text-[var(--tg-text-color)]">{item.name}</h3><span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{item.category}</span></div><p className="mt-2 text-sm text-[var(--tg-subtitle-text-color)]">{item.detail}</p></div></div></SurfaceCard>)}
      </div>
      {report.recovery ? <SurfaceCard className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Recovery readiness</p><h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">Backup and restore evidence</h2><p className="mt-2 text-sm text-[var(--tg-subtitle-text-color)]">A configured backup is not treated as verified until a controlled restore has been recorded.</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${report.recovery.status === 'READY' ? STATUS_STYLES.PASS : STATUS_STYLES.WARN}`}>{report.recovery.status.replaceAll('_', ' ')}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[var(--tg-secondary-bg-color)] p-4"><p className="text-xs font-bold text-[var(--tg-hint-color)]">Database</p><p className="mt-1 font-black text-[var(--tg-text-color)]">{report.recovery.database.engine}</p></div><div className="rounded-2xl bg-[var(--tg-secondary-bg-color)] p-4"><p className="text-xs font-bold text-[var(--tg-hint-color)]">RPO</p><p className="mt-1 font-black text-[var(--tg-text-color)]">{report.recovery.targets.rpo}</p></div><div className="rounded-2xl bg-[var(--tg-secondary-bg-color)] p-4"><p className="text-xs font-bold text-[var(--tg-hint-color)]">RTO</p><p className="mt-1 font-black text-[var(--tg-text-color)]">{report.recovery.targets.rto}</p></div></div>{report.recovery.nextActions?.length ? <ul className="mt-4 list-disc space-y-1 pl-5 text-sm font-bold text-amber-100">{report.recovery.nextActions.map((action) => <li key={action}>{action}</li>)}</ul> : null}</SurfaceCard> : null}
      <SurfaceCard className="p-5"><div className="flex items-center gap-2"><Activity size={18} className="text-[var(--tg-button-color)]" /><h2 className="text-lg font-black text-[var(--tg-text-color)]">Provider evidence</h2></div><div className="mt-4 space-y-3">{(report.providerHealth || []).map((provider) => <div key={provider.provider} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--tg-secondary-bg-color)] p-4"><div><p className="font-black text-[var(--tg-text-color)]">{provider.display_name}</p><p className="text-xs text-[var(--tg-hint-color)]">{provider.reasons?.[0] || 'No active health warnings.'}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${provider.status === 'operational' ? STATUS_STYLES.PASS : STATUS_STYLES.WARN}`}>{provider.status}</span></div>)}</div></SurfaceCard>
    </div>
  );
}
