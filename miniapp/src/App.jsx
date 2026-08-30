import React, { Suspense, lazy, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppContextProvider, useAppContext } from './context/AppContext';
import { MiniAppRuntimeProvider } from './context/MiniAppRuntimeContext';
import { TelegramMiniAppProvider } from './context/TelegramMiniAppContext';
import { ProviderRegistryProvider, ALL_PROVIDERS } from './providers';
import { AdminRoute } from './components/AdminRoute';
import { MiniAppRuntimeGate } from './components/MiniAppRuntimeGate';
import { MiniAppState } from './components/MiniAppState';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { RouteTransition } from './components/RouteTransition';
import { apiConfigValidator } from './lib/apiConfigValidator';
import {
  getProviderWorkspaceRoute,
  isProviderLaneSupported,
  isProviderManifestSlug
} from './lib/providerManifests';

const AdminPage = lazy(() => import('./pages/AdminPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const MiniAppPage = lazy(() => import('./pages/MiniAppPage'));

function RouteFallback() {
  return (
    <MiniAppState
      tone="loading"
      title="Loading Transferly workspace"
      description="Preparing provider tools, wallet controls, activity history, and secure Telegram-ready navigation."
    />
  );
}

function ApiConfigurationDiagnostics() {
  const diagnostics = useMemo(() => apiConfigValidator.reportDiagnostics(), []);

  // If there are critical issues in production, show them
  if (diagnostics.issues && diagnostics.issues.length > 0) {
    const hasCritical = diagnostics.issues.some(issue => issue.severity === 'critical');

    if (hasCritical) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-[420px] rounded-[20px] border border-red-500 bg-red-50 p-6 shadow-2xl">
            <h1 className="text-xl font-black text-red-700">Configuration Error</h1>
            <p className="mt-2 text-sm text-red-600">
              Transferly Mini App cannot start due to missing configuration.
            </p>

            <div className="mt-4 space-y-3">
              {diagnostics.issues.map((issue) => (
                <div key={issue.code} className="rounded-[12px] border border-red-300 bg-white p-3">
                  <p className="text-xs font-black text-red-700">{issue.code}</p>
                  <p className="mt-1 text-xs text-red-600">{issue.details}</p>
                  {issue.fix && (
                    <p className="mt-2 text-xs font-semibold text-red-700">
                      <span className="font-black">Fix:</span> {issue.fix}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-4 text-[11px] text-red-600">
              Environment: {diagnostics.environment?.baseUrl || 'unknown'} | API: {diagnostics.environment?.configuredBaseUrl || 'not configured'}
            </p>
          </div>
        </div>
      );
    }
  }

  return null;
}

function MiniAppRedirect({ to }) {
  const location = useLocation();

  return <Navigate to={`${to}${location.search}`} replace />;
}

const legacyProviderViewAliases = {
  activity: 'activity',
  balances: 'balances',
  billing: 'billing',
  collections: 'collections',
  compliance: 'compliance',
  confirmations: 'confirmations',
  connect: 'connect',
  customers: 'customers',
  developer: 'developer',
  invoice: 'invoices',
  invoices: 'invoices',
  overview: 'overview',
  payout: 'payouts',
  payouts: 'payouts',
  payments: 'payments',
  receive: 'receive',
  refunds: 'refunds',
  security: 'security',
  send: 'send',
  settlements: 'settlements',
  subscriptions: 'subscriptions',
  transfers: 'transfers',
  'virtual-accounts': 'virtual-accounts'
};

// Legacy service links used ?view=...; preserve deep links by mapping those
// values into provider workspace lanes and keeping unrelated query filters.
function buildLegacyProviderRoute(slug, lane, params) {
  params.delete('view');
  const query = params.toString();

  return `${getProviderWorkspaceRoute(slug, lane)}${query ? `?${query}` : ''}`;
}

function LegacyServiceRedirect() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const view = params.get('view') || '';
  const normalizedSlug = slug.toLowerCase();

  if (isProviderManifestSlug(normalizedSlug)) {
    const requestedLane = legacyProviderViewAliases[view] || view || 'overview';
    const lane = isProviderLaneSupported(normalizedSlug, requestedLane) ? requestedLane : 'overview';
    return <Navigate to={buildLegacyProviderRoute(normalizedSlug, lane, params)} replace />;
  }

  return <Navigate to={`/miniapp/services/${slug}${location.search}`} replace />;
}

function LegacyMiniAppProviderRedirect({ section }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const provider = String(params.get("provider") || "").toLowerCase();

  if (!isProviderManifestSlug(provider)) {
    return <MiniAppPage />;
  }

  const laneBySection = {
    invoices: { paypal: "invoices", stripe: "payments" },
    payouts: { crypto: "send", paypal: "payouts", stripe: "payouts" }
  };
  const requestedLane = laneBySection[section]?.[provider] || "overview";
  const lane = isProviderLaneSupported(provider, requestedLane) ? requestedLane : "overview";
  params.delete("provider");
  const query = params.toString();
  return (
    <Navigate
      to={getProviderWorkspaceRoute(provider, lane) + (query ? "?" + query : "")}
      state={{ legacyProviderRedirect: true }}
      replace
    />
  );
}

function AppRoutes({ location }) {
  return (
    <Routes location={location}>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/miniapp" replace />} />
      <Route path="/login" element={<Navigate to="/miniapp" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/miniapp" replace />} />
      <Route path="/register" element={<Navigate to="/miniapp" replace />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/miniapp" element={<MiniAppPage />} />
      <Route path="/miniapp/invoices" element={<LegacyMiniAppProviderRedirect section="invoices" />} />
      <Route path="/miniapp/payouts" element={<LegacyMiniAppProviderRedirect section="payouts" />} />
      <Route path="/miniapp/:section" element={<MiniAppPage />} />
      <Route path="/miniapp/:section/:slug" element={<MiniAppPage />} />
      <Route path="/miniapp/services/:slug/:lane" element={<MiniAppPage />} />
      <Route path="/miniapp/services/:slug/:lane/*" element={<MiniAppPage />} />
      <Route path="/miniapp/:section/:slug/*" element={<MiniAppPage />} />

      {/* Legacy web-dashboard routes now land in the Telegram Mini App workspace. */}
      <Route path="/dashboard" element={<Navigate to="/miniapp" replace />} />
      <Route path="/services" element={<MiniAppRedirect to="/miniapp/services" />} />
      <Route path="/services/:slug" element={<LegacyServiceRedirect />} />
      <Route path="/buy-point" element={<MiniAppRedirect to="/miniapp/wallet" />} />
      <Route path="/buy-points" element={<MiniAppRedirect to="/miniapp/wallet" />} />
      <Route path="/transactions" element={<MiniAppRedirect to="/miniapp/vault" />} />
      <Route path="/orders" element={<MiniAppRedirect to="/miniapp/orders" />} />
      <Route path="/referral" element={<MiniAppRedirect to="/miniapp/profile" />} />
      <Route path="/profile" element={<MiniAppRedirect to="/miniapp/profile" />} />
      <Route path="/dashboard/generate" element={<MiniAppRedirect to="/miniapp/studio" />} />
      <Route path="/dashboard/history" element={<MiniAppRedirect to="/miniapp/vault" />} />
      <Route path="/dashboard/referral" element={<MiniAppRedirect to="/miniapp/profile" />} />
      <Route path="/dashboard/profile" element={<MiniAppRedirect to="/miniapp/profile" />} />

      {/* Admin route */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/miniapp" replace />} />
    </Routes>
  );
}

function AppFrame() {
  const location = useLocation();

  return (
    <>
      <ApiConfigurationDiagnostics />
      <RouteErrorBoundary resetKey={location.pathname}>
        <MiniAppRuntimeGate>
          <RouteTransition>
            {(transitionLocation) => (
              <Suspense fallback={<RouteFallback />}>
                <AppRoutes location={transitionLocation} />
              </Suspense>
            )}
          </RouteTransition>
        </MiniAppRuntimeGate>
        <Toaster position="top-right" />
      </RouteErrorBoundary>
    </>
  );
}

function RuntimeProviderRegistry({ children }) {
  const { providerCapabilities, providerCapabilitiesLoaded } = useAppContext();

  return (
    <ProviderRegistryProvider
      initialProviders={ALL_PROVIDERS}
      runtimeCapabilities={providerCapabilities}
      runtimeCapabilitiesLoaded={providerCapabilitiesLoaded}
    >
      {children}
    </ProviderRegistryProvider>
  );
}

function App() {
  return (
    <TelegramMiniAppProvider>
      <AppContextProvider>
        <MiniAppRuntimeProvider>
          <RuntimeProviderRegistry>
            <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
              <AppFrame />
            </Router>
          </RuntimeProviderRegistry>
        </MiniAppRuntimeProvider>
      </AppContextProvider>
    </TelegramMiniAppProvider>
  );
}

export default App;
