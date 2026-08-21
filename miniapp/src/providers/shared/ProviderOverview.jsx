/**
 * ProviderOverview — shared Overview tab component.
 *
 * Displays provider readiness, metrics, and recent activity using the
 * dashboard data fetched by the parent workspace shell. Every provider's
 * Overview tab renders this component; providers that need bespoke sections
 * can pass `children` to extend it.
 *
 * Props:
 *   manifest   {object}  Provider manifest from providerManifests.js
 *   dashboard  {object}  Dashboard payload from GET /api/providers/:provider/dashboard
 *   snapshot   {object}  Local readiness snapshot
 *   loading    {boolean}
 *   error      {string|null}
 *   children   {ReactNode} Optional provider-specific extra sections
 */
import React from 'react';
import ProviderMetricCards from '../../components/providers/ProviderMetricCards';
import ProviderActivityTimeline from '../../components/providers/ProviderActivityTimeline';
import ProviderReadinessPanel from '../../components/providers/ProviderReadinessPanel';
import { LoadingSkeletonCard } from '../../components/ui';

export default function ProviderOverview({
  manifest,
  dashboard,
  snapshot,
  loading = false,
  error = null,
  children
}) {
  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LoadingSkeletonCard count={4} />
        </div>
        <LoadingSkeletonCard variant="block" count={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-[22px] border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-[var(--tg-text-color)]"
        role="alert"
      >
        <p className="font-black">Failed to load {manifest?.displayName || 'provider'} overview</p>
        <p className="mt-1 text-[var(--tg-subtitle-text-color)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Readiness panel — shows setup gates when provider isn't fully configured */}
      <ProviderReadinessPanel manifest={manifest} snapshot={snapshot} />

      {/* Key metrics: readiness, operations, balance, risk */}
      <ProviderMetricCards dashboard={dashboard} snapshot={snapshot} />

      {/* Activity timeline and webhook status */}
      <ProviderActivityTimeline dashboard={dashboard} />

      {/* Provider-specific extra sections */}
      {children}
    </div>
  );
}
