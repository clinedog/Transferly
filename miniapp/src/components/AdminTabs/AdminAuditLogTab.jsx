import { useEffect, useState } from 'react';
import { RefreshCw, Search, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { listAdminAuditLogs } from '../../lib/api';

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return [];
  return Object.entries(metadata).filter(([key]) => !/(token|secret|password|credential|authorization)/i.test(key)).slice(0, 6);
}

export default function AdminAuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const payload = await listAdminAuditLogs({ action: action.trim() || undefined, limit: 100 });
      setLogs(payload.data || []);
    } catch (error) {
      toast.error(error.message || 'Audit log could not be loaded');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Immutable operations</p><h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Audit log</h2><p className="mt-1 max-w-3xl text-sm font-semibold text-gray-500">Read-only operational events from the backend audit table. Sensitive authentication material is never rendered.</p></div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </header>
      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2"><Search size={16} className="text-gray-400" /><input value={action} onChange={(event) => setAction(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} placeholder="Filter by action" className="min-w-0 flex-1 border-0 text-sm font-semibold outline-none" /></label>
          <button type="button" onClick={load} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">Search</button>
        </div>
      </section>
      {loading ? <div className="py-16 text-center text-sm font-bold text-gray-500">Loading audit events…</div> : logs.length ? <div className="space-y-3">{logs.map((entry) => <article key={entry.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-blue-600" size={18} /><div className="min-w-0"><p className="truncate text-sm font-black text-gray-950">{entry.action}</p><p className="mt-1 text-xs font-semibold text-gray-500">{entry.actorType}{entry.actorId ? ` · ${entry.actorId}` : ''} · {entry.entityType}:{entry.entityId}</p></div></div><time className="shrink-0 text-xs font-bold text-gray-400">{new Date(entry.createdAt).toLocaleString()}</time></div>{safeMetadata(entry.metadata).length ? <dl className="mt-4 grid gap-2 sm:grid-cols-2">{safeMetadata(entry.metadata).map(([key, value]) => <div key={key} className="rounded-xl bg-gray-50 p-3"><dt className="text-[11px] font-black uppercase tracking-wide text-gray-400">{key}</dt><dd className="mt-1 break-words text-xs font-bold text-gray-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl> : null}</article>)}</div> : <div className="rounded-3xl border border-dashed border-gray-300 p-12 text-center text-sm font-bold text-gray-500">No audit events match the filter.</div>}
    </div>
  );
}
