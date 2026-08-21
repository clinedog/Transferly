import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  getAdminRiskOverview,
  listAdminRiskCases,
  listAdminRiskSignals,
  markAdminRiskCaseFalsePositive,
  updateAdminRiskCaseStatus
} from '../../lib/api';
import { StatusPill } from './PaymentsParts';
import { formatDateTime } from './paymentsUtils';

function StatCard({ label, value, tone = 'gray', detail }) {
  const classes = {
    gray: 'border-gray-200 bg-white text-gray-950',
    blue: 'border-blue-100 bg-blue-50 text-blue-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    red: 'border-red-100 bg-red-50 text-red-950',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-950'
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      {detail ? <p className="mt-1 text-xs font-semibold opacity-70">{detail}</p> : null}
    </div>
  );
}

function levelTone(level) {
  if (level === 'CRITICAL') return 'red';
  if (level === 'HIGH') return 'amber';
  if (level === 'MEDIUM') return 'blue';
  return 'green';
}

export default function AdminRiskTab() {
  const [overview, setOverview] = useState(null);
  const [cases, setCases] = useState([]);
  const [signals, setSignals] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [overviewResponse, casesResponse, signalsResponse] = await Promise.all([
        getAdminRiskOverview(),
        listAdminRiskCases({ limit: 50 }),
        listAdminRiskSignals({ limit: 50 })
      ]);
      setOverview(overviewResponse.overview || {});
      setCases(casesResponse.data || []);
      setSignals(signalsResponse.data || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load risk center.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateCase = async (riskCase, status) => {
    const reason = window.prompt(status === 'FALSE_POSITIVE' ? 'Why is this a false positive?' : 'Add an internal case note:');
    if (!reason) return;
    try {
      if (status === 'FALSE_POSITIVE') {
        await markAdminRiskCaseFalsePositive(riskCase.id, reason);
      } else {
        await updateAdminRiskCaseStatus(riskCase.id, { status, reason });
      }
      toast.success('Risk case updated');
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not update risk case.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Risk & Security</p>
          <h2 className="text-3xl font-black tracking-tight text-gray-950">Admin Risk Center</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-gray-600">
            Internal-only fraud, account protection, velocity, payment and admin-risk operations. Users never see rule names, scores, or thresholds.
          </p>
        </div>
        <button type="button" onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Open Cases" value={overview?.open_cases ?? 0} tone="blue" />
        <StatCard label="High Risk Users" value={overview?.high_risk_users ?? 0} tone="amber" />
        <StatCard label="Critical Alerts" value={overview?.critical_alerts ?? 0} tone="red" />
        <StatCard label="Active Restrictions" value={overview?.active_restrictions ?? 0} tone="red" />
        <StatCard label="Manual Reviews" value={overview?.manual_reviews ?? 0} tone="amber" />
        <StatCard label="False Positives" value={overview?.false_positives ?? 0} tone="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 p-5">
            <ShieldAlert className="text-red-600" />
            <h3 className="text-lg font-black text-gray-950">Risk Cases</h3>
          </div>
          <div className="max-h-[620px] overflow-auto p-4">
            {cases.map((riskCase) => (
              <article key={riskCase.id} className="mb-3 rounded-2xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-gray-400">{riskCase.case_number}</p>
                    <h4 className="mt-1 font-black text-gray-950">{riskCase.title}</h4>
                    <p className="mt-1 text-sm font-semibold text-gray-600">{riskCase.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill value={riskCase.risk_level} tone={levelTone(riskCase.risk_level)} />
                    <StatusPill value={riskCase.status} tone={riskCase.status === 'FALSE_POSITIVE' || riskCase.status === 'RESOLVED' ? 'green' : 'amber'} />
                  </div>
                </div>
                <p className="mt-2 text-xs font-bold text-gray-500">User {riskCase.user_id || 'n/a'} • {riskCase.domain} • {formatDateTime(riskCase.created_at)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => updateCase(riskCase, 'INVESTIGATING')} className="rounded-lg border px-3 py-2 text-xs font-black text-gray-700">Investigate</button>
                  <button type="button" onClick={() => updateCase(riskCase, 'RESOLVED')} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">Resolve</button>
                  <button type="button" onClick={() => updateCase(riskCase, 'FALSE_POSITIVE')} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800">False positive</button>
                </div>
              </article>
            ))}
            {cases.length === 0 ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 className="mb-2" />No open risk cases.</div> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 p-5">
            <AlertTriangle className="text-amber-600" />
            <h3 className="text-lg font-black text-gray-950">Recent Signals</h3>
          </div>
          <div className="max-h-[620px] overflow-auto p-4">
            {signals.map((signal) => (
              <div key={signal.id} className="mb-3 rounded-2xl border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-gray-900">{signal.signal_type}</p>
                  <StatusPill value={signal.severity} tone={levelTone(signal.severity)} />
                </div>
                <p className="mt-1 text-xs font-semibold text-gray-500">{signal.reason}</p>
                <p className="mt-2 text-xs font-bold text-gray-400">{signal.domain} • {signal.user_id || 'system'} • {formatDateTime(signal.created_at)}</p>
              </div>
            ))}
            {signals.length === 0 ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><ShieldCheck className="mb-2" />No recent risk signals.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}