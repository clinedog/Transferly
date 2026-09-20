import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createMyApiKey,
  listMyApiKeys,
  listMySessions,
  revokeMyApiKey,
  revokeMySession,
  rotateMyApiKey
} from '../lib/api';

const SCOPES = [
  ['payments:read', 'Read payments'],
  ['payments:write', 'Create payments'],
  ['payouts:read', 'Read payouts'],
  ['payouts:write', 'Create payouts'],
  ['invoices:read', 'Read invoices'],
  ['invoices:write', 'Create invoices'],
  ['transactions:read', 'Read transactions'],
  ['providers:read', 'Read providers'],
  ['reports:read', 'Read reports'],
  ['organization:read', 'Read organization']
];

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}

function ActionButton({ children, danger = false, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border border-[#eadfce] bg-[#faf7f1] text-slate-700 hover:border-[#f2c39a] hover:text-slate-950'
      }`}
    >
      {children}
    </button>
  );
}

export default function SecurityCenterSection() {
  const [state, setState] = useState({ loading: true, error: '', sessions: [], keys: [] });
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState(['transactions:read']);
  const [secret, setSecret] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [sessionsResult, keysResult] = await Promise.all([listMySessions(), listMyApiKeys()]);
      setState({
        loading: false,
        error: '',
        sessions: sessionsResult?.data || sessionsResult?.sessions || [],
        keys: keysResult?.data || keysResult?.keys || []
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Security settings are unavailable.' }));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeSessions = useMemo(
    () => state.sessions.filter((session) => session.status === 'active'),
    [state.sessions]
  );

  const toggleScope = (scope) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope]
    );
  };

  const createKey = async (event) => {
    event.preventDefault();
    if (!keyName.trim() || !selectedScopes.length) {
      toast.error('Add a key name and at least one scope.');
      return;
    }
    setBusyId('create');
    try {
      const result = await createMyApiKey({ name: keyName.trim(), scopes: selectedScopes });
      setSecret(result?.secret || result?.key?.secret || '');
      setKeyName('');
      toast.success('API key created. Copy the secret now; it will not be shown again.');
      await load();
    } catch (error) {
      toast.error(error.message || 'Unable to create API key.');
    } finally {
      setBusyId('');
    }
  };

  const rotateKey = async (key) => {
    if (!window.confirm(`Rotate “${key.name}”? The current secret will stop working.`)) return;
    setBusyId(key.id);
    try {
      const result = await rotateMyApiKey(key.id);
      setSecret(result?.secret || result?.key?.secret || '');
      toast.success('API key rotated. Copy the new secret now.');
      await load();
    } catch (error) {
      toast.error(error.message || 'Unable to rotate API key.');
    } finally {
      setBusyId('');
    }
  };

  const revokeKey = async (key) => {
    if (!window.confirm(`Revoke “${key.name}”? This cannot be undone.`)) return;
    setBusyId(key.id);
    try {
      await revokeMyApiKey(key.id);
      toast.success('API key revoked.');
      await load();
    } catch (error) {
      toast.error(error.message || 'Unable to revoke API key.');
    } finally {
      setBusyId('');
    }
  };

  const revokeSession = async (session) => {
    if (session.isCurrent) {
      toast.error('The current session can only be ended by signing out.');
      return;
    }
    if (!window.confirm('Revoke this session?')) return;
    setBusyId(session.id);
    try {
      await revokeMySession(session.id);
      toast.success('Session revoked.');
      await load();
    } catch (error) {
      toast.error(error.message || 'Unable to revoke session.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-[#e9e0d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Security center</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Control access without exposing secrets.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              API secrets are displayed only at creation or rotation. Session and key changes are authorized and audited by the API.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-full border border-[#eadfce] bg-[#faf7f1] p-3 text-slate-600" aria-label="Refresh security center">
            <RefreshCw size={16} className={state.loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {state.error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{state.error}</div> : null}

      {secret ? (
        <div role="status" className="rounded-[26px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 shrink-0 text-amber-700" size={20} />
            <div className="min-w-0 flex-1">
              <p className="font-black text-amber-950">Copy this secret now</p>
              <p className="mt-1 text-xs text-amber-800">Transferly will never display it again.</p>
              <code className="mt-3 block break-all rounded-xl bg-white/70 p-3 text-xs font-bold text-amber-950">{secret}</code>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton onClick={() => navigator.clipboard.writeText(secret).then(() => toast.success('Secret copied.'))}>
                  <Copy size={14} /> Copy secret
                </ActionButton>
                <ActionButton onClick={() => setSecret('')}>Dismiss</ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[30px] border border-[#e9e0d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
        <div className="flex items-center gap-3">
          <Smartphone size={19} className="text-emerald-600" />
          <div><h3 className="text-lg font-black text-slate-950">Sessions</h3><p className="text-sm text-slate-500">{activeSessions.length} active session{activeSessions.length === 1 ? '' : 's'}</p></div>
        </div>
        <div className="mt-4 space-y-2">
          {state.sessions.map((session) => (
            <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#faf7f1] p-4">
              <div><p className="text-sm font-black text-slate-950">{session.isCurrent ? 'Current session' : 'Telegram/API session'}</p><p className="mt-1 text-xs text-slate-500">Created {formatDate(session.createdAt)} · {session.status}</p></div>
              {session.isCurrent ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700"><Check size={13} /> Current</span> : <ActionButton danger disabled={busyId === session.id} onClick={() => revokeSession(session)}>Revoke</ActionButton>}
            </div>
          ))}
          {!state.loading && !state.sessions.length ? <p className="text-sm text-slate-500">No session records available.</p> : null}
        </div>
      </section>

      <section className="rounded-[30px] border border-[#e9e0d2] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-7">
        <div className="flex items-center gap-3"><ShieldCheck size={19} className="text-[var(--tg-button-color)]" /><div><h3 className="text-lg font-black text-slate-950">API keys</h3><p className="text-sm text-slate-500">Use least-privilege scopes for integrations.</p></div></div>
        <form onSubmit={createKey} className="mt-5 rounded-2xl bg-[#faf7f1] p-4">
          <label className="block text-sm font-black text-slate-700">Key name<input value={keyName} onChange={(event) => setKeyName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e6ddd0] bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-[#f2c39a]" placeholder="Reporting integration" /></label>
          <fieldset className="mt-4"><legend className="text-sm font-black text-slate-700">Scopes</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{SCOPES.map(([scope, label]) => <label key={scope} className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} />{label}</label>)}</div></fieldset>
          <button type="submit" disabled={busyId === 'create'} className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-50"><KeyRound size={14} /> Create API key</button>
        </form>
        <div className="mt-4 space-y-2">
          {state.keys.map((key) => <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eee5d8] p-4"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{key.name}</p><p className="mt-1 text-xs text-slate-500">{key.prefix || 'Secret hidden'} · {key.status} · created {formatDate(key.createdAt)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{(key.scopes || []).join(', ')}</p></div><div className="flex gap-2"><ActionButton disabled={busyId === key.id || key.status !== 'active'} onClick={() => rotateKey(key)}>Rotate</ActionButton><ActionButton danger disabled={busyId === key.id || key.status !== 'active'} onClick={() => revokeKey(key)}><Trash2 size={14} /> Revoke</ActionButton></div></div>)}
          {!state.loading && !state.keys.length ? <p className="text-sm text-slate-500">No API keys created.</p> : null}
        </div>
      </section>
    </div>
  );
}
