import React from 'react';
import { AlertTriangle, UserRoundCheck } from 'lucide-react';
import ProviderActionPanel from './ProviderActionPanel';
import ProviderActivityTimeline from './ProviderActivityTimeline';
import ProviderHeader from './ProviderHeader';
import ProviderMetricCards from './ProviderMetricCards';
import ProviderReadinessPanel from './ProviderReadinessPanel';
import ProviderSettingsPanel from './ProviderSettingsPanel';
import ProviderTabs from './ProviderTabs';
import { LoadingSkeletonCard } from '../ui';

function Notice({ error, warnings = [], loading, snapshot }) {
  if (loading) {
    return (
      <div
        className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p>Loading provider workspace data.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-hidden="true">
          <LoadingSkeletonCard variant="row" count={2} />
        </div>
      </div>
    );
  }

  if (error) {
    const details = [
      snapshot?.errorStatus ? `Status ${snapshot.errorStatus}` : '',
      snapshot?.errorCode || '',
      snapshot?.errorRequestId ? `Request ${snapshot.errorRequestId}` : '',
      snapshot?.retryAfter ? `Retry after ${snapshot.retryAfter}s` : ''
    ].filter(Boolean);

    return (
      <div
        className="flex items-start gap-3 rounded-[22px] border border-red-400/30 bg-red-500/10 p-4"
        role="alert"
        aria-live="assertive"
      >
        <AlertTriangle className="mt-0.5 shrink-0 text-red-200" size={18} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-6 text-[var(--tg-text-color)]">{error}</p>
          {details.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {details.map((detail) => (
                <span key={detail} className="rounded-full border border-red-200/20 bg-red-200/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-red-50">
                  {detail}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!warnings.length) {
    return null;
  }

  return (
    <div className="grid gap-2">
      {warnings.map((warning) => (
        <div
          key={warning}
          className="rounded-[22px] border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-bold leading-6 text-[var(--tg-text-color)]"
          role="status"
          aria-live="polite"
        >
          {warning}
        </div>
      ))}
    </div>
  );
}

function ReconciliationPanel({ dashboard }) {
  const reconciliation = dashboard?.reconciliation || {};
  const checks = Array.isArray(reconciliation.checks) ? reconciliation.checks : [];

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Reconciliation</p>
      <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">Provider balance vs ledger</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
        {reconciliation.message || 'Transferly will surface balance variance, stale funds, missing webhooks, duplicate payouts, and manual review queues here.'}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(checks.length ? checks : [
          { label: 'Ledger comparison', status: reconciliation.status || 'prepared' },
          { label: 'Manual review queue', status: 'prepared' }
        ]).map((item) => (
          <div key={item.label || item.code} className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm font-black text-[var(--tg-text-color)]">{item.label || item.code}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{item.message || item.status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfilesPanel({ dashboard }) {
  const customers = dashboard?.customer_profiles || {};
  const recipients = dashboard?.recipient_profiles || {};

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start gap-3">
        <UserRoundCheck className="mt-0.5 shrink-0 text-[var(--tg-button-color)]" size={20} aria-hidden="true" />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Customers & recipients</p>
          <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">Provider-aware profiles</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            {customers.message || recipients.message || 'Customer and recipient records will connect identity, provider history, readiness, risk notes, and lifetime activity.'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default function ProviderWorkspaceLayout({
  manifest,
  activeLane,
  requestedLane,
  unsupportedLane,
  workspaceData,
  dashboard,
  snapshot,
  loading,
  error,
  warnings = []
}) {
  const workspaceDashboard = dashboard || {};
  const shouldShowProfiles = ['customers', 'customers-recipients', 'recipients'].includes(activeLane);
  const shouldShowActivity = ['activity', 'developer', 'api-logs', 'confirmations', 'refunds'].includes(activeLane);
  const shouldShowSettings = ['settings', 'developer', 'api-logs', 'security'].includes(activeLane);
  const shouldShowReadiness = ['readiness', 'compliance', 'risk'].includes(activeLane);
  const shouldShowReconciliation = ['wallet', 'balances', 'settlements', 'activity', 'risk'].includes(activeLane);

  return (
    <div className="space-y-4">
      <ProviderHeader manifest={manifest} dashboard={workspaceDashboard} workspaceData={workspaceData} />
      <ProviderTabs manifest={manifest} activeLane={activeLane} />
      <Notice
        loading={loading}
        error={unsupportedLane ? `${manifest.displayName} does not support the ${requestedLane} lane in Transferly yet.` : error}
        warnings={warnings}
        snapshot={snapshot}
      />
      <ProviderMetricCards dashboard={workspaceDashboard} snapshot={snapshot} />

      {activeLane === 'overview' ? (
        <>
          <ProviderReadinessPanel dashboard={workspaceDashboard} />
          <ProviderActionPanel dashboard={workspaceDashboard} activeLane={activeLane} />
          <ProviderActivityTimeline dashboard={workspaceDashboard} />
          <ProviderSettingsPanel dashboard={workspaceDashboard} manifest={manifest} />
        </>
      ) : (
        <>
          {shouldShowReadiness ? <ProviderReadinessPanel dashboard={workspaceDashboard} /> : null}
          <ProviderActionPanel dashboard={workspaceDashboard} activeLane={activeLane} />
          {shouldShowActivity ? <ProviderActivityTimeline dashboard={workspaceDashboard} /> : null}
          {shouldShowReconciliation ? <ReconciliationPanel dashboard={workspaceDashboard} /> : null}
          {shouldShowProfiles ? <ProfilesPanel dashboard={workspaceDashboard} /> : null}
          {shouldShowSettings ? <ProviderSettingsPanel dashboard={workspaceDashboard} manifest={manifest} /> : null}
        </>
      )}
    </div>
  );
}
