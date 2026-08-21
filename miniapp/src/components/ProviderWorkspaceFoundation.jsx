import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useProvider } from '../providers';
import { getProviderDashboard } from '../lib/api';
import {
  getProviderManifest,
  isProviderLaneSupported
} from '../lib/providerManifests';
import { PROVIDER_CONTRACT_VERSION } from '../lib/providerWorkspaceContract';
import PayPalProviderWorkspace from './PayPalProviderWorkspace';
import ProviderWorkspaceShell from './ProviderWorkspaceShell';
import ProviderWorkspaceLayout from './providers/ProviderWorkspaceLayout';

function normalizeProviderKey(value) {
  return String(value || '').trim().toLowerCase();
}

function readProviderSlug(provider) {
  return normalizeProviderKey(provider?.slug || provider?.key || provider?.id || provider?.provider);
}

function readHealthSlug(health) {
  return normalizeProviderKey(health?.provider || health?.key || health?.slug || health?.id);
}

function formatEnvironment(manifest, providerRecord) {
  const value = providerRecord?.environment || providerRecord?.mode || providerRecord?.env;
  return value || manifest.environmentSupport || [];
}

function readConnectionStatus(manifest, providerRecord, health) {
  return health?.status || providerRecord?.status || manifest.status || '';
}

function normalizeApiError(error, fallback = 'Provider dashboard could not be loaded.') {
  return {
    message: error?.message || error?.payload?.error?.message || error?.payload?.message || fallback,
    code: error?.code || error?.payload?.error?.code || error?.payload?.code || '',
    requestId: error?.requestId || error?.payload?.requestId || '',
    status: error?.status || '',
    retryAfter: error?.retryAfter || error?.payload?.retryAfter || error?.payload?.error?.retryAfter || ''
  };
}

function useProviderDashboardSnapshot(providerSlug) {
  const [snapshot, setSnapshot] = useState({
    loading: false,
    error: '',
    errorCode: '',
    errorRequestId: '',
    errorStatus: '',
    retryAfter: '',
    capability: null,
    readiness: null,
    health: null,
    status: null,
    preflight: [],
    contractVersion: PROVIDER_CONTRACT_VERSION,
    warnings: [],
    balance: null,
    activity: [],
    dashboard: null
  });

  useEffect(() => {
    if (!providerSlug) {
      return undefined;
    }

    let cancelled = false;
    setSnapshot((current) => ({
      ...current,
      loading: true,
      error: '',
      errorCode: '',
      errorRequestId: '',
      errorStatus: '',
      retryAfter: '',
      warnings: []
    }));

    async function loadDashboard() {
      try {
        const dashboardResult = await getProviderDashboard(providerSlug);
        const dashboard = dashboardResult?.data || null;
        const warnings = [
          ...(Array.isArray(dashboard?.status?.warnings) ? dashboard.status.warnings : []),
          ...(Array.isArray(dashboard?.balances?.warnings) ? dashboard.balances.warnings : []),
          ...(Array.isArray(dashboard?.recent_activity?.warnings) ? dashboard.recent_activity.warnings : [])
        ];

        if (cancelled) {
          return;
        }

        setSnapshot({
          loading: false,
          error: '',
          errorCode: '',
          errorRequestId: '',
          errorStatus: '',
          retryAfter: '',
          capability: dashboard?.provider || null,
          readiness: dashboard?.readiness || null,
          health: dashboard?.health || null,
          status: dashboard?.status || null,
          preflight: Array.isArray(dashboard?.preflight) ? dashboard.preflight : [],
          contractVersion: dashboardResult?.contract_version || dashboard?.metadata?.contract_version || PROVIDER_CONTRACT_VERSION,
          warnings: warnings.slice(0, 3),
          balance: dashboard?.balances?.data || dashboard?.balances || null,
          activity: Array.isArray(dashboard?.recent_activity?.items) ? dashboard.recent_activity.items : [],
          dashboard
        });
      } catch (error) {
        const normalizedError = normalizeApiError(error);
        if (!cancelled) {
          setSnapshot((current) => ({
            ...current,
            loading: false,
            error: normalizedError.message,
            errorCode: normalizedError.code,
            errorRequestId: normalizedError.requestId,
            errorStatus: normalizedError.status,
            retryAfter: normalizedError.retryAfter
          }));
        }
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [providerSlug]);

  return snapshot;
}

export default function ProviderWorkspaceFoundation({ slug, lane = 'overview' }) {
  const manifest = getProviderManifest(slug);
  const registeredProvider = useProvider(manifest?.id);
  const {
    paymentProviders = [],
    providerHealth = [],
    providerBalances = {}
  } = useAppContext();

  const workspaceData = useMemo(() => {
    if (!manifest) {
      return null;
    }

    const providerRecord = paymentProviders.find((provider) => readProviderSlug(provider) === manifest.slug) || null;
    const health = providerHealth.find((item) => readHealthSlug(item) === manifest.slug) || null;

    return {
      providerRecord,
      health,
      balance: providerBalances[manifest.slug] || null,
      environment: formatEnvironment(manifest, providerRecord),
      connectionStatus: readConnectionStatus(manifest, providerRecord, health)
    };
  }, [manifest, paymentProviders, providerBalances, providerHealth]);

  const dashboardSnapshot = useProviderDashboardSnapshot(manifest?.slug && manifest.slug !== 'paypal' ? manifest.slug : '');

  if (!manifest) {
    return (
      <ProviderWorkspaceShell
        state="error"
        error="Transferly does not have a provider manifest for this service yet."
      />
    );
  }

  if (registeredProvider && !registeredProvider.enabled) {
    return (
      <ProviderWorkspaceShell
        state="error"
        error={`${manifest.displayName} is not enabled for this Transferly workspace.`}
      />
    );
  }

  if (manifest.slug === 'paypal') {
    return <PayPalProviderWorkspace lane={lane} />;
  }

  const requestedLane = lane || 'overview';
  const activeLane = isProviderLaneSupported(manifest.slug, requestedLane) ? requestedLane : 'overview';
  const unsupportedLane = requestedLane !== activeLane;

  return (
    <ProviderWorkspaceShell
      manifest={manifest}
      activeLane={activeLane}
      lanes={manifest.lanes}
      environment={workspaceData?.environment}
      connectionStatus={workspaceData?.connectionStatus}
      capabilities={manifest.capabilities}
      quickActions={[]}
      state={unsupportedLane ? 'error' : 'ready'}
      error={`${manifest.displayName} does not support the ${requestedLane} lane in Transferly yet.`}
    >
      <ProviderWorkspaceLayout
        manifest={manifest}
        activeLane={activeLane}
        requestedLane={requestedLane}
        unsupportedLane={unsupportedLane}
        workspaceData={workspaceData}
        dashboard={dashboardSnapshot.dashboard}
        snapshot={dashboardSnapshot}
        loading={dashboardSnapshot.loading}
        error={dashboardSnapshot.error}
        warnings={dashboardSnapshot.warnings}
      />
    </ProviderWorkspaceShell>
  );
}
