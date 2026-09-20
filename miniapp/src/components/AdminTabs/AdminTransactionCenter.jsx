import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Search, ShieldAlert, WalletCards } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listAdminFinanceReconciliationAlerts,
  listAdminFinanceTransactions,
  listAdminUnmatchedPayments,
  listPaymentOpsIssues
} from '../../lib/api';
import { StatusPill } from './PaymentsParts';

const statusTone = {
  CREDIT: 'green',
  DEBIT: 'blue',
  OPEN: 'red',
  HIGH: 'red',
  MEDIUM: 'amber',
  SUCCESS: 'green',
  FAILED: 'red',
  UNKNOWN: 'gray'
};

function label(value) {
  return String(value || 'UNKNOWN').replaceAll('_', ' ');
}

function TransactionCard({ item }) {
  const isIssue = item.kind === 'issue' || item.kind === 'reconciliation';
  const title = item.reference_id || item.provider_reference || item.id;
  const detail = item.description || item.summary || item.alert_type || item.issue_type || item.provider || 'Operational record';
  const status = item.status || item.severity || item.match_status || 'UNKNOWN';

  return (
    <article className="miniapp-surface-card miniapp-surface-card-interactive p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[var(--miniapp-text-primary)]">{title}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--miniapp-text-secondary)]">{detail}</p>
        </div>
        <StatusPill value={label(status)} tone={statusTone[String(status).toUpperCase()] || 'gray'} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div><dt className="miniapp-mono-meta text-[var(--miniapp-text-muted)]">Type</dt><dd className="mt-1 font-black text-[var(--miniapp-text-primary)]">{label(item.type || item.kind)}</dd></div>
        <div><dt className="miniapp-mono-meta text-[var(--miniapp-text-muted)]">Provider</dt><dd className="mt-1 font-black text-[var(--miniapp-text-primary)]">{item.provider || 'Ledger'}</dd></div>
        <div><dt className="miniapp-mono-meta text-[var(--miniapp-text-muted)]">User</dt><dd className="mt-1 truncate font-black text-[var(--miniapp-text-primary)]">{item.user_id || 'Not linked'}</dd></div>
        <div><dt className="miniapp-mono-meta text-[var(--miniapp-text-muted)]">Amount</dt><dd className="mt-1 font-black text-[var(--miniapp-text-primary)]">{item.points !== undefined ? `${Number(item.signed_points || item.points).toLocaleString()} pts` : item.amount_minor ? `${Number(item.amount_minor).toLocaleString()} minor` : 'Not available'}</dd></div>
      </dl>
      {isIssue ? <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs font-bold text-rose-200">Exception requires operational review. Provider outcome is not inferred from this record.</p> : null}
    </article>
  );
}

export default function AdminTransactionCenter() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [records, setRecords] = useState([]);
  const [warning, setWarning] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        listAdminFinanceTransactions({ limit: 100, reference: query }),
        listAdminUnmatchedPayments({ limit: 100, query }),
        listAdminFinanceReconciliationAlerts({ status: 'OPEN', limit: 100 }),
        listPaymentOpsIssues({ status: 'open', limit: 100 })
      ]);
      const [transactions, unmatched, reconciliation, issues] = results.map((result) => result.status === 'fulfilled' ? result.value : { data: [] });
      const failedSources = results.filter((result) => result.status === 'rejected').length;
      setWarning(failedSources ? `${failedSources} operational data source${failedSources === 1 ? '' : 's'} could not be loaded. Showing available records.` : '');
      setRecords([
        ...(transactions.data || []).map((item) => ({ ...item, kind: 'ledger' })),
        ...(unmatched.data || []).map((item) => ({ ...item, kind: 'unmatched', status: item.match_status || item.status })),
        ...(reconciliation.data || []).map((item) => ({ ...item, kind: 'reconciliation' })),
        ...(issues.data || []).map((item) => ({ ...item, kind: 'issue' }))
      ]);
    } catch (error) {
      toast.error(error.message || 'Transaction center could not be loaded.');
      setWarning('Transaction data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => records.filter((item) => {
    const haystack = [item.id, item.reference_id, item.provider_reference, item.user_id, item.description, item.issue_type, item.alert_type].filter(Boolean).join(' ').toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || item.kind === filter || String(item.status || '').toLowerCase() === filter;
    return matchesQuery && matchesFilter;
  }), [filter, query, records]);

  const exceptions = records.filter((item) => ['issue', 'reconciliation', 'unmatched'].includes(item.kind)).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="miniapp-mono-meta text-[var(--miniapp-accent-cyan)]">Financial operations</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--miniapp-text-primary)]">Transaction center</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-[var(--miniapp-text-secondary)]">Search ledger activity and exception records without exposing provider credentials or payment secrets.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="miniapp-pressable miniapp-touch-target inline-flex items-center justify-center gap-2 rounded-[var(--miniapp-radius-control)] border border-[var(--miniapp-accent-border)] bg-[var(--miniapp-accent-soft)] px-4 text-sm font-black text-[var(--miniapp-accent-cyan)] disabled:opacity-50"><RefreshCw size={16} className={loading ? 'motion-safe:animate-spin' : ''} /> Refresh</button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="miniapp-surface-card p-4"><WalletCards className="text-[var(--miniapp-accent-cyan)]" size={20} /><p className="miniapp-mono-meta mt-3 text-[var(--miniapp-text-muted)]">Records</p><p className="mt-1 text-2xl font-black text-[var(--miniapp-text-primary)]">{records.length.toLocaleString()}</p></div>
        <div className="rounded-[var(--miniapp-radius-card)] border border-rose-400/20 bg-rose-400/10 p-4"><ShieldAlert className="text-rose-300" size={20} /><p className="miniapp-mono-meta mt-3 text-rose-200">Exceptions</p><p className="mt-1 text-2xl font-black text-rose-100">{exceptions.toLocaleString()}</p></div>
        <div className="rounded-[var(--miniapp-radius-card)] border border-amber-300/20 bg-amber-300/10 p-4"><AlertTriangle className="text-amber-200" size={20} /><p className="miniapp-mono-meta mt-3 text-amber-100">Showing</p><p className="mt-1 text-2xl font-black text-amber-50">{filtered.length.toLocaleString()}</p></div>
      </section>

      <section className="miniapp-surface-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-[var(--miniapp-radius-control)] border border-[var(--miniapp-border)] bg-[var(--miniapp-bg)] px-3 py-2"><Search size={16} className="text-[var(--miniapp-text-muted)]" /><span className="sr-only">Search transactions</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} placeholder="Search transaction, provider reference, user, invoice" className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-[var(--miniapp-text-primary)] outline-none placeholder:text-[var(--miniapp-text-muted)]" /></label>
          <select aria-label="Filter transaction records" value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-12 rounded-[var(--miniapp-radius-control)] border border-[var(--miniapp-border)] bg-[var(--miniapp-bg)] px-3 py-2 text-sm font-bold text-[var(--miniapp-text-primary)]">
            <option value="all">All records</option>
            <option value="ledger">Ledger transactions</option>
            <option value="unmatched">Unmatched payments</option>
            <option value="reconciliation">Reconciliation alerts</option>
            <option value="issue">Provider issues</option>
            <option value="open">Open only</option>
          </select>
          <button type="button" onClick={load} className="miniapp-pressable miniapp-touch-target rounded-[var(--miniapp-radius-control)] bg-[var(--tg-button-color)] px-4 text-sm font-black text-[var(--tg-button-text-color)]">Search</button>
        </div>
      </section>
      {warning ? <div role="alert" className="rounded-[var(--miniapp-radius-card)] border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">{warning}</div> : null}

      {loading ? <div className="miniapp-surface-card flex min-h-40 items-center justify-center p-6 text-sm font-bold text-[var(--miniapp-text-secondary)]" role="status" aria-live="polite">Loading transaction records…</div> : filtered.length ? <div className="grid gap-3 lg:grid-cols-2">{filtered.map((item, index) => <TransactionCard key={`${item.kind}-${item.id || index}`} item={item} />)}</div> : <div className="rounded-[var(--miniapp-radius-card)] border border-dashed border-[var(--miniapp-border)] p-12 text-center text-sm font-bold text-[var(--miniapp-text-secondary)]" role="status">No records match the selected filters.</div>}
    </div>
  );
}
