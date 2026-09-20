import React, { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { createAdminAutomationRule, listAdminAutomationHistory, listAdminAutomationRules, updateAdminAutomationRuleStatus } from '../../lib/api';
import SurfaceCard from '../ui/SurfaceCard';

const STATUS_STYLES = {
  SUCCEEDED: 'text-emerald-200 bg-emerald-400/10 border-emerald-300/30',
  TRIGGERED: 'text-blue-200 bg-blue-400/10 border-blue-300/30',
  SKIPPED: 'text-amber-200 bg-amber-300/10 border-amber-300/30'
};

export default function AdminAutomationTab() {
  const [state, setState] = useState({ loading: true, error: '', history: [], rules: [] });
  const [draft, setDraft] = useState({ name: '', trigger: 'INVOICE_PAID', action: 'NOTIFY_ADMIN', amount: '' });
  const load = () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    return Promise.all([listAdminAutomationHistory({ limit: 100 }), listAdminAutomationRules()])
      .then(([history, rules]) => setState({ loading: false, error: '', history: history.data || [], rules: rules.data || [] }))
      .catch((error) => setState({ loading: false, error: error.message || 'Automation history unavailable.', history: [] }));
  };
  useEffect(() => { void load(); }, []);
  const createRule = async (event) => {
    event.preventDefault();
    await createAdminAutomationRule({
      name: draft.name,
      trigger: draft.trigger,
      action: draft.action,
      condition: draft.amount === '' ? {} : { amount: Number(draft.amount) }
    });
    setDraft({ name: '', trigger: 'INVOICE_PAID', action: 'NOTIFY_ADMIN', amount: '' });
    await load();
  };

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Automation history</p><h2 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Observed workflows</h2><p className="mt-2 text-sm text-[var(--tg-subtitle-text-color)]">Read-only execution evidence from persisted audit events. Financial actions still require their existing authorization and state machines.</p></div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--tg-button-color)] px-4 py-3 text-sm font-black text-[var(--tg-button-text-color)]"><RefreshCw size={16} className={state.loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </SurfaceCard>
      {state.error ? <SurfaceCard role="alert" className="p-4 text-sm font-bold text-red-200">{state.error}</SurfaceCard> : null}
      <SurfaceCard className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Automation builder</p>
        <form onSubmit={createRule} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Rule name" className="rounded-xl border border-[var(--miniapp-accent-border)] bg-transparent px-3 py-2 text-sm text-[var(--tg-text-color)]" />
          <select value={draft.trigger} onChange={(event) => setDraft({ ...draft, trigger: event.target.value })} className="rounded-xl border border-[var(--miniapp-accent-border)] bg-[var(--tg-secondary-bg-color)] px-3 py-2 text-sm text-[var(--tg-text-color)]"><option>PAYMENT_SUCCEEDED</option><option>PAYMENT_FAILED</option><option>INVOICE_PAID</option><option>INVOICE_OVERDUE</option><option>PAYOUT_SUCCEEDED</option><option>PAYOUT_FAILED</option><option>TRANSACTION_UNKNOWN</option><option>PROVIDER_HEALTH_CHANGED</option></select>
          <select value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })} className="rounded-xl border border-[var(--miniapp-accent-border)] bg-[var(--tg-secondary-bg-color)] px-3 py-2 text-sm text-[var(--tg-text-color)]"><option>NOTIFY_ADMIN</option><option>NOTIFY_USER</option><option>CREATE_RECONCILIATION_TASK</option><option>SEND_RECEIPT</option></select>
          <input type="number" min="0" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="Amount threshold" className="rounded-xl border border-[var(--miniapp-accent-border)] bg-transparent px-3 py-2 text-sm text-[var(--tg-text-color)]" />
          <button type="submit" className="rounded-xl bg-[var(--tg-button-color)] px-4 py-2 text-sm font-black text-[var(--tg-button-text-color)] sm:col-span-2 lg:col-span-4">Create safe rule</button>
        </form>
      </SurfaceCard>
      {state.rules.length ? <div className="grid gap-3 lg:grid-cols-2">{state.rules.map((rule) => <SurfaceCard as="article" key={rule.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-[var(--tg-text-color)]">{rule.name}</p><p className="mt-1 text-xs font-bold text-[var(--tg-hint-color)]">{rule.trigger} → {rule.action}</p></div><button type="button" onClick={() => updateAdminAutomationRuleStatus(rule.id, rule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE').then(load)} className="rounded-xl border border-[var(--miniapp-accent-border)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)]">{rule.status === 'ACTIVE' ? 'Pause' : 'Activate'}</button></div></SurfaceCard>)}</div> : null}
      {!state.loading && !state.history.length ? <SurfaceCard className="p-6 text-center"><History className="mx-auto text-[var(--tg-hint-color)]" /><p className="mt-3 font-black text-[var(--tg-text-color)]">No automation history yet</p><p className="mt-1 text-sm text-[var(--tg-hint-color)]">Persisted reminder configuration events will appear here.</p></SurfaceCard> : null}
      <div className="space-y-3">{state.history.map((entry) => <SurfaceCard as="article" key={entry.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{entry.automation}</p><h3 className="mt-2 text-lg font-black text-[var(--tg-text-color)]">{entry.trigger}</h3></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${STATUS_STYLES[entry.status] || STATUS_STYLES.SKIPPED}`}>{entry.status}</span></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><div><p className="text-xs font-bold text-[var(--tg-hint-color)]">Action</p><p className="mt-1 font-black text-[var(--tg-text-color)]">{entry.action}</p></div><div><p className="text-xs font-bold text-[var(--tg-hint-color)]">Interval</p><p className="mt-1 font-black text-[var(--tg-text-color)]">{entry.conditions.interval || 'Unavailable'}</p></div><div><p className="text-xs font-bold text-[var(--tg-hint-color)]">Repetition</p><p className="mt-1 font-black text-[var(--tg-text-color)]">{entry.conditions.repetition ?? 'Unavailable'}</p></div><div><p className="text-xs font-bold text-[var(--tg-hint-color)]">Timestamp</p><p className="mt-1 break-words font-black text-[var(--tg-text-color)]">{entry.timestamp}</p></div></div></SurfaceCard>)}</div>
    </div>
  );
}
