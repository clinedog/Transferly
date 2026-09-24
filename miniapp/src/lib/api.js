import { buildRequestDedupKey, createRequestDeduper } from './requestDeduper.js';
import { readThroughCache } from './readCache.js';

const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, '');
const API_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS || 15000);
const API_SAFE_RETRY_ATTEMPTS = Number(import.meta.env.VITE_API_SAFE_RETRY_ATTEMPTS || 2);
const API_DEBUG = import.meta.env.VITE_API_DEBUG === 'true' || import.meta.env.DEV;
const SESSION_TOKEN_STORAGE_KEY = 'transferly_api_session';
const LEGACY_SESSION_TOKEN_STORAGE_KEY = 'slipcraft_api_session';
const ORGANIZATION_PREFERENCE_KEY = 'transferly.selected-organization-id';
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD']);
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const safeReadRequestDeduper = createRequestDeduper();
let lastApiFailure = null;
let lastApiSuccess = null;
let sessionToken = null;
let adminSessionToken = null;

function isLocalPreviewHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

export function getApiEnvironmentStatus() {
  const usingRelativeApi = !API_BASE_URL;
  const productionLikeHost = import.meta.env.PROD && !isLocalPreviewHost();

  return {
    baseUrl: API_BASE_URL || (typeof window === 'undefined' ? '' : window.location.origin),
    configuredBaseUrl: API_BASE_URL,
    usingRelativeApi,
    missingProductionBaseUrl: productionLikeHost && usingRelativeApi,
    timeoutMs: API_REQUEST_TIMEOUT_MS,
    safeRetryAttempts: API_SAFE_RETRY_ATTEMPTS
  };
}

function buildUrl(path) {
  if (!path.startsWith('/')) {
    throw new Error(`API path must start with "/": ${path}`);
  }

  return `${API_BASE_URL}${path}`;
}

function getSelectedOrganizationId() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(ORGANIZATION_PREFERENCE_KEY) || '';
  } catch {
    return '';
  }
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'ALL') {
      return;
    }

    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function parseJsonSafely(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getRequestMethod(options = {}) {
  return String(options.method || 'GET').toUpperCase();
}

function getRetryDelay(attempt, response) {
  const retryAfter = response?.headers?.get('retry-after');

  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds * 1000, 250), 2500);
    }

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.min(Math.max(retryAt - Date.now(), 250), 2500);
    }
  }

  const jitter = Math.floor(Math.random() * 125);
  return Math.min(300 * 2 ** attempt + jitter, 1800);
}

function createNetworkError(error, requestId, { timedOut = false } = {}) {
  const requestError = new Error(
    timedOut || error.name === 'AbortError'
      ? 'Request timed out. Please try again.'
      : 'Unable to reach Transferly. Please check your connection.'
  );
  requestError.code = timedOut || error.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
  requestError.requestId = requestId;
  return requestError;
}

function shouldReportMissingProductionApi(path, response) {
  return (
    path.startsWith('/api/') &&
    response?.status === 404 &&
    getApiEnvironmentStatus().missingProductionBaseUrl
  );
}

function logApiFailure(event) {
  lastApiFailure = {
    path: event.path,
    method: event.method,
    status: event.status || null,
    code: event.code || null,
    requestId: event.requestId || null,
    attempt: event.attempt ?? null,
    retrying: Boolean(event.retrying),
    durationMs: typeof event.durationMs === 'number' ? Math.round(event.durationMs) : null,
    at: new Date().toISOString()
  };

  if (!API_DEBUG && event.status && event.status < 500 && event.code !== 'API_BASE_URL_MISSING') {
    return;
  }

  const payload = {
    path: event.path,
    method: event.method,
    status: event.status || null,
    code: event.code || null,
    requestId: event.requestId || null,
    attempt: event.attempt ?? null,
    retrying: Boolean(event.retrying),
    durationMs: typeof event.durationMs === 'number' ? Math.round(event.durationMs) : null,
    apiBaseConfigured: Boolean(API_BASE_URL)
  };

  console.warn('[Transferly API] Request did not complete cleanly', payload);
}

function recordApiSuccess(event) {
  lastApiSuccess = {
    path: event.path,
    method: event.method,
    status: event.status || null,
    requestId: event.requestId || null,
    durationMs: typeof event.durationMs === 'number' ? Math.round(event.durationMs) : null,
    at: new Date().toISOString()
  };
}

export function getApiDiagnostics() {
  return {
    environment: getApiEnvironmentStatus(),
    lastFailure: lastApiFailure,
    lastSuccess: lastApiSuccess
  };
}

export function getStoredToken() {
  if (sessionToken) return sessionToken;
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)
      || window.sessionStorage.getItem(LEGACY_SESSION_TOKEN_STORAGE_KEY)
      || null;
  } catch (error) {
    console.warn('[API] session storage unavailable', error);
    return null;
  }
}

export function getStoredAdminToken() {
  return adminSessionToken;
}

export function setStoredToken(token) {
  if (!token) {
    clearStoredToken();
    return;
  }

  sessionToken = token;
  try {
    window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn('[API] session storage unavailable; keeping token in memory only', error);
  }
}

export function setStoredAdminToken(token) {
  if (!token) {
    adminSessionToken = null;
    return;
  }

  adminSessionToken = token;
}

export function clearStoredToken() {
  sessionToken = null;
  adminSessionToken = null;
  try {
    window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn('[API] Could not clear session token storage', error);
  }
}

function getStoredTokenForPath(path) {
  if (path.startsWith('/api/admin')) {
    return getStoredAdminToken() || getStoredToken();
  }

  if (path === '/api/me' || path === '/api/me/command-center') {
    return getStoredToken() || getStoredAdminToken();
  }

  return getStoredToken();
}

function createIdempotencyKey(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}:${window.crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function createRequestId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `miniapp:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function createRequestSignal(parentSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();

  if (parentSignal?.aborted) {
    abort();
  } else {
    parentSignal?.addEventListener('abort', abort, { once: true });
  }

  const timeout = window.setTimeout(() => {
    timedOut = true;
    abort();
  }, API_REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    didTimeout() {
      return timedOut;
    },
    cleanup() {
      window.clearTimeout(timeout);
      parentSignal?.removeEventListener('abort', abort);
    }
  };
}

export async function apiRequest(path, options = {}) {
  const { retries, signal: parentSignal, ...fetchOptions } = options;
  const headers = new Headers(options.headers || {});
  headers.set('Accept', options.responseType === 'blob' ? 'text/csv,application/json' : 'application/json');
  headers.set('X-Transferly-Client', 'telegram-miniapp');

  const selectedOrganizationId = getSelectedOrganizationId();
  if (selectedOrganizationId && !headers.has('X-Organization-Id')) {
    headers.set('X-Organization-Id', selectedOrganizationId);
  }

  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', createRequestId());
  }

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const token = getStoredTokenForPath(path);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = getRequestMethod(options);
  const dedupKey = SAFE_RETRY_METHODS.has(method)
    ? buildRequestDedupKey({
        method,
        url: buildUrl(path),
        headers
      })
    : null;

  const executeRequest = async () => {
    const retryAttempts = Number.isFinite(Number(retries))
      ? Math.max(0, Number(retries))
      : (SAFE_RETRY_METHODS.has(method) ? API_SAFE_RETRY_ATTEMPTS : 0);
    const requestId = headers.get('X-Request-Id');
    const overallStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let response;

    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      const requestSignal = createRequestSignal(parentSignal);
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

      try {
        response = await fetch(buildUrl(path), {
          ...fetchOptions,
          headers,
          body,
          signal: requestSignal.signal
        });
      } catch (error) {
        const timedOut = requestSignal.didTimeout();
        requestSignal.cleanup();

        if (attempt < retryAttempts && !parentSignal?.aborted) {
          logApiFailure({
            path,
            method,
            code: timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
            requestId,
            attempt,
            retrying: true,
            durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
          });
          await sleep(getRetryDelay(attempt));
          continue;
        }

        logApiFailure({
          path,
          method,
          code: timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
          requestId,
          attempt,
          retrying: false,
          durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
        });
        throw createNetworkError(error, requestId, { timedOut });
      }

      requestSignal.cleanup();

      if (
        response.ok ||
        !RETRYABLE_STATUS_CODES.has(response.status) ||
        attempt >= retryAttempts ||
        parentSignal?.aborted
      ) {
        break;
      }

      logApiFailure({
        path,
        method,
        status: response.status,
        code: 'RETRYABLE_STATUS',
        requestId,
        attempt,
        retrying: true
      });
      await sleep(getRetryDelay(attempt, response));
    }

    const payload = response.ok && options.responseType === 'blob'
      ? await response.blob()
      : await parseJsonSafely(response);
    const responseRequestId = response.headers.get('x-request-id') || payload?.requestId || requestId;

    if (!response.ok) {
      const missingApiBaseUrl = shouldReportMissingProductionApi(path, response);
      const message =
        missingApiBaseUrl
          ? 'Transferly API URL is not configured for this Mini App deployment.'
          : payload?.error?.message || payload?.message || `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      error.code = missingApiBaseUrl ? 'API_BASE_URL_MISSING' : payload?.error?.code || payload?.code || null;
      error.retryAfter =
        response.headers.get('retry-after') ||
        payload?.retryAfter ||
        payload?.error?.retryAfter ||
        payload?.recovery?.retryAfter ||
        null;
      error.classification = payload?.classification || payload?.error?.classification || null;
      error.retryable = Boolean(payload?.retryable ?? payload?.recovery?.retryable ?? false);
      error.recovery = payload?.recovery || payload?.error?.recovery || null;
      error.requestId = responseRequestId;
      logApiFailure({
        path,
        method,
        status: response.status,
        code: error.code,
        requestId: responseRequestId,
        retrying: false
      });
      throw error;
    }

    recordApiSuccess({
      path,
      method,
      status: response.status,
      requestId: responseRequestId,
      durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - overallStartedAt
    });

    return payload;
  };

  if (dedupKey) {
    const pendingRequest = safeReadRequestDeduper.get(dedupKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    const requestPromise = executeRequest();
    safeReadRequestDeduper.set(dedupKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      safeReadRequestDeduper.delete(dedupKey);
    }
  }

  return executeRequest();
}
export function downloadAdminFinanceAnalyticsCsv(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/api/admin/finance/analytics.csv${query ? `?${query}` : ''}`, {
    responseType: 'blob'
  });
}

export function downloadAdminFinanceAnalyticsPdf(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/api/admin/finance/analytics.pdf${query ? `?${query}` : ''}`, {
    responseType: 'blob'
  });
}

export function getApiHealth(options = {}) {
  return apiRequest('/health', {
    retries: 2,
    ...options
  });
}

export function getClientHealth(options = {}) {
  return apiRequest('/api/health/client', {
    retries: 2,
    ...options
  });
}

export function getBootstrap(options = {}) {
  return apiRequest('/api/bootstrap', options);
}

export function getMe(options = {}) {
  return apiRequest('/api/me', options);
}

export function getMiniAppCommandCenter() {
  return apiRequest('/api/me/command-center');
}

export function getServiceCommandCenterSummary(slug) {
  return apiRequest(`/api/services/${encodeURIComponent(slug)}/command-center`);
}

export function getServiceLaneDetail(slug, laneId) {
  return apiRequest(`/api/services/${encodeURIComponent(slug)}/lanes/${encodeURIComponent(laneId)}`);
}

export function createServiceLaneActionIntent(slug, laneId, payload = {}) {
  return apiRequest(`/api/services/${encodeURIComponent(slug)}/lanes/${encodeURIComponent(laneId)}/actions`, {
    method: 'POST',
    body: payload
  });
}

export function loginWithTelegramMiniApp({ initData, startParam }) {
  return apiRequest('/api/auth/telegram-mini-app', {
    method: 'POST',
    body: {
      initData,
      startParam: startParam || undefined
    }
  });
}

export function listMySessions() {
  return apiRequest('/api/me/sessions');
}

export function revokeMySession(sessionId) {
  return apiRequest(`/api/me/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE'
  });
}

export function listMyApiKeys() {
  return apiRequest('/api/me/api-keys');
}

export function createMyApiKey(payload) {
  return apiRequest('/api/me/api-keys', {
    method: 'POST',
    body: payload
  });
}

export function rotateMyApiKey(keyId) {
  return apiRequest(`/api/me/api-keys/${encodeURIComponent(keyId)}/rotate`, {
    method: 'POST',
    body: {}
  });
}

export function revokeMyApiKey(keyId) {
  return apiRequest(`/api/me/api-keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE'
  });
}

export function listMyOrganizations() {
  return apiRequest('/api/me/organizations');
}

export function createMyOrganization(payload) {
  return apiRequest('/api/me/organizations', {
    method: 'POST',
    body: payload
  });
}

export function getMyOrganizationContext(organizationId) {
  return apiRequest(`/api/me/organizations/${encodeURIComponent(organizationId)}/context`);
}

export function listMyOrganizationMembers(organizationId) {
  return apiRequest(`/api/me/organizations/${encodeURIComponent(organizationId)}/members`);
}

export function updateMyOrganizationMemberRole(organizationId, userId, role) {
  return apiRequest(`/api/me/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: { role }
  });
}

export function removeMyOrganizationMember(organizationId, userId) {
  return apiRequest(`/api/me/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  });
}

export function listMyOrganizationInvitations(organizationId) {
  return apiRequest(`/api/me/organizations/${encodeURIComponent(organizationId)}/invitations`);
}

export function createMyOrganizationInvitation(organizationId, payload) {
  return apiRequest(`/api/me/organizations/${encodeURIComponent(organizationId)}/invitations`, {
    method: 'POST',
    body: payload
  });
}

export function revokeMyOrganizationInvitation(organizationId, invitationId) {
  return apiRequest(`/api/me/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}`, {
    method: 'DELETE'
  });
}

export function acceptMyOrganizationInvitation(token) {
  return apiRequest('/api/me/organization-invitations/accept', {
    method: 'POST',
    body: { token }
  });
}

export function generateReceipt(payload) {
  return apiRequest('/api/receipt/generate', {
    method: 'POST',
    body: payload
  });
}

export function getReferralStats() {
  return apiRequest('/api/referral', {
    method: 'POST',
    body: { action: 'stats' }
  });
}

export function updateProfile(payload) {
  return apiRequest('/api/user/me/profile', {
    method: 'PATCH',
    body: payload
  });
}

export function deleteAccount() {
  return apiRequest('/api/user/me', {
    method: 'DELETE'
  });
}

export function listTopUpOrders() {
  return apiRequest('/api/user/me/top-up-orders');
}

export function getPointsFundingConfig() {
  return apiRequest('/api/user/me/points/funding/config');
}

export function listPointsFundingRequests() {
  return apiRequest('/api/user/me/points/funding/requests');
}

export function listNotifications(params = {}) {
  return apiRequest(`/api/user/me/notifications${buildQuery(params)}`);
}

export function getNotificationPreferences() {
  return apiRequest('/api/user/me/notification-preferences');
}

export function updateNotificationPreferences(payload) {
  return apiRequest('/api/user/me/notification-preferences', {
    method: 'PATCH',
    body: payload
  });
}

export function listTransactionActivity(params = {}) {
  return apiRequest(`/api/user/me/transaction-activity${buildQuery(params)}`);
}

export function markNotificationRead(notificationId) {
  return apiRequest(`/api/user/me/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'POST',
    body: {}
  });
}

export function listSupportTickets(params = {}) {
  return apiRequest(`/api/user/me/support-tickets${buildQuery(params)}`);
}

export function createSupportTicket(payload) {
  return apiRequest('/api/user/me/support-tickets', {
    method: 'POST',
    body: payload
  });
}

export function createPointsFundingRequest(payload) {
  return apiRequest('/api/user/me/points/funding/requests', {
    method: 'POST',
    headers: {
      'Idempotency-Key': createIdempotencyKey('miniapp:points-funding:create')
    },
    body: payload
  });
}

export function submitPointsFundingEvidence(requestId, payload) {
  return apiRequest(`/api/user/me/points/funding/requests/${encodeURIComponent(requestId)}/evidence`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': createIdempotencyKey('miniapp:points-funding:evidence')
    },
    body: payload
  });
}

export function uploadPointsFundingEvidence(requestId, payload) {
  return apiRequest(`/api/user/me/points/funding/requests/${encodeURIComponent(requestId)}/evidence/upload`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': createIdempotencyKey('miniapp:points-funding:evidence-upload')
    },
    body: payload
  });
}

export function createTopUpOrder(payload) {
  return apiRequest('/api/user/me/top-up-orders', {
    method: 'POST',
    body: payload
  });
}

export function updateTopUpOrderStatus(orderId, payload) {
  return apiRequest(`/api/user/me/top-up-orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body: payload
  });
}

export function listAdminTopUpOrders(params = {}) {
  const search = new URLSearchParams();
  if (params.status) {
    search.set('status', params.status);
  }
  if (params.userId) {
    search.set('userId', params.userId);
  }
  if (params.limit) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return apiRequest(`/api/admin/top-up-orders${query ? `?${query}` : ''}`);
}

export function completeAdminTopUpOrder(orderId, notes) {
  return apiRequest(`/api/admin/top-up-orders/${encodeURIComponent(orderId)}/complete`, {
    method: 'POST',
    body: notes ? { notes } : {}
  });
}

export function cancelAdminTopUpOrder(orderId, notes) {
  return apiRequest(`/api/admin/top-up-orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body: notes ? { notes } : {}
  });
}

export function getAdminUsers() {
  return apiRequest('/api/admin/users');
}

export function listAdminInvoiceTemplates() {
  return apiRequest('/api/admin/invoice-templates');
}

export function listAdminInvoices(params = {}) {
  return apiRequest(`/api/admin/invoices${buildQuery(params)}`);
}

export function listPaymentProviders() {
  return apiRequest('/api/admin/payment-providers');
}

export function listPaymentProviderHealth() {
  return apiRequest('/api/admin/payment-providers/health');
}

export function getAdminProductionReadiness() {
  return apiRequest('/api/admin/production-readiness');
}

export function listAdminProviderIncidents() {
  return apiRequest('/api/admin/provider-incidents');
}

export function listAdminAutomationHistory(params = {}) {
  return apiRequest(`/api/admin/automation-history${buildQuery(params)}`);
}

export function listAdminAutomationRules() {
  return apiRequest('/api/admin/automation-rules');
}

export function createAdminAutomationRule(body) {
  return apiRequest('/api/admin/automation-rules', { method: 'POST', body });
}

export function updateAdminAutomationRuleStatus(id, status) {
  return apiRequest(`/api/admin/automation-rules/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
}

export function dryRunAdminAutomationRule(id, event) {
  return apiRequest(`/api/admin/automation-rules/${encodeURIComponent(id)}/dry-run`, { method: 'POST', body: event });
}

export function getAdminSecurityOverview() {
  return apiRequest('/api/admin/security-overview');
}

export function listPaymentProviderInvoiceFeatures() {
  return apiRequest('/api/admin/payment-providers/invoice-features');
}

export function getPaymentProviderBalance(provider) {
  return apiRequest(`/api/admin/payment-providers/${encodeURIComponent(provider)}/balance`);
}

function buildProviderPath(provider, suffix = '') {
  const basePath = `/api/providers/${encodeURIComponent(provider)}`;
  return suffix ? `${basePath}/${suffix}` : basePath;
}

export function listProviderCapabilities() {
  return readThroughCache('provider-capabilities', () => apiRequest('/api/providers'), {
    ttlMs: 60000,
    staleMs: 300000
  });
}

export function getProviderCapability(provider) {
  return readThroughCache(`provider-capability:${provider}`, () => apiRequest(buildProviderPath(provider)), {
    ttlMs: 60000,
    staleMs: 300000
  });
}

export function listProviderReadiness() {
  return readThroughCache('provider-readiness', () => apiRequest('/api/providers/readiness'), {
    ttlMs: 30000,
    staleMs: 120000
  });
}

export function getProviderReadiness(provider) {
  return readThroughCache(`provider-readiness:${provider}`, () => apiRequest(buildProviderPath(provider, 'readiness')), {
    ttlMs: 30000,
    staleMs: 120000
  });
}

export function getProviderHealth(provider) {
  return apiRequest(buildProviderPath(provider, 'health'));
}

export function getProviderStatus(provider) {
  return apiRequest(buildProviderPath(provider, 'status'));
}

export function getProviderDashboard(provider) {
  return apiRequest(buildProviderPath(provider, 'dashboard'));
}

export function getProviderResource(provider, resource, params = {}) {
  const resourcePath = String(resource || '').trim().replace(/^\/+/, '');
  if (!resourcePath) {
    return getProviderDashboard(provider);
  }

  return apiRequest(`${buildProviderPath(provider, resourcePath)}${buildQuery(params)}`);
}

export function preflightProviderAction(provider, operation) {
  return apiRequest(`${buildProviderPath(provider, 'actions')}/${encodeURIComponent(operation)}/preflight`);
}

export function listProviderLanes(provider) {
  return apiRequest(buildProviderPath(provider, 'lanes'));
}

export function getProviderLane(provider, laneId) {
  return apiRequest(`${buildProviderPath(provider, 'lanes')}/${encodeURIComponent(laneId)}`);
}

export function listProviderInvoices(provider, params = {}) {
  return apiRequest(`${buildProviderPath(provider, 'invoices')}${buildQuery(params)}`);
}

export function previewProviderInvoice(provider, payload) {
  return apiRequest(buildProviderPath(provider, 'invoices/preview'), {
    method: 'POST',
    body: payload
  });
}

export function createProviderInvoice(provider, payload) {
  return apiRequest(buildProviderPath(provider, 'invoices'), {
    method: 'POST',
    body: payload
  });
}

export function listProviderPayouts(provider, params = {}) {
  return apiRequest(`${buildProviderPath(provider, 'payouts')}${buildQuery(params)}`);
}

export function previewProviderPayout(provider, payload) {
  return apiRequest(buildProviderPath(provider, 'payouts/preview'), {
    method: 'POST',
    body: payload
  });
}

export function createProviderPayout(provider, payload = {}) {
  const { idempotencyKey, ...body } = payload;
  return apiRequest(buildProviderPath(provider, 'payouts'), {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey || createIdempotencyKey(`provider-payout:${provider}`)
    },
    body
  });
}

export function getProviderScopedBalance(provider, params = {}) {
  return apiRequest(`${buildProviderPath(provider, 'balance')}${buildQuery(params)}`);
}

export function listProviderActivity(provider, params = {}) {
  return apiRequest(`${buildProviderPath(provider, 'activity')}${buildQuery(params)}`);
}

export function listStripeConnectedAccounts(params = {}) {
  return apiRequest(`/api/admin/payment-providers/stripe/connected-accounts${buildQuery(params)}`);
}

export function createStripeConnectedAccount(payload) {
  return apiRequest('/api/admin/payment-providers/stripe/connected-accounts', {
    method: 'POST',
    body: payload
  });
}

export function refreshStripeConnectedAccount(accountId) {
  return apiRequest(`/api/admin/payment-providers/stripe/connected-accounts/${encodeURIComponent(accountId)}/refresh`, {
    method: 'POST'
  });
}

export function createStripeConnectedAccountOnboardingLink(accountId, payload = {}) {
  return apiRequest(`/api/admin/payment-providers/stripe/connected-accounts/${encodeURIComponent(accountId)}/onboarding-link`, {
    method: 'POST',
    body: payload
  });
}

export function listInvoiceReminderConfigurations(type) {
  const search = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiRequest(`/api/admin/invoice-reminders${search}`);
}

export function updateInvoiceReminderConfiguration(configurationId, payload) {
  return apiRequest(`/api/admin/invoice-reminders/${encodeURIComponent(configurationId)}`, {
    method: 'PUT',
    body: payload
  });
}

export function suspendInvoiceReminderConfiguration(configurationId) {
  return apiRequest(`/api/admin/invoice-reminders/${encodeURIComponent(configurationId)}/suspend`, {
    method: 'POST'
  });
}

export function resumeInvoiceReminderConfiguration(configurationId) {
  return apiRequest(`/api/admin/invoice-reminders/${encodeURIComponent(configurationId)}/resume`, {
    method: 'POST'
  });
}

export function createAdminInvoiceTemplate(payload) {
  return apiRequest('/api/admin/invoice-templates', {
    method: 'POST',
    body: payload
  });
}

export function updateAdminInvoiceTemplate(templateId, payload) {
  return apiRequest(`/api/admin/invoice-templates/${encodeURIComponent(templateId)}`, {
    method: 'PATCH',
    body: payload
  });
}

export function deleteAdminInvoiceTemplate(templateId) {
  return apiRequest(`/api/admin/invoice-templates/${encodeURIComponent(templateId)}`, {
    method: 'DELETE'
  });
}

export function listPaymentOpsIssues(params = {}) {
  return apiRequest(`/api/admin/payment-issues${buildQuery(params)}`);
}

export function listAdminWebhookEvents(params = {}) {
  return apiRequest(`/api/admin/webhooks${buildQuery(params)}`);
}

export function listDeadLetterJobs(params = {}) {
  return apiRequest(`/api/admin/dead-letters${buildQuery(params)}`);
}

export function recoverDeadLetterJob(jobId, note) {
  return apiRequest(`/api/admin/dead-letters/${encodeURIComponent(jobId)}/recover`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function getAdminWebhookEvent(webhookEventId) {
  return apiRequest(`/api/admin/webhooks/${encodeURIComponent(webhookEventId)}`);
}

export function replayAdminWebhookEvent(webhookEventId, note) {
  return apiRequest(`/api/admin/webhooks/${encodeURIComponent(webhookEventId)}/replay`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function ignoreAdminWebhookEvent(webhookEventId, note) {
  return apiRequest(`/api/admin/webhooks/${encodeURIComponent(webhookEventId)}/ignore`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function acknowledgePaymentOpsIssue(issueId, note) {
  return apiRequest(`/api/admin/payment-issues/${encodeURIComponent(issueId)}/acknowledge`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function resolvePaymentOpsIssue(issueId, note) {
  return apiRequest(`/api/admin/payment-issues/${encodeURIComponent(issueId)}/resolve`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function reopenPaymentOpsIssue(issueId, note) {
  return apiRequest(`/api/admin/payment-issues/${encodeURIComponent(issueId)}/reopen`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function adjustUserPoints(userId, delta, reason) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/points`, {
    method: 'POST',
    body: { delta, reason }
  });
}

export function getAdminFinanceOverview() {
  return apiRequest('/api/admin/finance/overview');
}

export function getAdminFinanceAnalytics(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/api/admin/finance/analytics${query ? `?${query}` : ''}`);
}

export function listPaymentLinks(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/api/invoices/payment-links${query ? `?${query}` : ''}`);
}

export function listAdminAuditLogs(params = {}) {
  return apiRequest(`/api/admin/audit-logs${buildQuery(params)}`);
}

export function listAdminFinanceTransactions(params = {}) {
  return apiRequest(`/api/admin/finance/transactions${buildQuery(params)}`);
}

export function listAdminFinanceReconciliationAlerts(params = {}) {
  return apiRequest(`/api/admin/finance/reconciliation-alerts${buildQuery(params)}`);
}

export function listAdminUnmatchedPayments(params = {}) {
  return apiRequest(`/api/admin/payments/unmatched${buildQuery(params)}`);
}

export function getAdminUserFinanceProfile(userId) {
  return apiRequest(`/api/admin/finance/users/${encodeURIComponent(userId)}`);
}

export function listAdminPointsFunding(params = {}) {
  return apiRequest(`/api/admin/points-funding${buildQuery(params)}`);
}

export function getAdminPointsFundingRequest(requestId) {
  return apiRequest(`/api/admin/points-funding/${encodeURIComponent(requestId)}`);
}

export function assignAdminPointsFundingRequest(requestId, assignedTo) {
  return apiRequest(`/api/admin/points-funding/${encodeURIComponent(requestId)}/assign`, {
    method: 'POST',
    body: { assignedTo }
  });
}

export function approveAdminPointsFundingRequest(requestId, adminNote = '') {
  return apiRequest(`/api/admin/points-funding/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': createIdempotencyKey('miniapp:admin-points-funding:approve')
    },
    body: { adminNote }
  });
}

export function rejectAdminPointsFundingRequest(requestId, rejectionReason, adminNote = '') {
  return apiRequest(`/api/admin/points-funding/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
    body: { rejectionReason, adminNote }
  });
}

export function requestAdminPointsFundingInfo(requestId, adminNote) {
  return apiRequest(`/api/admin/points-funding/${encodeURIComponent(requestId)}/request-info`, {
    method: 'POST',
    body: { adminNote }
  });
}

export function getAdminRiskOverview() {
  return apiRequest('/api/admin/risk/overview');
}

export function listAdminRiskCases(params = {}) {
  return apiRequest(`/api/admin/risk/cases${buildQuery(params)}`);
}

export function listAdminRiskSignals(params = {}) {
  return apiRequest(`/api/admin/risk/signals${buildQuery(params)}`);
}

export function updateAdminRiskCaseStatus(caseId, payload) {
  return apiRequest(`/api/admin/risk/cases/${encodeURIComponent(caseId)}/status`, {
    method: 'POST',
    body: payload
  });
}

export function markAdminRiskCaseFalsePositive(caseId, reason) {
  return apiRequest(`/api/admin/risk/cases/${encodeURIComponent(caseId)}/false-positive`, {
    method: 'POST',
    body: { reason }
  });
}

export function updatePlatformConfig(payload) {
  return apiRequest('/api/admin/config', {
    method: 'PATCH',
    body: payload
  });
}

export function createFaq(payload) {
  return apiRequest('/api/admin/faqs', {
    method: 'POST',
    body: payload
  });
}

export function updateFaq(faqId, payload) {
  return apiRequest(`/api/admin/faqs/${faqId}`, {
    method: 'PATCH',
    body: payload
  });
}

export function deleteFaq(faqId) {
  return apiRequest(`/api/admin/faqs/${faqId}`, {
    method: 'DELETE'
  });
}

export function createTestimonial(payload) {
  return apiRequest('/api/admin/testimonials', {
    method: 'POST',
    body: payload
  });
}

export function updateTestimonial(testimonialId, payload) {
  return apiRequest(`/api/admin/testimonials/${testimonialId}`, {
    method: 'PATCH',
    body: payload
  });
}

export function deleteTestimonial(testimonialId) {
  return apiRequest(`/api/admin/testimonials/${testimonialId}`, {
    method: 'DELETE'
  });
}

export function listInvoices(params = {}) {
  return apiRequest(`/api/invoices${buildQuery(params)}`);
}

export function createInvoice(payload) {
  const { idempotencyKey, ...body } = payload || {};

  return apiRequest('/api/invoices', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey || createIdempotencyKey('invoice')
    },
    body
  });
}

export function previewInvoice(payload) {
  return apiRequest('/api/invoices/preview', {
    method: 'POST',
    body: payload
  });
}

export function getInvoice(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}`);
}

export function refreshInvoice(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/refresh`, {
    method: 'POST'
  });
}

export function sendInvoiceReminder(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/remind`, {
    method: 'POST'
  });
}

export function cancelInvoiceAutoReminders(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/cancel-reminders`, {
    method: 'POST'
  });
}

export function generateInvoiceQr(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/qr`, {
    method: 'POST'
  });
}

export function cancelInvoice(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
    method: 'POST'
  });
}

export function getInvoiceTimeline(invoiceId, limit = 25) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/timeline?limit=${encodeURIComponent(limit)}`);
}

export function listPayouts(params = {}) {
  return apiRequest(`/api/payouts${buildQuery(params)}`);
}

export function listAdminPayouts(params = {}) {
  return apiRequest(`/api/admin/payouts${buildQuery(params)}`);
}

export function createPayout(payload) {
  const { idempotencyKey, ...body } = payload || {};

  return apiRequest('/api/payouts', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey || createIdempotencyKey('payout')
    },
    body
  });
}

export function previewPayout(payload) {
  return apiRequest('/api/payouts/preview', {
    method: 'POST',
    body: payload
  });
}

export function getPayout(payoutId) {
  return apiRequest(`/api/payouts/${encodeURIComponent(payoutId)}`);
}

export function approveAdminPayout(payoutId) {
  return apiRequest(`/api/admin/payouts/${encodeURIComponent(payoutId)}/approve`, {
    method: 'POST'
  });
}

export function rejectAdminPayout(payoutId, reason) {
  return apiRequest(`/api/admin/payouts/${encodeURIComponent(payoutId)}/reject`, {
    method: 'POST',
    body: reason ? { reason } : {}
  });
}

export function releaseAdminInvoiceFunds(invoiceId, payload = {}) {
  return apiRequest(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/release`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': `invoice-release:${invoiceId}:${Date.now()}`
    },
    body: payload
  });
}

export function markAdminInvoiceReviewRequired(invoiceId, payload = {}) {
  return apiRequest(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/review-required`, {
    method: 'POST',
    body: payload
  });
}

export function addAdminInvoiceNote(invoiceId, note) {
  return apiRequest(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/notes`, {
    method: 'POST',
    body: { note }
  });
}

export function addAdminPayoutNote(payoutId, note) {
  return apiRequest(`/api/admin/payouts/${encodeURIComponent(payoutId)}/notes`, {
    method: 'POST',
    body: { note }
  });
}

export function refreshPayout(payoutId) {
  return apiRequest(`/api/payouts/${encodeURIComponent(payoutId)}/refresh`, {
    method: 'POST'
  });
}

export function cancelUnclaimedPayout(payoutId) {
  return apiRequest(`/api/admin/payouts/${encodeURIComponent(payoutId)}/cancel-unclaimed`, {
    method: 'POST'
  });
}

export function getPayoutTimeline(payoutId, limit = 25) {
  return apiRequest(`/api/payouts/${encodeURIComponent(payoutId)}/timeline?limit=${encodeURIComponent(limit)}`);
}

export function runPaymentReconciliation(payload = {}) {
  return apiRequest('/api/admin/reconciliation/run', {
    method: 'POST',
    body: payload
  });
}
