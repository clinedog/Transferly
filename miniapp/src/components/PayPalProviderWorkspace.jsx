import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Home,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  WalletCards,
  Zap
} from 'lucide-react';
import PaymentsTab from './AdminTabs/PaymentsTab';
import { AdminPayoutsTab } from './AdminTabs/AdminPayoutsTab';
import { AdminDeveloperTab } from './AdminTabs/AdminWebhooksTab';
import ProviderWorkspaceShell from './ProviderWorkspaceShell';
import toast from 'react-hot-toast';
import {
  cancelInvoiceAutoReminders,
  generateInvoiceQr,
  getProviderDashboard,
  getProviderResource,
  refreshInvoice,
  sendInvoiceReminder
} from '../lib/api';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { SurfaceCard } from './ui';
import {
  getProviderLaneDefinition,
  getProviderManifest,
  getProviderWorkspaceRoute,
  isProviderLaneSupported
} from '../lib/providerManifests';

const paypalLanes = [
  'overview',
  'invoices',
  'payouts',
  'payments',
  'orders',
  'transactions',
  'webhooks',
  'disputes',
  'subscriptions',
  'tokens',
  'fx',
  'developer',
  'settings'
];

const laneResourceMap = {
  overview: 'overview',
  invoices: 'invoices',
  payouts: 'payouts',
  payments: 'payments',
  orders: 'orders',
  transactions: 'transactions',
  webhooks: 'webhooks',
  disputes: 'disputes',
  subscriptions: 'subscriptions',
  tokens: 'tokens',
  fx: 'currency-exchange',
  developer: 'developer',
  settings: 'settings'
};

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function humanizeStatus(value) {
  return String(value || 'unknown')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value) {
  if (!value) {
    return 'Time unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function toIsoDateTime(value) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getDateRangeDays(startValue, endValue) {
  if (!startValue || !endValue) {
    return null;
  }

  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return Math.abs(end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
}

function formatActionLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function scoreNextAction(action = {}, index = 0) {
  const severity = normalizeStatus(action.severity || action.priority || action.status || action.code);
  if (['critical', 'failed', 'error', 'high'].some((token) => severity.includes(token))) {
    return 100 - index;
  }
  if (['warning', 'review', 'missing', 'needs', 'pending'].some((token) => severity.includes(token))) {
    return 70 - index;
  }
  return 40 - index;
}

function readBalanceSnapshot(dashboard = {}) {
  const balances = dashboard?.balances?.data || dashboard?.balances || {};
  const available = Array.isArray(balances.available) ? balances.available[0] : balances.available;
  const amount = available?.amount ?? available?.value ?? balances.available_amount ?? balances.available_balance;
  const currency = available?.currency || balances.currency || '';

  return {
    amount: amount === undefined || amount === null || amount === '' ? 'Unavailable' : String(amount),
    currency: String(currency || '').toUpperCase(),
    status: dashboard?.balances?.status || balances.status || 'provider snapshot'
  };
}

function downloadSanitizedTransactions(records) {
  const payload = records.map((record) => ({
    id: record.id || null,
    type: record.type || null,
    status: record.status || record.provider_status || null,
    amount: record.amount || null,
    currency: record.currency || null,
    linked_resource: record.linked_resource || null,
    source: record.source || null,
    created_at: record.created_at || record.updated_at || null
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'transferly-paypal-transactions.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function defaultPayPalTransactionFilters(query = {}) {
  return {
    dateFrom: toDateTimeLocalValue(query.dateFrom),
    dateTo: toDateTimeLocalValue(query.dateTo),
    status: query.status || '',
    transactionType: query.transactionType || query.type || '',
    transactionId: query.transactionId || '',
    limit: String(query.limit || 25)
  };
}

function readDashboard(payload) {
  return payload?.data || payload || null;
}

function readResourceData(payload) {
  return payload?.data || {};
}

function readDashboardResources(dashboard) {
  return dashboard?.provider_resources || dashboard?.resources || [];
}

function getResourceReadiness(resourcePayload, dashboard, resourceName) {
  if (resourcePayload?.readiness) {
    return resourcePayload.readiness;
  }

  return readDashboardResources(dashboard).find((resource) => (
    resource.resource === resourceName ||
    resource.lane === resourceName ||
    resource.lane === (resourceName === 'currency-exchange' ? 'fx' : resourceName)
  )) || null;
}

function usePayPalWorkspaceData(activeLane, resourceParams = {}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({
    loading: true,
    error: '',
    dashboard: null,
    resource: null
  });

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    const resourceName = laneResourceMap[activeLane] || 'overview';

    async function load() {
      setState((current) => ({
        ...current,
        loading: true,
        error: ''
      }));

      try {
        const [dashboardPayload, resourcePayload] = await Promise.all([
          getProviderDashboard('paypal'),
          getProviderResource('paypal', resourceName, resourceParams)
        ]);

        if (alive) {
          setState({
            loading: false,
            error: '',
            dashboard: readDashboard(dashboardPayload),
            resource: resourcePayload
          });
        }
      } catch (error) {
        if (alive) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error?.message || 'Transferly could not load the PayPal workspace.'
          }));
        }
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [activeLane, reloadKey, resourceParams]);

  return {
    ...state,
    reload
  };
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'default' }) {
  const toneClass = tone === 'warning'
    ? 'bg-amber-400/10 text-amber-100 ring-amber-300/25'
    : 'bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-[var(--provider-accent-border)]';

  return (
    <article className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${toneClass}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{label}</p>
          <p className="mt-1 text-lg font-black text-[var(--tg-text-color)]">{value}</p>
          {detail ? <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}

function StatusPill({ status }) {
  const normalized = normalizeStatus(status);
  const toneClass = ['live', 'sandbox-ready', 'healthy', 'configured', 'processed'].includes(normalized)
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
    : ['needs-env', 'needs-webhook', 'needs-review', 'failed', 'error'].includes(normalized)
      ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
      : normalized === 'preview'
        ? 'border-sky-400/30 bg-sky-400/10 text-sky-100'
        : 'border-white/10 bg-white/[0.045] text-[var(--tg-subtitle-text-color)]';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${toneClass}`}>
      {humanizeStatus(status)}
    </span>
  );
}

function ActionCard({ to, icon: Icon, label, detail }) {
  return (
    <Link
      to={to}
      className="group rounded-[22px] border border-white/10 bg-white/[0.045] p-4 transition hover:border-[var(--provider-accent-border)] hover:bg-[var(--provider-accent-soft)]"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--provider-accent-soft)] text-[var(--tg-text-color)] ring-1 ring-[var(--provider-accent-border)]">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-black text-[var(--tg-text-color)]">{label}</p>
            <ArrowRight className="opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" size={15} />
          </div>
          <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{detail}</p>
        </div>
      </div>
    </Link>
  );
}

function LaneHeader({ eyebrow, title, body, action }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">{title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">{body}</p>
        </div>
        {action}
      </div>
    </section>
  );
}

function CapabilityList({ title, items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-black text-[var(--tg-text-color)]">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] p-5 text-center">
      <p className="font-black text-[var(--tg-text-color)]">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">{body}</p>
    </div>
  );
}

function ReadinessPanel({ readiness }) {
  if (!readiness) {
    return null;
  }

  const missingEnv = readiness.missing_env || [];

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Readiness</p>
          <h3 className="mt-2 text-lg font-black text-[var(--tg-text-color)]">{readiness.api_resource || readiness.label}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            {readiness.implemented ? 'This lane is connected to Transferly operations.' : 'This lane is prepared and waits for the backend module to enable live actions.'}
          </p>
        </div>
        <StatusPill status={readiness.status} />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">Environment</dt>
          <dd className="mt-1 text-sm font-black text-[var(--tg-text-color)]">{readiness.environment || 'not configured'}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">Configuration</dt>
          <dd className="mt-1 text-sm font-black text-[var(--tg-text-color)]">{missingEnv.length ? `${missingEnv.length} missing` : 'Ready'}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">Secrets</dt>
          <dd className="mt-1 text-sm font-black text-[var(--tg-text-color)]">Never exposed</dd>
        </div>
      </dl>

      {missingEnv.length ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-100">Missing configuration</p>
          <p className="mt-2 text-sm font-semibold text-amber-50">{missingEnv.join(', ')}</p>
        </div>
      ) : null}

      <CapabilityList title="Supported actions" items={readiness.supported_actions || []} />
    </section>
  );
}

function NextActions({ actions = [] }) {
  if (!actions.length) {
    return null;
  }

  const rankedActions = [...actions]
    .map((action, index) => ({
      ...action,
      score: action.score ?? scoreNextAction(action, index),
      severity: action.severity || action.priority || (String(action.code || '').includes('FAILED') ? 'high' : 'normal')
    }))
    .sort((left, right) => right.score - left.score);

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Prioritized next actions</p>
      <div className="mt-3 space-y-3">
        {rankedActions.map((action) => (
          <article key={action.code || action.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={action.severity} />
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">Score {action.score}</span>
              {action.owner ? <span className="text-[11px] font-bold text-[var(--tg-subtitle-text-color)]">Owner: {action.owner}</span> : null}
            </div>
            <p className="mt-2 font-black text-[var(--tg-text-color)]">{action.label}</p>
            {action.detail ? <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{action.detail}</p> : null}
            {action.resource || action.evidence ? (
              <p className="mt-2 text-[11px] font-bold leading-4 text-[var(--tg-hint-color)]">
                {action.resource ? `Resource: ${action.resource}. ` : ''}
                {action.evidence ? `Evidence: ${action.evidence}` : ''}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ReconciliationWorkbench({ invoices = [], payouts = [], webhooks = [], reconciliation = {} }) {
  const rows = [
    ...invoices.slice(0, 4).map((invoice) => ({
      id: invoice.invoice_id || invoice.id || invoice.internal_invoice_id,
      type: 'Invoice',
      providerStatus: invoice.official_paypal?.status || invoice.provider_status || invoice.status,
      transferlyStatus: invoice.status,
      amount: invoice.summary?.amount || invoice.amount,
      currency: invoice.summary?.currency || invoice.currency,
      referenceMatch: reconciliation.reference_match || (invoice.invoice_id ? 'pending' : 'missing'),
      destinationMatch: reconciliation.destination_match || (invoice.summary?.recipient_email ? 'pending' : 'unknown'),
      webhookMatch: webhooks.some((event) => String(event.linked_resource || '').includes(invoice.invoice_id || invoice.id || '')) ? 'matched' : 'pending',
      ledgerMatch: reconciliation.ledger_match || 'pending',
      reason: reconciliation.reason || 'Review provider, webhook, and ledger state before trusting this record.'
    })),
    ...payouts.slice(0, 4).map((payout) => ({
      id: payout.payout_id || payout.id,
      type: 'Payout',
      providerStatus: payout.official_paypal?.provider_batch_status || payout.official_paypal?.provider_item_status || payout.status,
      transferlyStatus: payout.status,
      amount: payout.summary?.amount || payout.amount,
      currency: payout.summary?.currency || payout.currency,
      referenceMatch: reconciliation.reference_match || (payout.tracking?.sender_batch_id ? 'pending' : 'missing'),
      destinationMatch: reconciliation.destination_match || (payout.summary?.receiver ? 'pending' : 'unknown'),
      webhookMatch: webhooks.some((event) => String(event.linked_resource || '').includes(payout.payout_id || payout.id || '')) ? 'matched' : 'pending',
      ledgerMatch: reconciliation.ledger_match || 'pending',
      reason: payout.official_paypal?.remediation?.reason || reconciliation.reason || 'Confirm payout state against internal ledger and provider tracking.'
    }))
  ];

  return (
    <RecordList
      title="Reconciliation workbench"
      records={rows}
      emptyTitle="No records to reconcile"
      emptyBody="PayPal invoices and payouts will appear here once Transferly has linked records."
      renderRecord={(row) => (
        <article key={`${row.type}-${row.id}`} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={row.type} />
            <StatusPill status={row.transferlyStatus} />
            <span className="text-xs font-bold text-[var(--tg-subtitle-text-color)]">{row.amount || 'Amount unavailable'} {row.currency || ''}</span>
          </div>
          <p className="mt-2 font-black text-[var(--tg-text-color)]">{row.id || `${row.type} record`}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <DataField label="PayPal Status" value={row.providerStatus} />
            <DataField label="Transferly Status" value={row.transferlyStatus} />
            <DataField label="Reference Match" value={row.referenceMatch} />
            <DataField label="Destination Match" value={row.destinationMatch} />
            <DataField label="Webhook Match" value={row.webhookMatch} />
            <DataField label="Ledger Match" value={row.ledgerMatch} />
            <DataField label="Needs Review" value={row.reason} />
          </dl>
        </article>
      )}
    />
  );
}

function RecordList({ title, records = [], emptyTitle, emptyBody, renderRecord }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">{title}</p>
      <div className="mt-3 space-y-3">
        {records.length ? records.map(renderRecord) : (
          <EmptyState title={emptyTitle} body={emptyBody} />
        )}
      </div>
    </section>
  );
}

function PayPalSection({ id, title, description, children }) {
  return (
    <SurfaceCard as="section" id={id} className="border-[#0070e0]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.035))] p-4 shadow-[0_18px_55px_rgba(0,48,135,0.16)] sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7fc4ff]">PayPal workspace</p>
          <h2 className="mt-1 text-xl font-black text-[var(--tg-text-color)]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </SurfaceCard>
  );
}

function DataField({ label, value, mono = false }) {
  return (
    <SurfaceCard as="div" className="rounded-2xl bg-white/[0.045] p-3 shadow-none">
      <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-black text-[var(--tg-text-color)] ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </dd>
    </SurfaceCard>
  );
}

function HelperList({ items = [] }) {
  return (
    <ul className="grid gap-2 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)] sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="rounded-2xl border border-[#0070e0]/15 bg-[#0070e0]/10 px-3 py-2">{item}</li>
      ))}
    </ul>
  );
}

function PayPalButton({ children, to, href, icon: Icon, primary = false, onClick, disabled = false }) {
  const className = primary
    ? 'inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full bg-[#0070e0] px-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(0,112,224,0.32)] transition hover:bg-[#005ea6] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'
    : 'inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full border border-[#0070e0]/25 bg-white/[0.055] px-4 text-sm font-black text-[var(--tg-text-color)] transition hover:bg-[#0070e0]/12 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto';
  const content = (
    <>
      {Icon ? <Icon size={15} aria-hidden="true" /> : null}
      {children}
    </>
  );

  if (to) {
    return <Link to={to} className={className}>{content}</Link>;
  }
  if (href && !disabled) {
    return <a href={href} target="_blank" rel="noreferrer" className={className}>{content}</a>;
  }
  return <button type="button" className={className} onClick={onClick} disabled={disabled}>{content}</button>;
}

function DisabledAction({ label, icon: Icon, reason }) {
  return (
    <div className="w-full sm:w-auto">
      <button
        type="button"
        disabled
        className="inline-flex min-h-[42px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-[#0070e0]/15 bg-white/[0.035] px-4 text-sm font-black text-[var(--tg-hint-color)] opacity-70 sm:w-auto"
        aria-label={`${label} unavailable: ${reason}`}
      >
        {Icon ? <Icon size={15} aria-hidden="true" /> : null}
        {label}
      </button>
      <p className="mt-1 max-w-[220px] px-2 text-[11px] font-bold leading-4 text-[var(--tg-hint-color)]">{reason}</p>
    </div>
  );
}

function EmptyPanel({ title, body, cta }) {
  return (
    <SurfaceCard as="div" className="border-dashed border-[#0070e0]/25 bg-[#0070e0]/10 p-5 text-center shadow-none">
      <p className="text-base font-black text-[var(--tg-text-color)]">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">{body}</p>
      {cta ? <div className="mt-4"><PayPalButton primary>{cta}</PayPalButton></div> : null}
    </SurfaceCard>
  );
}

function PayPalOverview({ dashboard, resource }) {
  const data = readResourceData(resource);
  const resources = data.resources || readDashboardResources(dashboard);
  const readyResources = resources.filter((item) => ['live', 'sandbox-ready'].includes(normalizeStatus(item.status))).length;
  const recentInvoices = data.recent_invoices || dashboard?.recent_invoices || [];
  const recentPayouts = data.recent_payouts || dashboard?.recent_payouts || [];
  const recentWebhooks = data.recent_webhook_events || [];
  const recentPayments = data.recent_payments || [];
  const failedActions = data.failed_or_pending_actions || dashboard?.risk_flags || [];
  const firstInvoice = recentInvoices[0] || {};
  const firstPayout = recentPayouts[0] || {};
  const invoiceIdentifier = firstInvoice.internal_invoice_id || firstInvoice.invoice_id || firstInvoice.id || '';
  const hostedInvoiceLink = firstInvoice.invoice_link || firstInvoice.recipient_view_url || '';
  const [busyAction, setBusyAction] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const settings = dashboard?.settings || {};
  const readiness = data.readiness || dashboard?.readiness || resource?.readiness || {};
  const health = data.provider_health || dashboard?.health || {};
  const environmentLabel = String(resource?.environment || dashboard?.provider?.environment || readiness.environment || 'sandbox').toLowerCase().includes('prod') ? 'Live' : 'Sandbox';
  const readinessLabel = readyResources && readyResources === resources.length ? 'Ready' : readyResources ? 'Needs Review' : 'Needs Setup';
  const reconciliation = dashboard?.reconciliation || data.reconciliation || {};
  const supportedCurrencies = settings.supported_currencies || data.supported_currencies || [];
  const enabledActions = settings.enabled_actions || data.enabled_actions || readiness.supported_actions || [];
  const nextActions = data.next_recommended_actions || dashboard?.next_recommended_actions || failedActions;
  const invoiceLifecycle = [
    'Draft',
    'Sent',
    'Hosted Link Available',
    'Awaiting Payment',
    'Webhook Received',
    'Verified',
    'Paid',
    'Cancelled',
    'Refunded'
  ];
  const payoutLifecycle = ['Draft', 'Validated', 'Submitted', 'Processing', 'Completed', 'Failed', 'Needs Review'];
  const paymentTimeline = [
    firstInvoice.created_at || firstInvoice.summary?.created_at ? ['Invoice Created', firstInvoice.created_at || firstInvoice.summary?.created_at] : null,
    firstInvoice.summary?.sent_at || firstInvoice.sent_at ? ['Invoice Sent', firstInvoice.summary?.sent_at || firstInvoice.sent_at] : null,
    hostedInvoiceLink ? ['Hosted Invoice Opened', hostedInvoiceLink] : null,
    firstInvoice.summary?.paid_at ? ['Payment Received', firstInvoice.summary.paid_at] : null,
    recentWebhooks[0]?.created_at || recentWebhooks[0]?.received_at ? ['Webhook Received', recentWebhooks[0].created_at || recentWebhooks[0].received_at] : null,
    firstInvoice.official_paypal?.last_synced_at ? ['Verification Started', firstInvoice.official_paypal.last_synced_at] : null,
    firstInvoice.summary?.verified_at || firstInvoice.verified_at ? ['Invoice Verified', firstInvoice.summary?.verified_at || firstInvoice.verified_at] : null,
    normalizeStatus(firstInvoice.status).includes('paid') ? ['Invoice Paid', firstInvoice.summary?.paid_at || firstInvoice.status] : null,
    firstInvoice.summary?.cancelled_at ? ['Invoice Cancelled', firstInvoice.summary.cancelled_at] : null,
    firstInvoice.summary?.refunded_at ? ['Invoice Refunded', firstInvoice.summary.refunded_at] : null
  ].filter(Boolean);
  const summaryCards = [
    ['Invoices', 'Create, send, refresh, and track hosted PayPal invoices.', 'Recipient link, status, reminders, and payment timeline', FileText],
    ['Payouts', 'Submit payout batches, track status, and review payout readiness.', 'Batch state, idempotent submission, and tracking details', Send],
    ['Transactions', 'Review provider transactions and reconcile activity.', 'Search, filter, and inspect linked records', Activity],
    ['Webhooks', 'Verify delivery health, event flow, and signature readiness.', 'Delivery posture, dead-letter checks, and timeline events', Zap],
    ['Readiness', 'Review configuration, environment, and setup status.', 'Sandbox/live mode, webhook state, and required env', ShieldCheck],
    ['Balance / Status', 'Operational snapshots and provider health at a glance.', 'Provider readiness, health, and activity status', WalletCards]
  ];
  const businessTools = [
    ['Collections', 'Create and track invoices and payment links.', getProviderWorkspaceRoute('paypal', 'invoices'), FileText],
    ['Payments', 'Review captures, refunds, and payment readiness.', getProviderWorkspaceRoute('paypal', 'payments'), WalletCards],
    ['Activity', 'Search transactions and reconciliation evidence.', getProviderWorkspaceRoute('paypal', 'transactions'), Activity],
    ['Developer', 'Inspect webhooks, API readiness, and diagnostics.', getProviderWorkspaceRoute('paypal', 'developer'), Code2],
    ['Settings', 'Review sandbox configuration and provider posture.', getProviderWorkspaceRoute('paypal', 'settings'), Settings]
  ];
  const quickActions = [
    ['Open Hosted Invoice', getProviderWorkspaceRoute('paypal', 'invoices'), ExternalLink, true, Boolean(hostedInvoiceLink), 'No hosted PayPal invoice link is available yet.'],
    ['Copy Invoice Link', getProviderWorkspaceRoute('paypal', 'invoices'), Copy, false, Boolean(hostedInvoiceLink), 'No hosted PayPal invoice link is available yet.'],
    ['Send Reminder', getProviderWorkspaceRoute('paypal', 'invoices'), Send, false, Boolean(invoiceIdentifier), 'No PayPal invoice is available for reminders yet.'],
    ['Refresh Status', getProviderWorkspaceRoute('paypal', 'invoices'), RefreshCw, false, Boolean(invoiceIdentifier), 'No PayPal invoice is available to refresh yet.'],
    ['Create QR', getProviderWorkspaceRoute('paypal', 'invoices'), Copy, false, Boolean(invoiceIdentifier), 'No PayPal invoice is available for QR generation yet.'],
    ['Request Payout', getProviderWorkspaceRoute('paypal', 'payouts'), Send, true, true, 'Open the PayPal payout lane.'],
    ['View Transactions', getProviderWorkspaceRoute('paypal', 'transactions'), Activity, false, true, 'Open the PayPal transactions lane.'],
    ['View Webhooks', getProviderWorkspaceRoute('paypal', 'webhooks'), Zap, false, true, 'Open the PayPal webhook lane.'],
    ['View Readiness', getProviderWorkspaceRoute('paypal', 'settings'), ShieldCheck, false, true, 'Open readiness and setup details.'],
    ['View Settings', getProviderWorkspaceRoute('paypal', 'settings'), Settings, false, true, 'Open PayPal provider settings.']
  ];

  async function runInvoiceAction(action, runner, successMessage) {
    if (!invoiceIdentifier) {
      toast.error('No PayPal invoice is available for this action yet.');
      return;
    }
    setBusyAction(action);
    try {
      await runner(invoiceIdentifier);
      toast.success(successMessage);
    } catch (error) {
      toast.error(error?.message || 'PayPal invoice action could not be completed right now.');
    } finally {
      setBusyAction('');
    }
  }

  function requestInvoiceConfirmation(action) {
    setConfirmAction(action);
  }

  async function confirmInvoiceAction() {
    if (!confirmAction) {
      return;
    }
    const action = confirmAction;
    setConfirmAction(null);
    await runInvoiceAction(action.label, action.runner, action.successMessage);
  }

  async function copyHostedInvoiceLink() {
    if (!hostedInvoiceLink) {
      toast.error('No hosted PayPal invoice link is available yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(hostedInvoiceLink);
      toast.success('Hosted PayPal invoice link copied');
    } catch {
      toast.error('Could not copy the hosted PayPal invoice link.');
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[34px] border border-[#0070e0]/25 bg-[radial-gradient(circle_at_top_left,rgba(0,112,224,0.36),transparent_34%),linear-gradient(135deg,rgba(0,48,135,0.46),rgba(0,0,0,0.08))] p-5 shadow-[0_24px_80px_rgba(0,48,135,0.24)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#003087]">PayPal adapter</span>
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-black text-blue-50">Transferly Sandbox Simulator</span>
              <StatusPill status={environmentLabel} />
              <StatusPill status={readinessLabel} />
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Sandbox provider console</h2>
            <p className="mt-2 text-base font-bold leading-7 text-blue-50">PayPal-compatible workflows inside Transferly</p>
            <p className="mt-3 text-sm font-semibold leading-6 text-blue-100">Synthetic test data only. No live PayPal account, credentials, or funds are accessed from this simulator.</p>
          </div>
          <div className="rounded-[26px] border border-white/15 bg-white/10 p-4 text-sm font-bold text-blue-50 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100">Workspace status</p>
            <p className="mt-2 text-2xl font-black text-white">{readyResources}/{resources.length || 0}</p>
            <p className="mt-1 text-xs font-semibold text-blue-100">Ready provider resources</p>
          </div>
        </div>
      </section>

      <PayPalSection title="Business tools" description="Navigate the provider-console workflows supported by this Transferly sandbox adapter.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {businessTools.map(([label, detail, to, Icon]) => (
            <PayPalButton key={label} to={to} icon={Icon}>
              <span className="flex flex-col items-start">
                <span>{label}</span>
                <span className="mt-1 text-left text-[11px] font-semibold leading-4 text-[var(--tg-subtitle-text-color)]">{detail}</span>
              </span>
            </PayPalButton>
          ))}
        </div>
      </PayPalSection>

      <PayPalSection id="paypal-quick-actions" title="PayPal overview quick actions" description="Premium shortcuts for hosted invoice, payout, transaction, webhook, readiness, and settings workflows.">
        <div className="flex flex-wrap gap-2">
          {quickActions.map(([label, to, Icon, primary, available, reason]) => {
            if (!available) return <DisabledAction key={label} label={label} icon={Icon} reason={reason} />;
            if (label === 'Open Hosted Invoice') return <PayPalButton key={label} href={hostedInvoiceLink} icon={Icon} primary={primary}>{label}</PayPalButton>;
            if (label === 'Copy Invoice Link') return <PayPalButton key={label} onClick={copyHostedInvoiceLink} icon={Icon}>{label}</PayPalButton>;
            if (label === 'Send Reminder') {
              return (
                <PayPalButton
                  key={label}
                  disabled={busyAction === label}
                  onClick={() => requestInvoiceConfirmation({
                    label,
                    runner: sendInvoiceReminder,
                    successMessage: 'PayPal invoice reminder requested',
                    title: 'Send PayPal invoice reminder?',
                    description: 'This can notify the invoice recipient through the hosted PayPal invoice workflow.'
                  })}
                  icon={Icon}
                >
                  {label}
                </PayPalButton>
              );
            }
            if (label === 'Refresh Status') return <PayPalButton key={label} disabled={busyAction === label} onClick={() => runInvoiceAction(label, refreshInvoice, 'PayPal invoice status refresh requested')} icon={Icon}>{label}</PayPalButton>;
            if (label === 'Create QR') return <PayPalButton key={label} disabled={busyAction === label} onClick={() => runInvoiceAction(label, generateInvoiceQr, 'PayPal invoice QR generation requested')} icon={Icon}>{label}</PayPalButton>;
            return <PayPalButton key={label} to={to} icon={Icon} primary={primary}>{label}</PayPalButton>;
          })}
        </div>
      </PayPalSection>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map(([title, copy, secondary, Icon]) => (
          <article key={title} className="rounded-[26px] border border-[#0070e0]/18 bg-white/[0.055] p-4 shadow-[0_16px_42px_rgba(0,48,135,0.10)]">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0070e0]/15 text-[#8fd0ff] ring-1 ring-[#0070e0]/25"><Icon size={19} /></div>
              <div>
                <h3 className="font-black text-[var(--tg-text-color)]">{title}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]">{copy}</p>
                <p className="mt-2 text-xs font-bold leading-5 text-[#9fd6ff]">{secondary}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <PayPalSection id="paypal-invoice-workflow" title="Invoice Workflow" description="Create, open, send, track, and reconcile hosted PayPal invoices from one place.">
        <CapabilityList title="Invoice lifecycle" items={invoiceLifecycle} />
        {recentInvoices.length ? (
          <div className="mt-4 space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <DataField label="Invoice ID" value={firstInvoice.invoice_id || firstInvoice.id} mono />
              <DataField label="Invoice Number" value={firstInvoice.summary?.invoice_number || firstInvoice.invoice_number} />
              <DataField label="Status" value={firstInvoice.status} />
              <DataField label="Amount" value={firstInvoice.summary?.amount || firstInvoice.amount} />
              <DataField label="Currency" value={firstInvoice.summary?.currency || firstInvoice.currency} />
              <DataField label="Recipient View URL" value={firstInvoice.invoice_link || firstInvoice.recipient_view_url} mono />
              <DataField label="Issue Date" value={firstInvoice.summary?.issue_date} />
              <DataField label="Due Date" value={firstInvoice.summary?.due_date} />
              <DataField label="Paid At" value={firstInvoice.summary?.paid_at} />
              <DataField label="Cancelled At" value={firstInvoice.summary?.cancelled_at} />
              <DataField label="Refunded At" value={firstInvoice.summary?.refunded_at} />
              <DataField label="Last Synced" value={firstInvoice.official_paypal?.last_synced_at} />
              <DataField label="Reminder Status" value={firstInvoice.summary?.auto_reminders_cancelled_at ? 'Cancelled' : 'Active'} />
              <DataField label="QR Status" value={firstInvoice.official_paypal?.qr ? 'Available' : 'Not generated'} />
            </dl>
            <div className="flex flex-wrap gap-2">
              <PayPalButton href={hostedInvoiceLink} to={!hostedInvoiceLink ? getProviderWorkspaceRoute('paypal', 'invoices') : undefined} icon={ExternalLink} primary>Open Hosted Invoice</PayPalButton>
              <PayPalButton onClick={copyHostedInvoiceLink} icon={Copy}>Copy Hosted Link</PayPalButton>
              <PayPalButton
                disabled={busyAction === 'Send Reminder'}
                onClick={() => requestInvoiceConfirmation({
                  label: 'Send Reminder',
                  runner: sendInvoiceReminder,
                  successMessage: 'PayPal invoice reminder requested',
                  title: 'Send PayPal invoice reminder?',
                  description: 'This can notify the invoice recipient through the hosted PayPal invoice workflow.'
                })}
              >
                Send Reminder
              </PayPalButton>
              <PayPalButton disabled={busyAction === 'Refresh Invoice'} onClick={() => runInvoiceAction('Refresh Invoice', refreshInvoice, 'PayPal invoice status refresh requested')}>Refresh Invoice</PayPalButton>
              <PayPalButton disabled={busyAction === 'Generate QR'} onClick={() => runInvoiceAction('Generate QR', generateInvoiceQr, 'PayPal invoice QR generation requested')}>Generate QR</PayPalButton>
              <PayPalButton
                disabled={busyAction === 'Cancel Auto Reminders'}
                onClick={() => requestInvoiceConfirmation({
                  label: 'Cancel Auto Reminders',
                  runner: cancelInvoiceAutoReminders,
                  successMessage: 'PayPal invoice auto reminders cancellation requested',
                  title: 'Cancel invoice auto reminders?',
                  description: 'This changes future recipient reminder behavior for the hosted PayPal invoice.',
                  dangerous: true
                })}
              >
                Cancel Reminders
              </PayPalButton>
            </div>
          </div>
        ) : <EmptyPanel title="No invoices yet" body="PayPal invoices will appear here once collections start." cta="Create Invoice" />}
        <div className="mt-4"><HelperList items={[
          'This opens the official hosted PayPal invoice page.',
          'The hosted invoice link comes from PayPal’s invoice resource.',
          'Refresh to pull the latest invoice state from PayPal.',
          'Reminder actions follow PayPal invoice reminder workflows.',
          'QR generation provides mobile-friendly payment access.'
        ]} /></div>
      </PayPalSection>

      <PayPalSection id="paypal-payment-timeline" title="Payment Timeline" description="Track invoice events, hosted invoice access, webhook arrivals, and verification progress.">
        <RecordList
          title="Supported timeline entries"
          records={paymentTimeline}
          emptyTitle="No payment timeline yet"
          emptyBody="Timeline entries appear when invoice, payment, webhook, or verification timestamps are available from Transferly records."
          renderRecord={([label, value]) => (
            <article key={`${label}-${value}`} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9fd6ff]">{label}</p>
              <p className="mt-2 text-sm font-black text-[var(--tg-text-color)]">{String(value).startsWith('http') ? 'Hosted link available' : formatDateTime(value)}</p>
            </article>
          )}
        />
      </PayPalSection>

      <PayPalSection id="paypal-webhook-sync" title="Webhook Sync" description="Verify delivery health, event integrity, and sync progress from PayPal into Transferly.">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DataField label="Webhook Status" value={dashboard?.webhook_status?.status || resource?.readiness?.status} />
          <DataField label="Signature Verified" value={recentWebhooks.some((event) => event.signature_verification_status) ? 'Recorded' : '—'} />
          <DataField label="Delivery Health" value={dashboard?.webhook_status?.message || health.status} />
          <DataField label="Failed Deliveries" value={dashboard?.webhook_status?.failed_webhooks} />
          <DataField label="Recent Events" value={recentWebhooks.length} />
          <DataField label="Last Webhook At" value={dashboard?.webhook_status?.last_webhook_at || data.last_successful_webhook_at} />
          <DataField label="Dead Letter State" value={failedActions.length ? 'Needs Review' : '—'} />
          <DataField label="Linked Records" value={recentWebhooks.length ? 'Sanitized only' : '—'} />
        </dl>
        <div className="mt-4"><HelperList items={[
          'Webhook signatures must be verified before any state mutation.',
          'Webhook delivery history helps confirm provider events reached Transferly.',
          'Recent events are displayed in sanitized form only.'
        ]} /></div>
      </PayPalSection>

      <PayPalSection id="paypal-reconciliation" title="Reconciliation" description="Compare PayPal provider state with Transferly records before balances or statuses are trusted.">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DataField label="PayPal Status" value={firstInvoice.official_paypal?.status || firstPayout.official_paypal?.status || firstInvoice.status || firstPayout.status} />
          <DataField label="Transferly Status" value={firstInvoice.status || firstPayout.status} />
          <DataField label="Match State" value={reconciliation.match_state || reconciliation.status || (firstInvoice.status || firstPayout.status ? 'Pending' : 'Unknown')} />
          <DataField label="Provider Amount" value={firstInvoice.summary?.amount || firstPayout.summary?.amount || firstInvoice.amount || firstPayout.amount} />
          <DataField label="Transferly Amount" value={firstInvoice.summary?.amount || firstPayout.summary?.amount || firstInvoice.amount || firstPayout.amount} />
          <DataField label="Reference Match" value={reconciliation.reference_match} />
          <DataField label="Destination Match" value={reconciliation.destination_match} />
          <DataField label="Webhook Match" value={recentWebhooks.length ? 'Pending' : 'Unknown'} />
          <DataField label="Ledger Match" value={reconciliation.ledger_match} />
        </dl>
        <div className="mt-4"><HelperList items={[
          'Provider activity helps investigation, but the Transferly ledger remains the source of truth.',
          'Never auto-correct a financial mismatch.',
          'Use reconciliation to confirm the PayPal state against internal records.'
        ]} /></div>
      </PayPalSection>

      <ReconciliationWorkbench
        invoices={recentInvoices}
        payouts={recentPayouts}
        webhooks={recentWebhooks}
        reconciliation={reconciliation}
      />

      <PayPalSection id="paypal-payout-workflow" title="Payout Workflow" description="Submit payout batches, track batch state, and review safe retry behavior.">
        <CapabilityList title="Payout lifecycle" items={payoutLifecycle} />
        {recentPayouts.length ? (
          <div className="mt-4 space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <DataField label="Payout ID" value={firstPayout.payout_id || firstPayout.id} mono />
              <DataField label="Batch ID" value={firstPayout.tracking?.payout_batch_id} mono />
              <DataField label="Status" value={firstPayout.status} />
              <DataField label="Amount" value={firstPayout.summary?.amount || firstPayout.amount} />
              <DataField label="Currency" value={firstPayout.summary?.currency || firstPayout.currency} />
              <DataField label="Sender Batch ID" value={firstPayout.tracking?.sender_batch_id} mono />
              <DataField label="Tracking" value={firstPayout.tracking?.payout_item_id || firstPayout.tracking?.payout_batch_id} mono />
              <DataField label="Risk Decision" value={firstPayout.risk_decision} />
              <DataField label="Submitted At" value={firstPayout.summary?.created_at} />
              <DataField label="Processed At" value={firstPayout.summary?.processed_at} />
              <DataField label="Last Synced" value={firstPayout.official_paypal?.last_synced_at} />
            </dl>
            <div className="flex flex-wrap gap-2">
              {['Request Payout', 'Preview Payout', 'Refresh Payout', 'Copy Batch ID', 'View Tracking'].map((label, index) => (
                <PayPalButton key={label} to={getProviderWorkspaceRoute('paypal', 'payouts')} icon={index === 3 ? Copy : undefined} primary={index === 0}>{label}</PayPalButton>
              ))}
            </div>
          </div>
        ) : <EmptyPanel title="No payouts yet" body="PayPal payout batches will appear here once submissions begin." cta="Request Payout" />}
        <div className="mt-4"><HelperList items={[
          'Safe retries reuse the same batch identifier.',
          'Payout state is mapped into Transferly’s internal payout lifecycle.',
          'Batch tracking helps compare provider state with internal records.'
        ]} /></div>
      </PayPalSection>

      <PayPalSection id="paypal-activity" title="Provider Activity" description="Trace invoices, payouts, webhooks, and provider events from one PayPal workspace view.">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DataField label="Recent Invoices" value={recentInvoices.length} />
          <DataField label="Recent Payouts" value={recentPayouts.length} />
          <DataField label="Recent Webhooks" value={recentWebhooks.length} />
          <DataField label="Recent Payments" value={recentPayments.length} />
          <DataField label="Recent Issues" value={failedActions.length} />
          <DataField label="Next Recommended Actions" value={nextActions.length} />
        </dl>
        <div className="mt-4"><HelperList items={[
          'Use activity to trace what happened across invoices, payouts, and provider events.',
          'Transferly ledger remains the source of truth for internal balances.',
          'Provider activity is most useful for investigation and support.'
        ]} /></div>
      </PayPalSection>

      <PayPalSection id="paypal-readiness" title="Readiness" description="Environment mode, webhook configuration, and operational setup checks.">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DataField label="Environment" value={resource?.environment || readiness.environment} />
          <DataField label="Sandbox / Live" value={environmentLabel} />
          <DataField label="Configured" value={readinessLabel === 'Ready' ? 'Ready' : 'Needs Review'} />
          <DataField label="Missing Environment" value={(readiness.missing_env || settings.missing_env || []).join(', ')} />
          <DataField label="Webhook Required" value={readiness.webhook_required === undefined ? '—' : readiness.webhook_required ? 'Yes' : 'No'} />
          <DataField label="Required Env" value={(readiness.required_env || settings.required_env || []).join(', ')} />
          <DataField label="Supported Currencies" value={supportedCurrencies.join(', ')} />
          <DataField label="Enabled Actions" value={enabledActions.slice(0, 4).join(', ')} />
          <DataField label="Docs" value="PayPal developer docs" />
          <DataField label="Support" value="PayPal support resources" />
        </dl>
        <div className="mt-4"><HelperList items={[
          'Transferly reads PayPal readiness from provider configuration and setup status.',
          'Keep this workspace in sandbox until live settings are fully configured.',
          'Missing environment values should be shown clearly without exposing secret values.'
        ]} /></div>
      </PayPalSection>

      <PayPalSection id="paypal-settings" title="Settings" description="Environment, webhook readiness, supported operations, and support resources.">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DataField label="Environment Mode" value={settings.environment_mode || resource?.environment} />
          <DataField label="Provider Status" value={dashboard?.provider?.status || dashboard?.status?.status} />
          <DataField label="Webhook Endpoint" value={settings.webhook_endpoint_status || dashboard?.webhook_status?.endpoint_status} />
          <DataField label="Webhook Secret" value={settings.webhook_secret_status || 'not-exposed'} />
          <DataField label="Supported Currencies" value={supportedCurrencies.join(', ')} />
          <DataField label="Enabled Actions" value={enabledActions.slice(0, 5).join(', ')} />
          <DataField label="Docs" value="PayPal docs linked from workspace" />
          <DataField label="Support" value="PayPal support linked from workspace" />
          <DataField label="Secret Values Exposed" value="false" />
        </dl>
        <div className="mt-4"><HelperList items={[
          'Show only sanitized readiness data in the UI.',
          'Do not expose secret values in the workspace.',
          'Use this section to verify setup before using hosted PayPal actions.'
        ]} /></div>
      </PayPalSection>

      <NextActions actions={nextActions} />
      <ConfirmationModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title || 'Confirm PayPal invoice action'}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.label || 'Confirm'}
        onConfirm={confirmInvoiceAction}
        onCancel={() => setConfirmAction(null)}
        isDangerous={Boolean(confirmAction?.dangerous)}
        isLoading={Boolean(busyAction)}
      />
    </div>
  );
}

function PayPalInvoiceLane({ readiness }) {
  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal Invoicing API"
        title="Invoices"
        body="Collections for provider-backed invoices, hosted payment links, reminders, QR generation, and status refresh."
      />
      <ReadinessPanel readiness={readiness} />
      <PayPalSection id="paypal-payment-links" title="Payment Links & Buttons" description="Use hosted links generated from Transferly invoice records. This simulator never creates an official PayPal-branded checkout page.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#0070e0]/20 bg-[#0070e0]/10 p-4">
            <p className="font-black text-[var(--tg-text-color)]">Create a hosted collection link</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
              Start from the shared invoice workflow so amount, currency, recipient, ledger state, and idempotency checks stay together.
            </p>
            <div className="mt-3">
              <PayPalButton to={getProviderWorkspaceRoute('paypal', 'invoices')} primary icon={ExternalLink}>
                Open invoice builder
              </PayPalButton>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-black text-[var(--tg-text-color)]">Hosted-link safety</p>
            <ul className="mt-2 space-y-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
              <li>Links remain tied to an invoice and provider status.</li>
              <li>Expired, cancelled, or unpaid records are not shown as completed.</li>
              <li>Transferly’s internal ledger remains authoritative.</li>
            </ul>
          </div>
        </div>
      </PayPalSection>
      <CapabilityList
        title="Available invoice actions"
        items={['Open Hosted Invoice', 'Copy Hosted Link', 'Send Reminder', 'Cancel Auto Reminders', 'Generate QR', 'Refresh Invoice', 'Cancel Invoice']}
      />
      <HelperList items={[
        'This opens the official hosted PayPal invoice page.',
        'The recipient payment link comes from PayPal’s invoice resource.',
        'Due dates and provider status determine whether a hosted link remains available.',
        'Use refresh to pull the latest invoice state from PayPal.',
        'Reminder actions follow PayPal invoice reminder workflows.',
        'QR generation is provided for mobile-friendly payment access.'
      ]} />
      <PaymentsTab embedded mode="invoice" providerFilter="paypal" />
    </div>
  );
}

function PayPalPayoutLane({ readiness }) {
  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal Payouts API"
        title="Payouts"
        body="PayPal payout batch creation, preview, retry-safe submission, batch tracking, and status review."
      />
      <ReadinessPanel readiness={readiness} />
      <section className="rounded-lg overflow-hidden border border-slate-200 bg-white" style={{ minHeight: '600px' }}>
        <AdminPayoutsTab />
      </section>
    </div>
  );
}

function PayPalOrdersLane({ payload, readiness, onLookupOrder, onClearOrder }) {
  const data = readResourceData(payload);
  const detail = data.detail || {};
  const records = data.records || [];
  const [orderId, setOrderId] = useState(detail.query?.orderId || records[0]?.id || '');

  function submitOrderLookup(event) {
    event.preventDefault();
    const cleanOrderId = orderId.trim();
    if (!cleanOrderId) {
      onClearOrder();
      return;
    }
    onLookupOrder(cleanOrderId);
  }

  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal Orders API"
        title="Order lookup and checkout readiness"
        body="Review PayPal order state from Transferly without enabling create or capture actions until validation, authorization, and audit trails are complete."
      />
      <ReadinessPanel readiness={readiness} />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Gauge} label="Lookup" value={detail.order_lookup_enabled ? 'Enabled' : 'Prepared'} detail="Read-only provider order lookup." />
        <MetricCard icon={ShieldCheck} label="Create/Capture" value={detail.create_order_enabled || detail.capture_order_enabled ? 'Enabled' : 'Gated'} detail="Money movement order actions remain disabled." tone={detail.create_order_enabled || detail.capture_order_enabled ? 'default' : 'warning'} />
        <MetricCard icon={Activity} label="Orders" value={records.length} detail="Provider order records returned for the current query." />
      </section>
      <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Order lookup</p>
        <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" onSubmit={submitOrderLookup}>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">PayPal order ID</span>
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="ORDER-123"
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-[var(--tg-text-color)] outline-none transition focus:border-[var(--provider-accent-border)]"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--provider-accent)] px-4 text-sm font-black text-white"
          >
            Look up
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderId('');
              onClearOrder();
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-black text-[var(--tg-text-color)]"
          >
            Clear
          </button>
        </form>
        <p className="mt-3 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
          Lookup is read-only. Transferly does not create, approve, capture, or settle orders from this panel.
        </p>
      </section>
      <CapabilityList title="Order safeguards" items={detail.capability_checks || readiness?.supported_actions || []} />
      <RecordList
        title="Order records"
        records={records}
        emptyTitle="No order selected"
        emptyBody="Transferly supports safe PayPal order lookup by provider order ID. Create and capture actions remain gated."
        renderRecord={(record) => (
          <article key={record.id || record.created_at || 'paypal-order'} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={record.status || record.provider_status || 'recorded'} />
              <span className="text-xs font-bold text-[var(--tg-subtitle-text-color)]">{formatDateTime(record.updated_at || record.created_at)}</span>
            </div>
            <p className="mt-2 font-black text-[var(--tg-text-color)]">{record.id || 'PayPal order'}</p>
            <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">
              {record.intent || 'Order'} · {record.amount || 'Amount unavailable'} {record.currency || ''}
            </p>
            <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">
              Buyer: {record.buyer?.email || record.buyer?.payer_id || 'not provided'}
            </p>
          </article>
        )}
      />
      <NextActions actions={payload?.next_actions || []} />
    </div>
  );
}

function PayPalTransactionsLane({ payload, readiness, onSearchTransactions, onShowTransferlyTransactions }) {
  const data = readResourceData(payload);
  const detail = data.detail || {};
  const records = data.records || [];
  const [filters, setFilters] = useState(() => defaultPayPalTransactionFilters(detail.query));
  const rangeDays = getDateRangeDays(filters.dateFrom, filters.dateTo);
  const rangeError = rangeDays !== null && rangeDays > 31
    ? 'PayPal Transaction Search supports a maximum 31-day range. Narrow the dates before searching.'
    : '';
  const pagination = payload?.pagination || {};
  const currentPage = Number(pagination.cursor || pagination.page || detail.query?.cursor || 1);
  const totalPages = Number(pagination.total_pages || 1);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function submitPayPalSearch(event) {
    event.preventDefault();
    if (rangeError) {
      toast.error(rangeError);
      return;
    }
    onSearchTransactions({
      source: 'paypal',
      dateFrom: toIsoDateTime(filters.dateFrom),
      dateTo: toIsoDateTime(filters.dateTo),
      status: filters.status.trim() || undefined,
      transactionType: filters.transactionType.trim() || undefined,
      transactionId: filters.transactionId.trim() || undefined,
      limit: Number(filters.limit) || 25
    });
  }

  function movePage(nextPage) {
    const query = {
      ...(detail.query || {}),
      source: 'paypal',
      cursor: nextPage,
      limit: Number(filters.limit) || detail.query?.limit || 25
    };
    onSearchTransactions(query);
  }

  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal Transaction Search API"
        title="Transactions"
        body="Search invoices, payouts, and provider transactions in one PayPal workspace view."
      />
      <ReadinessPanel readiness={readiness} />
      <section className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--tg-text-color)]">Export current records</p>
          <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">Exports the currently displayed, sanitized fields only. It never includes raw PayPal payloads, authorization data, or secrets.</p>
        </div>
        <PayPalButton icon={Download} onClick={() => downloadSanitizedTransactions(records)} disabled={!records.length}>
          Export sanitized JSON
        </PayPalButton>
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Gauge} label="Search" value={detail.paypal_search_enabled ? 'PayPal' : 'Transferly'} detail={detail.paypal_search_enabled ? 'Provider-native search response.' : 'Local Transferly-linked activity view.'} />
        <MetricCard icon={ShieldCheck} label="Ledger truth" value="Transferly" detail={data.source_of_truth?.transferly_ledger || 'Provider status does not define wallet balances.'} />
        <MetricCard icon={Activity} label="Records" value={records.length} detail="Invoices, payouts, and provider transaction records." />
      </section>
      <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Provider search</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
              Search PayPal transactions by a 31-day or smaller range. Results do not replace Transferly ledger balances.
            </p>
          </div>
          <StatusPill status={detail.paypal_search_enabled ? 'live' : 'preview'} />
        </div>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitPayPalSearch}>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">From</span>
            <input
              type="datetime-local"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-[var(--tg-text-color)] outline-none transition focus:border-[var(--provider-accent-border)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">To</span>
            <input
              type="datetime-local"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-[var(--tg-text-color)] outline-none transition focus:border-[var(--provider-accent-border)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">Status</span>
            <input
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
              placeholder="COMPLETED, PENDING"
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-[var(--tg-text-color)] outline-none transition focus:border-[var(--provider-accent-border)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">Type</span>
            <input
              value={filters.transactionType}
              onChange={(event) => updateFilter('transactionType', event.target.value)}
              placeholder="T0006 or provider type"
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-[var(--tg-text-color)] outline-none transition focus:border-[var(--provider-accent-border)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">Transaction ID</span>
            <input
              value={filters.transactionId}
              onChange={(event) => updateFilter('transactionId', event.target.value)}
              placeholder="Search PayPal transactions..."
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-[var(--tg-text-color)] outline-none transition focus:border-[var(--provider-accent-border)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">Limit</span>
            <select
              value={filters.limit}
              onChange={(event) => updateFilter('limit', event.target.value)}
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-[var(--tg-text-color)] outline-none transition focus:border-[var(--provider-accent-border)]"
            >
              <option value="10">10 records</option>
              <option value="25">25 records</option>
              <option value="50">50 records</option>
              <option value="100">100 records</option>
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
            <button
              type="submit"
              disabled={Boolean(rangeError)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-[var(--provider-accent)] px-4 text-sm font-black text-white"
            >
              Search PayPal records
            </button>
            <button
              type="button"
              onClick={() => {
                setFilters(defaultPayPalTransactionFilters());
                onShowTransferlyTransactions();
              }}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-black text-[var(--tg-text-color)]"
            >
              Show Transferly records
            </button>
          </div>
        </form>
        {rangeError ? (
          <p className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm font-bold leading-5 text-amber-50">
            {rangeError}
          </p>
        ) : null}
      </section>
      <section className="rounded-[28px] border border-sky-400/20 bg-sky-400/10 p-4">
        <p className="text-sm font-black text-sky-50">Provider reporting delay</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-sky-50">
          {detail.provider_latency_notice || 'PayPal Transaction Search records can appear up to three hours after provider activity occurs.'}
        </p>
      </section>
      {detail.provider_error ? (
        <section className="rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-4">
          <p className="text-sm font-black text-amber-50">Transaction Search unavailable</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-amber-50">{detail.provider_error.message}</p>
        </section>
      ) : null}
      <RecordList
        title="Transactions"
        records={records}
        emptyTitle="No transactions yet"
        emptyBody="PayPal transactions will appear here once provider activity is available."
        renderRecord={(record) => (
          <article key={`${record.source || record.type}-${record.id || record.created_at}`} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={record.status || record.provider_status || 'recorded'} />
              <span className="text-xs font-bold text-[var(--tg-subtitle-text-color)]">{formatDateTime(record.updated_at || record.created_at)}</span>
            </div>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[#9fd6ff]">{record.type === 'invoice' ? 'Invoice transaction' : record.type === 'payout' ? 'Payout transaction' : 'Searchable provider activity'}</p>
            <p className="mt-2 font-black text-[var(--tg-text-color)]">{record.type === 'invoice' ? 'Invoice' : 'Transaction'} · {(record.id || 'PayPal transaction').slice(-10)}</p>
            <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">
              Amount {record.amount || 'Amount unavailable'} · Currency {record.currency || '—'} · Status {record.status || record.provider_status || '—'} · Date {formatDateTime(record.updated_at || record.created_at)}
            </p>
            <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">
              Linked Resource: {record.linked_resource || 'Linked to hosted PayPal records'} · Source: {humanizeStatus(record.source || 'Provider activity for reconciliation and support')}
            </p>
            <details className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
              <summary className="cursor-pointer text-xs font-black text-[var(--tg-text-color)]">View sanitized transaction details</summary>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <DataField label="Transaction ID" value={record.id} mono />
                <DataField label="Linked record" value={record.linked_resource} />
                <DataField label="Provider source" value={record.source} />
                <DataField label="Recorded at" value={formatDateTime(record.updated_at || record.created_at)} />
              </dl>
            </details>
          </article>
        )}
      />
      <div className="flex flex-col gap-2 rounded-[20px] border border-white/10 bg-white/[0.04] p-3 text-center text-xs font-black text-[var(--tg-subtitle-text-color)] sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => movePage(Math.max(1, currentPage - 1))}
          className="min-h-[38px] rounded-2xl border border-white/10 px-3 text-[var(--tg-text-color)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span>Page {currentPage} of {totalPages || 1}</span>
        <button
          type="button"
          disabled={!pagination.has_next_page}
          onClick={() => movePage(currentPage + 1)}
          className="min-h-[38px] rounded-2xl border border-white/10 px-3 text-[var(--tg-text-color)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <NextActions actions={payload?.next_actions || []} />
    </div>
  );
}

function PayPalWorkspaceQuickNav({ activeLane }) {
  const items = [
    { id: 'overview', label: 'Home', icon: Home },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'payouts', label: 'Payouts', icon: Send },
    { id: 'transactions', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <nav
      aria-label="PayPal provider quick navigation"
      className="sticky bottom-3 z-20 grid grid-cols-5 gap-1 rounded-[24px] border border-white/10 bg-[color-mix(in_srgb,var(--tg-section-bg-color)_92%,transparent)] p-2 shadow-[0_14px_42px_rgba(0,0,0,0.24)] backdrop-blur"
    >
      {items.map(({ id, label, icon: Icon }) => {
        const current = activeLane === id;
        return (
          <Link
            key={id}
            to={getProviderWorkspaceRoute('paypal', id)}
            aria-current={current ? 'page' : undefined}
            className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-center text-[10px] font-black transition ${
              current
                ? 'bg-[#0070e0] text-white'
                : 'text-[var(--tg-subtitle-text-color)] hover:bg-white/[0.07] hover:text-[var(--tg-text-color)]'
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function PayPalWebhookLane({ readiness }) {
  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal Webhooks Management API"
        title="Webhooks"
        body="Signature verification readiness, delivery history, and event processing posture."
      />
      <ReadinessPanel readiness={readiness} />
      <section className="rounded-lg overflow-hidden border border-slate-200 bg-white" style={{ minHeight: '600px' }}>
        <AdminDeveloperTab />
      </section>
    </div>
  );
}

function PayPalDisputesLane({ payload, readiness }) {
  const data = readResourceData(payload);
  const detail = data.detail || {};
  const records = data.records || [];
  const actionGates = detail.action_gates || [];
  const totalAmountAtRisk = records.reduce((total, record) => total + Number(record.amount_at_risk || 0), 0);
  const evidenceDueSoon = records.filter((record) => record.evidence_deadline).length;

  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal Customer Disputes API"
        title="Disputes"
        body="Read-only dispute status, amount at risk, evidence deadlines, linked records, operator notes, and audit posture."
      />
      <ReadinessPanel readiness={readiness} />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={ShieldCheck} label="Mode" value={detail.read_only === false ? 'Actions Enabled' : 'Read Only'} detail="Dispute actions stay gated until policy, evidence, and audit flows are complete." />
        <MetricCard icon={AlertTriangle} label="Amount at Risk" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalAmountAtRisk / 100)} detail="Shown after the disputes read model is connected." tone="warning" />
        <MetricCard icon={Clock3} label="Evidence Deadline" value={evidenceDueSoon ? `${evidenceDueSoon} due` : 'Pending'} detail="Deadline tracking appears with provider dispute records." />
      </section>
      <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Transferly dispute safeguards</p>
        <ul className="mt-3 space-y-2 text-sm font-bold text-[var(--tg-text-color)]">
          <li className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">Case actions remain disabled unless a verified evidence workflow exists.</li>
          <li className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">Amount-at-risk is display-only and remains subordinate to the ledger and approval state.</li>
          <li className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">Operator notes and deadlines are preserved as audit metadata instead of account-level credentials.</li>
        </ul>
      </section>
      <CapabilityList title="Action gates" items={actionGates.map(formatActionLabel)} />
      <CapabilityList title="Read model columns" items={detail.table_columns || []} />
      {detail.operator_guidance ? (
        <section className="rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-4">
          <p className="text-sm font-black text-amber-50">Operator guidance</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-amber-50">{detail.operator_guidance}</p>
        </section>
      ) : null}
      <RecordList
        title="Dispute records"
        records={records}
        emptyTitle="No disputes yet"
        emptyBody="Dispute records will appear here after the PayPal disputes read model is connected. Actions remain disabled until evidence workflows and audit trails exist."
        renderRecord={(record) => (
          <article key={record.id || record.dispute_id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={record.status || record.lifecycle_status || 'recorded'} />
              <span className="text-xs font-bold text-[var(--tg-subtitle-text-color)]">{record.amount_at_risk || 'Amount pending'} {record.currency || ''}</span>
            </div>
            <p className="mt-2 font-black text-[var(--tg-text-color)]">{record.dispute_id || record.id}</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <DataField label="Lifecycle Status" value={record.lifecycle_status || record.status} />
              <DataField label="Evidence Deadline" value={formatDateTime(record.evidence_deadline)} />
              <DataField label="Linked Record" value={record.linked_resource || record.linked_payment || record.linked_order} />
              <DataField label="Operator Next Action" value={record.next_action || 'Review only'} />
            </dl>
          </article>
        )}
      />
      <NextActions actions={payload?.next_actions || []} />
    </div>
  );
}

function PayPalSettingsLane({ payload, readiness }) {
  const data = readResourceData(payload);
  const readinessByEnvironment = data.readiness_by_environment || [];

  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="Transferly settings"
        title="Settings"
        body="Transferly-owned configuration, operator readiness, and sanitized provider setup context."
      />
      <ReadinessPanel readiness={readiness} />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Gauge} label="Environment Mode" value={data.environment_mode || 'sandbox'} detail="Sandbox and live state are labeled by environment, not by pretending to be a PayPal account UI." />
        <MetricCard icon={ShieldCheck} label="Webhook Endpoint" value={humanizeStatus(data.webhook_endpoint_status)} detail="Endpoint readiness only; no secrets exposed." />
        <MetricCard icon={CheckCircle2} label="Supported Currencies" value={(data.supported_currencies || []).length} detail={(data.supported_currencies || []).join(', ') || 'No currency list available.'} />
      </section>
      <section className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-4">
        <p className="text-sm font-black text-emerald-50">Transferly-owned config only</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-emerald-50">
          This lane exposes Transferly control surfaces, readiness checks, and provider compatibility details. It does not impersonate PayPal account settings or expose credentials.
        </p>
      </section>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DataField label="Provider Status" value={payload?.status || readiness?.status} />
        <DataField label="Webhook Secret" value={data.webhook_secret_status || 'not-exposed'} />
        <DataField label="Enabled Actions" value={(data.enabled_actions || []).slice(0, 6).join(', ')} />
        <DataField label="Docs" value="Transferly docs + provider references" />
        <DataField label="Support" value="Transferly support desk" />
        <DataField label="Secret Values Exposed" value={String(Boolean(data.secret_values_exposed))} />
      </dl>
      <HelperList items={[
        'Show only sanitized readiness data in the UI.',
        'Never expose secret values in the workspace.',
        'Use this section to verify provider compatibility without simulating PayPal admin settings.'
      ]} />
      <CapabilityList title="Enabled Actions" items={data.enabled_actions || []} />
      <RecordList
        title="Sandbox vs live readiness"
        records={readinessByEnvironment}
        emptyTitle="No environment readiness comparison"
        emptyBody="Sandbox and live readiness metadata will appear when provider settings are available."
        renderRecord={(environment) => (
          <article key={environment.environment} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={environment.environment} />
              <StatusPill status={environment.status} />
            </div>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <DataField label="Webhook Configured" value={environment.webhook_configured ? 'Yes' : 'No'} />
              <DataField label="Missing Configuration" value={(environment.missing_configuration || []).join(', ') || 'None'} />
              <DataField label="Secrets Exposed" value={String(Boolean(environment.secret_values_exposed))} />
            </dl>
          </article>
        )}
      />
      <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Documentation</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(data.docs_links || []).map((link) => (
            <a
              key={`${link.label}-${link.url}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[42px] items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-black text-[var(--tg-text-color)]"
            >
              {link.label}
              <BookOpen size={15} />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function PayPalDeveloperLane({ payload, readiness, manifest }) {
  const data = readResourceData(payload);

  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow="PayPal developer"
        title="Traceability and operator controls"
        body="Use request IDs, idempotency keys, audit logs, and command-center tools to troubleshoot provider operations safely."
        action={(
          <a
            href={manifest.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-black text-[var(--tg-text-color)] transition hover:bg-white/[0.08]"
          >
            <BookOpen size={15} />
            PayPal docs
          </a>
        )}
      />
      <ReadinessPanel readiness={readiness} />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Code2} label="Request IDs" value="Enabled" detail={data.detail?.request_ids || 'Included with provider responses.'} />
        <MetricCard icon={RefreshCw} label="Idempotency" value="Required" detail={data.detail?.idempotency || 'Required for payout submission.'} />
        <MetricCard icon={Clock3} label="Audit trail" value="Enabled" detail={data.detail?.audit_logging || 'Sensitive operations are recorded.'} />
      </section>
      <ActionCard
        to="/miniapp/ops?provider=paypal"
        icon={Code2}
        label="Open operator tools"
        detail="Use existing replay, ignore, provider health, balance, and dead-letter recovery tools without duplicating command-center behavior."
      />
    </div>
  );
}

function PayPalPreparedLane({ lane, payload, readiness }) {
  const data = readResourceData(payload);
  const laneDefinition = getProviderLaneDefinition(lane);
  const detail = data.detail || {};
  const records = data.records || [];

  return (
    <div className="space-y-4">
      <LaneHeader
        eyebrow={readiness?.api_resource || laneDefinition.label}
        title={`${laneDefinition.label} workspace`}
        body={readiness?.implemented
          ? 'This PayPal resource is available through Transferly operations.'
          : 'This PayPal resource is prepared as a safe setup lane until the live backend module is enabled.'}
      />
      <ReadinessPanel readiness={readiness} />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Gauge} label="Setup state" value={humanizeStatus(data.setup_state)} detail="Unsupported actions return setup guidance instead of raw provider errors." />
        <MetricCard icon={ShieldCheck} label="Ledger source" value="Transferly" detail={data.source_of_truth?.transferly_ledger || 'Transferly ledger remains authoritative.'} />
        <MetricCard icon={Activity} label="Records" value={records.length} detail="Linked provider records appear here after the backend resource is enabled." />
      </section>
      <CapabilityList title="Capability checks" items={detail.capability_checks || readiness?.supported_actions || []} />
      {detail.disclaimer ? (
        <section className="rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-4">
          <p className="text-sm font-black text-amber-50">Provider settlement disclaimer</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-amber-50">{detail.disclaimer}</p>
        </section>
      ) : null}
      <RecordList
        title={`${laneDefinition.label} records`}
        records={records}
        emptyTitle={`No ${laneDefinition.label.toLowerCase()} records yet`}
        emptyBody="Transferly will show provider-linked records here after this PayPal resource is fully connected."
        renderRecord={(record) => (
          <article key={`${record.type || lane}-${record.id || record.created_at}`} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={record.status || 'recorded'} />
              <span className="text-xs font-bold text-[var(--tg-subtitle-text-color)]">{formatDateTime(record.created_at)}</span>
            </div>
            <p className="mt-2 font-black text-[var(--tg-text-color)]">{record.id || `${laneDefinition.label} record`}</p>
            <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">{record.type || record.linked_resource || 'PayPal resource'}</p>
          </article>
        )}
      />
      <NextActions actions={payload?.next_actions || []} />
    </div>
  );
}

export default function PayPalProviderWorkspace({ lane = 'overview' }) {
  const manifest = getProviderManifest('paypal');
  const requestedLane = lane || 'overview';
  const activeLane = isProviderLaneSupported('paypal', requestedLane) && paypalLanes.includes(requestedLane)
    ? requestedLane
    : 'overview';
  const resourceName = laneResourceMap[activeLane] || 'overview';
  const [resourceQueryByLane, setResourceQueryByLane] = useState({});
  const resourceParams = useMemo(() => resourceQueryByLane[activeLane] || {}, [activeLane, resourceQueryByLane]);
  const { loading, error, dashboard, resource, reload } = usePayPalWorkspaceData(activeLane, resourceParams);
  const lanes = useMemo(() => manifest.lanes.filter((item) => paypalLanes.includes(item.id)), [manifest.lanes]);
  const laneDefinition = getProviderLaneDefinition(activeLane);
  const readiness = getResourceReadiness(resource, dashboard, resourceName);
  const connectionStatus = dashboard?.provider?.status || resource?.status || readiness?.status || manifest.status;
  const environment = dashboard?.provider?.environment || resource?.environment || readiness?.environment || manifest.environmentSupport;
  const balanceSnapshot = readBalanceSnapshot(dashboard);

  if (requestedLane !== activeLane) {
    return <Navigate to={getProviderWorkspaceRoute('paypal', activeLane)} replace />;
  }

  const quickActions = [
    { label: 'Overview', to: getProviderWorkspaceRoute('paypal', 'overview') },
    { label: 'Invoices', to: getProviderWorkspaceRoute('paypal', 'invoices') },
    { label: 'Payouts', to: getProviderWorkspaceRoute('paypal', 'payouts') },
    { label: 'Webhooks', to: getProviderWorkspaceRoute('paypal', 'webhooks') },
    { label: 'Settings', to: getProviderWorkspaceRoute('paypal', 'settings') }
  ];

  const setLaneQuery = (laneId, query) => {
    setResourceQueryByLane((current) => ({
      ...current,
      [laneId]: query
    }));
  };

  return (
    <ProviderWorkspaceShell
      manifest={manifest}
      activeLane={activeLane}
      lanes={lanes}
      environment={environment}
      connectionStatus={connectionStatus}
      capabilities={manifest.capabilities}
      quickActions={quickActions}
      state={loading ? 'loading' : error ? 'error' : 'ready'}
      error={error}
      onRetry={reload}
    >
      <div className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            icon={Gauge}
            label="Workspace"
            value={laneDefinition.label}
            detail="Transferly-owned PayPal financial operations workspace"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Status"
            value={humanizeStatus(connectionStatus)}
            detail="Loaded from provider readiness and health APIs."
          />
          <MetricCard
            icon={ShieldCheck}
            label="Environment"
            value={Array.isArray(environment) ? environment.join(' / ') : environment}
            detail="Secrets and raw provider payloads are never exposed."
          />
        </section>

        <section className="rounded-[28px] border border-[#0070e0]/25 bg-[linear-gradient(135deg,rgba(0,48,135,0.92),rgba(0,112,224,0.72))] p-5 shadow-[0_20px_60px_rgba(0,48,135,0.24)]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100">Provider balance snapshot</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                {balanceSnapshot.amount}{balanceSnapshot.currency ? ` ${balanceSnapshot.currency}` : ''}
              </p>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-blue-100">
                Provider data is for reconciliation and support. Transferly’s internal ledger remains the balance source of truth.
              </p>
            </div>
            <StatusPill status={balanceSnapshot.status} />
          </div>
        </section>

        {activeLane === 'overview' ? <PayPalOverview dashboard={dashboard} resource={resource} /> : null}
        {activeLane === 'invoices' ? <PayPalInvoiceLane readiness={getResourceReadiness(resource, dashboard, 'invoices')} /> : null}
        {activeLane === 'payouts' ? <PayPalPayoutLane readiness={getResourceReadiness(resource, dashboard, 'payouts')} /> : null}
        {activeLane === 'orders' ? (
          <PayPalOrdersLane
            payload={resource}
            readiness={readiness}
            onLookupOrder={(orderId) => setLaneQuery('orders', { orderId })}
            onClearOrder={() => setLaneQuery('orders', {})}
          />
        ) : null}
        {activeLane === 'transactions' ? (
          <PayPalTransactionsLane
            payload={resource}
            readiness={readiness}
            onSearchTransactions={(query) => setLaneQuery('transactions', query)}
            onShowTransferlyTransactions={() => setLaneQuery('transactions', {})}
          />
        ) : null}
        {activeLane === 'webhooks' ? <PayPalWebhookLane payload={resource} readiness={readiness} /> : null}
        {activeLane === 'disputes' ? <PayPalDisputesLane payload={resource} readiness={readiness} /> : null}
        {activeLane === 'developer' ? <PayPalDeveloperLane payload={resource} readiness={readiness} manifest={manifest} /> : null}
        {activeLane === 'settings' ? <PayPalSettingsLane payload={resource} readiness={readiness} /> : null}
        {!['overview', 'invoices', 'payouts', 'orders', 'transactions', 'webhooks', 'disputes', 'developer', 'settings'].includes(activeLane) ? (
          <PayPalPreparedLane lane={activeLane} payload={resource} readiness={readiness} />
        ) : null}
        <PayPalWorkspaceQuickNav activeLane={activeLane} />
      </div>
    </ProviderWorkspaceShell>
  );
}
