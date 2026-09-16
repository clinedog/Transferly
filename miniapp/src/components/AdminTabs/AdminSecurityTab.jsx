import React, { useEffect, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { getAdminSecurityOverview } from '../../lib/api';
import SurfaceCard from '../ui/SurfaceCard';

export default function AdminSecurityTab() {
  const [state, setState] = useState({ loading: true, error: '', overview: null });
  const load = () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    return getAdminSecurityOverview()
      .then((overview) => setState({ loading: false, error: '', overview }))
      .catch((error) => setState({ loading: false, error: error.message || 'Security overview unavailable.', overview: null }));
  };
  useEffect(() => { void load(); }, []);
  const overview = state.overview;
  return (
    <div className="space-y-4">
      <SurfaceCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Security center</p><h2 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Account and control posture</h2><p className="mt-2 text-sm text-[var(--tg-subtitle-text-color)]">Evidence from server-side authentication, rate-limit, provider credential, and audit controls. Secrets are never returned.</p></div><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--tg-button-color)] px-4 py-3 text-sm font-black text-[var(--tg-button-text-color)]"><RefreshCw size={16} className={state.loading ? 'animate-spin' : ''} /> Refresh</button></div></SurfaceCard>
      {state.error ? <SurfaceCard role="alert" className="p-4 text-sm font-bold text-red-200">{state.error}</SurfaceCard> : null}
      {overview ? <><div className="grid gap-3 sm:grid-cols-3"><SurfaceCard className="p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Status</p><p className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">{overview.status.replaceAll('_', ' ')}</p></SurfaceCard><SurfaceCard className="p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Active sessions</p><p className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">{overview.sessions.active}</p></SurfaceCard><SurfaceCard className="p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Provider credentials needing setup</p><p className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">{overview.providerCredentialPosture.missingCredentials}</p></SurfaceCard></div><SurfaceCard className="p-5"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-300" /><h3 className="text-lg font-black text-[var(--tg-text-color)]">Server-side controls</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{[['Admin token', overview.controls.adminTokenConfigured], ['JWT secret', overview.controls.jwtConfigured], ['Webhook verification', overview.controls.webhookVerification], ['Rate limits', overview.controls.authRateLimit.max > 0 && overview.controls.apiRateLimit.max > 0]].map(([label, enabled]) => <div key={label} className="flex items-center justify-between rounded-2xl bg-[var(--tg-secondary-bg-color)] p-4"><span className="text-sm font-black text-[var(--tg-text-color)]">{label}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${enabled ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>{enabled ? 'Configured' : 'Needs attention'}</span></div>)}</div></SurfaceCard><SurfaceCard className="p-5"><div className="flex items-center gap-2"><KeyRound size={18} className="text-[var(--tg-button-color)]" /><h3 className="text-lg font-black text-[var(--tg-text-color)]">Recent security events</h3></div><div className="mt-4 space-y-2">{overview.recentSecurityEvents.length ? overview.recentSecurityEvents.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 rounded-2xl bg-[var(--tg-secondary-bg-color)] p-3 text-sm"><span className="font-black text-[var(--tg-text-color)]">{event.action}</span><span className="text-xs font-bold text-[var(--tg-hint-color)]">{event.createdAt}</span></div>) : <p className="text-sm text-[var(--tg-hint-color)]">No matching security audit events recorded.</p>}</div></SurfaceCard></> : null}
    </div>
  );
}
