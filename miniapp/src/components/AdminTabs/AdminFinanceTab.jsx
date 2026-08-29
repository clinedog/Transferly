import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards
} from 'lucide-react';
import {
  approveAdminPointsFundingRequest,
  assignAdminPointsFundingRequest,
  getAdminFinanceOverview,
  getAdminPointsFundingRequest,
  listAdminFinanceReconciliationAlerts,
  listAdminFinanceTransactions,
  listAdminUnmatchedPayments,
  listAdminPointsFunding,
  rejectAdminPointsFundingRequest,
  requestAdminPointsFundingInfo
} from '../../lib/api';
import { StatusPill } from './PaymentsParts';
import { formatDateTime } from './paymentsUtils';

function formatNaira(minor) {
  return `₦${(Number(minor || 0) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function formatPoints(points) {
  return `${Number(points || 0).toLocaleString()} pts`;
}

function fundingTone(status) {
  if (status === 'POINTS_CREDITED') return 'green';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'red';
  if (status === 'NEEDS_MORE_INFORMATION') return 'amber';
  return 'blue';
}

function StatCard({ label, value, detail, tone = 'blue' }) {
  const toneClass = {
    blue: 'border-blue-100 bg-blue-50 text-blue-900',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    red: 'border-red-100 bg-red-50 text-red-900',
    gray: 'border-gray-100 bg-white text-gray-900'
  }[tone] || 'border-gray-100 bg-white text-gray-900';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      {detail ? <p className="mt-1 text-xs font-semibold opacity-70">{detail}</p> : null}
    </div>
  );
}

function FundingDetailDrawer({ busy, detail, onClose, onAction }) {
  if (!detail) return null;
  const request = detail.funding_request || detail;
  const destination = request.destination_snapshot || {};

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:mx-auto sm:max-w-3xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Funding Review</p>
            <h3 className="mt-1 text-2xl font-black text-gray-900">{request.public_reference}</h3>
            <p className="mt-1 text-sm font-semibold text-gray-500">{formatNaira(request.expected_amount_minor)} = {formatPoints(request.requested_points)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm font-bold text-gray-700">Close</button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <StatCard label="User" value={request.user_name || request.user_id} detail={request.user_email || request.user_id} />
          <StatCard label="Status" value={request.status?.replaceAll('_', ' ')} detail={`Risk: ${request.risk_status || 'NORMAL'}`} tone={request.possible_duplicate ? 'amber' : 'gray'} />
          <StatCard label="Point Value" value="1 Point = ₦1" detail={`${formatNaira(request.expected_amount_minor)} payment buys ${formatPoints(request.requested_points)}`} tone="green" />
          <StatCard label="Assigned Admin" value={request.assigned_to || 'Unassigned'} detail={request.assigned_at ? formatDateTime(request.assigned_at) : 'No assignment yet'} />
        </div>

        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Payment destination snapshot</p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-bold text-gray-500">Provider</dt><dd className="font-black text-gray-900">{destination.provider || 'Not set'}</dd></div>
            <div><dt className="font-bold text-gray-500">Account name</dt><dd className="font-black text-gray-900">{destination.account_name || 'Not set'}</dd></div>
            <div><dt className="font-bold text-gray-500">Account number</dt><dd className="font-black text-gray-900">{destination.account_number_masked || destination.account_number || 'Not set'}</dd></div>
            <div><dt className="font-bold text-gray-500">Payment reference</dt><dd className="font-black text-gray-900">{request.payment_reference}</dd></div>
          </dl>
        </div>

        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Evidence</p>
          {request.evidence ? (
            <div className="mt-3 text-sm font-semibold text-gray-700">
              <p>File: {request.evidence.file_id || 'metadata only'}</p>
              <p>MIME: {request.evidence.metadata?.mime_type || 'unknown'}</p>
              <p>Size: {Number(request.evidence.metadata?.size_bytes || 0).toLocaleString()} bytes</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No evidence submitted yet.</p>
          )}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          <button type="button" disabled={busy} onClick={() => onAction('assign', request)} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 disabled:opacity-50">Assign</button>
          <button type="button" disabled={busy} onClick={() => onAction('info', request)} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 disabled:opacity-50">Request info</button>
          <button type="button" disabled={busy} onClick={() => onAction('reject', request)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50">Reject</button>
          <button type="button" disabled={busy} onClick={() => onAction('approve', request)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 disabled:opacity-50">Approve</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminFinanceTab() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [overview, setOverview] = useState(null);
  const [funding, setFunding] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [unmatchedPayments, setUnmatchedPayments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);

  const pendingFunding = useMemo(() => funding.filter((item) => !['POINTS_CREDITED', 'REJECTED', 'CANCELLED'].includes(item.status)), [funding]);

  const load = async () => {
    setLoading(true);
    try {
      const [overviewPayload, fundingPayload, transactionsPayload, unmatchedPayload, alertsPayload] = await Promise.all([
        getAdminFinanceOverview(),
        listAdminPointsFunding({ limit: 100, query }),
        listAdminFinanceTransactions({ limit: 50, reference: query }),
        listAdminUnmatchedPayments({ limit: 50, query }),
        listAdminFinanceReconciliationAlerts({ status: 'OPEN', limit: 50 })
      ]);
      setOverview(overviewPayload.overview || null);
      setFunding(fundingPayload.data || []);
      setTransactions(transactionsPayload.data || []);
      setUnmatchedPayments(unmatchedPayload.data || []);
      setAlerts(alertsPayload.data || []);
    } catch (error) {
      toast.error(error.message || 'Finance data could not be loaded');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (request) => {
    try {
      const payload = await getAdminPointsFundingRequest(request.id);
      setDetail(payload);
    } catch (error) {
      toast.error(error.message || 'Funding request could not be loaded');
    }
  };

  const handleAction = async (action, request) => {
    const reference = request.public_reference;
    try {
      setBusy(`${action}:${request.id}`);
      if (action === 'assign') {
        const assignedTo = window.prompt(`Assign ${reference} to which admin?`, request.assigned_to || 'finance-admin');
        if (!assignedTo) return;
        await assignAdminPointsFundingRequest(request.id, assignedTo);
      }
      if (action === 'info') {
        const note = window.prompt(`Message to user for ${reference}`, 'Please upload a clearer payment confirmation.');
        if (!note) return;
        await requestAdminPointsFundingInfo(request.id, note);
      }
      if (action === 'reject') {
        const reason = window.prompt(`Rejection reason for ${reference}`, 'Payment could not be verified.');
        if (!reason) return;
        await rejectAdminPointsFundingRequest(request.id, reason, reason);
      }
      if (action === 'approve') {
        const confirmed = window.confirm(`Confirm approval for ${reference}?\n${formatNaira(request.expected_amount_minor)} = ${formatPoints(request.requested_points)}`);
        if (!confirmed) return;
        await approveAdminPointsFundingRequest(request.id, 'Approved from Finance Center');
      }
      toast.success('Funding request updated');
      setDetail(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Funding action failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Transferly Finance</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Admin Finance Center</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-gray-500">Funding queue, points ledger, reconciliation, and user finance profiles powered by backend ledger data.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Points in circulation" value={formatPoints(overview?.total_points_in_circulation)} detail="Ledger outstanding" tone="green" />
        <StatCard label="Total funding" value={formatNaira(overview?.total_funding_minor)} detail={`Today: ${formatNaira(overview?.funding_today_minor)}`} tone="blue" />
        <StatCard label="Pending funding" value={Number(overview?.pending_funding || 0).toLocaleString()} detail={`${Number(overview?.needs_review || 0)} need review`} tone="amber" />
        <StatCard label="Reconciliation" value={overview?.reconciliation_status || 'UNKNOWN'} detail={`${Number(overview?.reconciliation_issues || 0)} open issues`} tone={overview?.reconciliation_status === 'HEALTHY' ? 'green' : 'red'} />
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-2 rounded-2xl border border-gray-200 px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} placeholder="Search reference, user, transaction" className="min-w-0 flex-1 border-0 text-sm font-semibold outline-none" />
          <button type="button" onClick={load} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-black text-white">Search</button>
        </label>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5">
          <div>
            <h3 className="text-xl font-black text-gray-950">Funding Queue</h3>
            <p className="text-sm font-semibold text-gray-500">{pendingFunding.length} active requests</p>
          </div>
          <WalletCards className="text-blue-600" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>{['Reference', 'User', 'Amount', 'Method', 'Submitted', 'Status', 'Risk', 'Assigned', 'Actions'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {funding.map((request) => (
                <tr key={request.id} className="align-top">
                  <td className="px-4 py-4 font-black text-gray-900">{request.public_reference}</td>
                  <td className="px-4 py-4"><div className="font-bold text-gray-900">{request.user_name || request.user_id}</div><div className="text-xs text-gray-500">{request.telegram_username || request.user_email || request.user_id}</div></td>
                  <td className="px-4 py-4"><div className="font-black text-gray-900">{formatNaira(request.expected_amount_minor)}</div><div className="text-xs text-gray-500">{formatPoints(request.requested_points)}</div></td>
                  <td className="px-4 py-4 text-gray-700">{request.destination_snapshot?.provider || request.payment_method}</td>
                  <td className="px-4 py-4 text-gray-600">{formatDateTime(request.submitted_at || request.created_at)}</td>
                  <td className="px-4 py-4"><StatusPill value={request.status?.replaceAll('_', ' ')} tone={fundingTone(request.status)} /></td>
                  <td className="px-4 py-4">{request.possible_duplicate ? <StatusPill value="Possible duplicate" tone="amber" /> : <StatusPill value={request.risk_status || 'Normal'} tone="green" />}</td>
                  <td className="px-4 py-4 text-gray-700">{request.assigned_to || 'Unassigned'}</td>
                  <td className="px-4 py-4"><button type="button" onClick={() => openDetail(request)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-black text-gray-700"><Eye size={14} /> Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {funding.length === 0 ? <div className="p-8 text-center text-sm font-semibold text-gray-500">No funding requests found.</div> : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 p-5"><ShieldCheck className="text-emerald-600" /><h3 className="text-lg font-black text-gray-950">Points Transactions</h3></div>
          <div className="max-h-[420px] overflow-auto p-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="mb-3 rounded-2xl border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-3"><p className="font-black text-gray-900">{tx.type}</p><span className={tx.direction === 'CREDIT' ? 'font-black text-emerald-700' : 'font-black text-red-700'}>{tx.direction === 'CREDIT' ? '+' : '-'}{formatPoints(tx.points)}</span></div>
                <p className="mt-1 text-xs font-semibold text-gray-500">{tx.reference_type}:{tx.reference_id} • Balance {formatPoints(tx.balance_after)}</p>
              </div>
            ))}
            {transactions.length === 0 ? <p className="text-sm font-semibold text-gray-500">No transactions found.</p> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 p-5"><AlertTriangle className="text-amber-600" /><h3 className="text-lg font-black text-gray-950">Unmatched Payments</h3></div>
          <div className="max-h-[420px] overflow-auto p-4">
            {unmatchedPayments.map((payment) => (
              <div key={payment.id} className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                <div className="flex items-center justify-between gap-3"><p className="font-black text-amber-950">{payment.provider} · {payment.provider_transaction_id}</p><StatusPill value={payment.match_status} tone="amber" /></div>
                <p className="mt-1 text-xs font-semibold text-amber-700">{formatNaira(payment.amount_minor)} • {payment.currency} • {payment.provider_reference || 'No reference'}</p>
              </div>
            ))}
            {unmatchedPayments.length === 0 ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 className="mb-2" />No unmatched provider payments.</div> : null}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-1">
        <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 p-5"><AlertTriangle className="text-red-600" /><h3 className="text-lg font-black text-gray-950">Reconciliation Issues</h3></div>
          <div className="max-h-[420px] overflow-auto p-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="mb-3 rounded-2xl border border-red-100 bg-red-50 p-3">
                <div className="flex items-center justify-between gap-3"><p className="font-black text-red-950">{alert.alert_type}</p><StatusPill value={alert.status} tone="red" /></div>
                <p className="mt-1 text-xs font-semibold text-red-700">Expected {formatPoints(alert.expected_points)} • Actual {formatPoints(alert.actual_points)} • {alert.user_id || alert.funding_request_id}</p>
              </div>
            ))}
            {alerts.length === 0 ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 className="mb-2" />No open points reconciliation alerts.</div> : null}
          </div>
        </section>
      </div>

      <FundingDetailDrawer busy={Boolean(busy)} detail={detail} onClose={() => setDetail(null)} onAction={handleAction} />
    </div>
  );
}