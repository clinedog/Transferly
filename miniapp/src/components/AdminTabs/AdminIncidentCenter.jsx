import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { listAdminProviderIncidents } from '../../lib/api';
import SurfaceCard from '../ui/SurfaceCard';

const STATUS_STYLES = {
  DETECTED: 'border-red-300/30 bg-red-400/10 text-red-100',
  ACKNOWLEDGED: 'border-blue-300/30 bg-blue-400/10 text-blue-100',
  INVESTIGATING: 'border-amber-300/30 bg-amber-300/10 text-amber-100'
};

export default function AdminIncidentCenter() {
  const [state, setState] = useState({ loading: true, error: '', incidents: [] });
  const load = () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    return listAdminProviderIncidents()
      .then((result) => setState({ loading: false, error: '', incidents: result.data || [] }))
      .catch((error) => setState({ loading: false, error: error.message || 'Incident data unavailable.', incidents: [] }));
  };
  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Provider reliability</p><h2 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Incident center</h2><p className="mt-2 text-sm text-[var(--tg-subtitle-text-color)]">Incidents are derived only from backend health evidence and unresolved payment-operation issues.</p></div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--tg-button-color)] px-4 py-3 text-sm font-black text-[var(--tg-button-text-color)]"><RefreshCw size={16} className={state.loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </SurfaceCard>
      {state.error ? <SurfaceCard role="alert" className="p-4 text-sm font-bold text-red-200">{state.error}</SurfaceCard> : null}
      {!state.loading && !state.incidents.length ? <SurfaceCard className="p-6 text-center"><CheckCircle2 className="mx-auto text-emerald-300" /><p className="mt-3 font-black text-[var(--tg-text-color)]">No active provider incidents</p><p className="mt-1 text-sm text-[var(--tg-hint-color)]">No degraded provider or unresolved provider-linked issue is currently reported.</p></SurfaceCard> : null}
      <div className="grid gap-3 lg:grid-cols-2">{state.incidents.map((incident) => <SurfaceCard as="article" key={incident.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{incident.display_name}</p><h3 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">{incident.affected_operation}</h3></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${STATUS_STYLES[incident.status] || STATUS_STYLES.INVESTIGATING}`}><AlertTriangle className="mr-1 inline" size={13} />{incident.status}</span></div><p className="mt-4 text-sm text-[var(--tg-subtitle-text-color)]">{incident.impact}</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-2xl bg-[var(--tg-secondary-bg-color)] p-3"><p className="font-bold text-[var(--tg-hint-color)]">Owner</p><p className="mt-1 font-black text-[var(--tg-text-color)]">{incident.ownerRole || 'Unassigned'}</p></div><div className="rounded-2xl bg-[var(--tg-secondary-bg-color)] p-3"><p className="font-bold text-[var(--tg-hint-color)]">Health score</p><p className="mt-1 text-lg font-black text-[var(--tg-text-color)]">{incident.evidence.health_score ?? 'Unavailable'}</p></div><div className="rounded-2xl bg-[var(--tg-secondary-bg-color)] p-3"><p className="font-bold text-[var(--tg-hint-color)]">Open issues</p><p className="mt-1 text-lg font-black text-[var(--tg-text-color)]">{incident.evidence.unresolved_issues}</p></div><div className="rounded-2xl bg-[var(--tg-secondary-bg-color)] p-3"><p className="font-bold text-[var(--tg-hint-color)]">Runbook</p>{incident.runbookUrl ? <a className="mt-1 block truncate font-black text-[var(--tg-link-color)] underline" href={incident.runbookUrl}>{incident.runbookKey || 'Open runbook'}</a> : <p className="mt-1 font-black text-[var(--tg-text-color)]">Unavailable</p>}</div></div>{incident.next_actions?.length ? <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs font-bold text-amber-100">{incident.next_actions.slice(0, 3).join(' ')}</div> : null}</SurfaceCard>)}</div>
    </div>
  );
}
