import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  acknowledgePaymentOpsIssue as acknowledgePaymentOpsIssueRequest,
  addAdminInvoiceNote as addAdminInvoiceNoteRequest,
  addAdminPayoutNote as addAdminPayoutNoteRequest,
  adjustUserPoints as adjustUserPointsRequest,
  approveAdminPayout as approveAdminPayoutRequest,
  cancelUnclaimedPayout as cancelUnclaimedPayoutRequest,
  cancelInvoiceAutoReminders as cancelInvoiceAutoRemindersRequest,
  cancelInvoice as cancelInvoiceRequest,
  createInvoice as createInvoiceRequest,
  createPayout as createPayoutRequest,
  createPointsFundingRequest as createPointsFundingRequestRequest,
  createAdminInvoiceTemplate as createAdminInvoiceTemplateRequest,
  createFaq as createFaqRequest,
  createTestimonial as createTestimonialRequest,
  createTopUpOrder as createTopUpOrderRequest,
  clearStoredToken,
  getStoredAdminToken,
  getStoredToken,
  deleteFaq as deleteFaqRequest,
  deleteAccount as deleteAccountRequest,
  deleteAdminInvoiceTemplate as deleteAdminInvoiceTemplateRequest,
  deleteTestimonial as deleteTestimonialRequest,
  generateReceipt as generateReceiptRequest,
  generateInvoiceQr as generateInvoiceQrRequest,
  getAdminUsers,
  getApiDiagnostics,
  getApiEnvironmentStatus,
  getBootstrap,
  getClientHealth,
  getMiniAppCommandCenter,
  getInvoiceTimeline as getInvoiceTimelineRequest,
  getAdminWebhookEvent as getAdminWebhookEventRequest,
  getPaymentProviderBalance as getPaymentProviderBalanceRequest,
  getMe,
  getPointsFundingConfig as getPointsFundingConfigRequest,
  listDeadLetterJobs as listDeadLetterJobsRequest,
  listInvoiceReminderConfigurations as listInvoiceReminderConfigurationsRequest,
  listAdminWebhookEvents as listAdminWebhookEventsRequest,
  listAdminInvoices as listAdminInvoicesRequest,
  listAdminInvoiceTemplates as listAdminInvoiceTemplatesRequest,
  listAdminPayouts as listAdminPayoutsRequest,
  listAdminTopUpOrders as listAdminTopUpOrdersRequest,
  listPaymentOpsIssues as listPaymentOpsIssuesRequest,
  listPaymentProviderHealth as listPaymentProviderHealthRequest,
  listPaymentProviders as listPaymentProvidersRequest,
  listMyOrganizations,
  getMyOrganizationContext,
  listProviderCapabilities as listProviderCapabilitiesRequest,
  markAdminInvoiceReviewRequired as markAdminInvoiceReviewRequiredRequest,
  ignoreAdminWebhookEvent as ignoreAdminWebhookEventRequest,
  recoverDeadLetterJob as recoverDeadLetterJobRequest,
  reopenPaymentOpsIssue as reopenPaymentOpsIssueRequest,
  replayAdminWebhookEvent as replayAdminWebhookEventRequest,
  resolvePaymentOpsIssue as resolvePaymentOpsIssueRequest,
  getPayoutTimeline as getPayoutTimelineRequest,
  getReferralStats,
  listInvoices as listInvoicesRequest,
  listTopUpOrders as listTopUpOrdersRequest,
  loginWithTelegramMiniApp as loginWithTelegramMiniAppRequest,
  listPayouts as listPayoutsRequest,
  listPointsFundingRequests as listPointsFundingRequestsRequest,
  listNotifications as listNotificationsRequest,
  listTransactionActivity as listTransactionActivityRequest,
  markNotificationRead as markNotificationReadRequest,
  previewInvoice as previewInvoiceRequest,
  previewPayout as previewPayoutRequest,
  refreshInvoice as refreshInvoiceRequest,
  refreshPayout as refreshPayoutRequest,
  runPaymentReconciliation as runPaymentReconciliationRequest,
  rejectAdminPayout as rejectAdminPayoutRequest,
  releaseAdminInvoiceFunds as releaseAdminInvoiceFundsRequest,
  sendInvoiceReminder as sendInvoiceReminderRequest,
  setStoredToken,
  submitPointsFundingEvidence as submitPointsFundingEvidenceRequest,
  uploadPointsFundingEvidence as uploadPointsFundingEvidenceRequest,
  suspendInvoiceReminderConfiguration as suspendInvoiceReminderConfigurationRequest,
  updateFaq as updateFaqRequest,
  updateAdminInvoiceTemplate as updateAdminInvoiceTemplateRequest,
  updateInvoiceReminderConfiguration as updateInvoiceReminderConfigurationRequest,
  updatePlatformConfig,
  updateProfile as updateProfileRequest,
  completeAdminTopUpOrder as completeAdminTopUpOrderRequest,
  cancelAdminTopUpOrder as cancelAdminTopUpOrderRequest,
  updateTopUpOrderStatus as updateTopUpOrderStatusRequest,
  resumeInvoiceReminderConfiguration as resumeInvoiceReminderConfigurationRequest,
  updateTestimonial as updateTestimonialRequest
} from '../lib/api';
import { getRawTelegramInitData, getTelegramStartParam } from '../lib/telegramMiniApp';
import { useTelegramMiniApp } from './TelegramMiniAppContext';
import { getAuthStateManager, AUTH_STATES } from '../lib/authStateManager';

export const AppContext = createContext();

const defaultConfig = {
  platform_name: 'Transferly',
  tagline: 'Generate Professional Receipts Instantly',
  support_email: 'support@transferly.app',
  admin_email: 'admin@transferly.app',
  brand_color: '#2aabee',
  bank_slip_cost: 10,
  email_receipt_cost: 5,
  default_service_point_charge: 250,
  points_value_note: '1 Transferly Point = ₦1',
  referral_bonus: 20,
  signup_bonus: 50,
  total_users: 1240,
  total_receipts: 45800,
  uptime: '99.9%',
  privacy_policy:
    'We take your privacy seriously. Transferly collects minimal data necessary to provide our services.',
  terms_of_service:
    'By using Transferly, you agree to use the platform for lawful purposes only.',
  about_us: 'Transferly is a professional receipt generation platform.'
};

const BOOTSTRAP_CACHE_KEY = 'transferly_bootstrap_cache_v1';

function readCachedBootstrap() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedBootstrap(payload) {
  if (typeof window === 'undefined' || !payload) {
    return;
  }

  try {
    window.localStorage.setItem(
      BOOTSTRAP_CACHE_KEY,
      JSON.stringify({
        platform: payload.platform || null,
        faqs: Array.isArray(payload.faqs) ? payload.faqs : [],
        testimonials: Array.isArray(payload.testimonials) ? payload.testimonials : [],
        cachedAt: new Date().toISOString()
      })
    );
  } catch {
    // Ignore storage restrictions in embedded webviews.
  }
}

function isRecoverableConnectionError(error) {
  if (typeof error?.retryable === 'boolean') {
    return error.retryable;
  }

  return (
    error?.code === 'NETWORK_ERROR' ||
    error?.code === 'REQUEST_TIMEOUT' ||
    error?.status === 408 ||
    error?.status === 425 ||
    error?.status === 429 ||
    error?.status >= 500
  );
}

function logInitializationIssue(message, error) {
  console.warn(message, {
    code: error?.code || null,
    status: error?.status || null,
    requestId: error?.requestId || null,
    api: getApiEnvironmentStatus()
  });
}

function buildInitializationIssue(error) {
  return {
    code: error?.code || null,
    requestId: error?.requestId || null,
    status: error?.status || null,
    classification: error?.classification || null,
    retryable: typeof error?.retryable === 'boolean' ? error.retryable : undefined,
    recovery: error?.recovery || null,
    message: error?.message || 'Unable to initialize Transferly.',
    recoverable: isRecoverableConnectionError(error),
    at: new Date().toISOString()
  };
}

function getTopUpOrdersStorageKey(userId) {
  return `transferly_topup_orders_${userId || 'guest'}`;
}

function getLegacyTopUpOrdersStorageKey(userId) {
  return `slipcraft_topup_orders_${userId || 'guest'}`;
}

function loadTopUpOrders(userId) {
  if (typeof window === 'undefined' || !userId) {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(getTopUpOrdersStorageKey(userId)) ||
      window.localStorage.getItem(getLegacyTopUpOrdersStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTopUpOrders(userId, orders) {
  if (typeof window === 'undefined' || !userId) {
    return;
  }

  try {
    window.localStorage.setItem(getTopUpOrdersStorageKey(userId), JSON.stringify(orders));
    window.localStorage.removeItem(getLegacyTopUpOrdersStorageKey(userId));
  } catch (error) {
    // Storage quota exceeded or unavailable - log but don't crash
    if (error.name === 'QuotaExceededError') {
      console.warn('[AppContext] Could not save top-up orders: storage quota exceeded', error);
    } else if (error.name === 'SecurityError') {
      console.warn('[AppContext] Could not save top-up orders: storage unavailable (private mode)', error);
    } else {
      console.error('[AppContext] Could not save top-up orders', error);
    }
  }
}

function normalizeReceipt(receipt) {
  if (!receipt) {
    return receipt;
  }

  return {
    ...receipt,
    created_at: receipt.created_at || receipt.createdAt || null,
    pdf_base64: receipt.pdf_base64 || receipt.pdfBase64 || null,
    image_data_url: receipt.image_data_url || receipt.imageDataUrl || null
  };
}

function normalizeTopUpOrder(order) {
  if (!order) {
    return order;
  }

  return {
    ...order,
    order_id: order.order_id || order.orderId || order.id || '',
    id: order.id || order.order_id || order.orderId || '',
    amount_label: order.amount_label || order.amountLabel || `${Number(order.points || 0).toLocaleString()} pts`,
    method_id: order.method_id || order.methodId || '',
    method_title: order.method_title || order.methodTitle || '',
    service_intent: order.service_intent || order.serviceIntent || '',
    vendor_url: order.vendor_url || order.vendorUrl || '',
    admin_notes: order.admin_notes || order.adminNotes || '',
    submitted_at: order.submitted_at || order.submittedAt || null,
    completed_at: order.completed_at || order.completedAt || null,
    cancelled_at: order.cancelled_at || order.cancelledAt || null,
    created_at: order.created_at || order.createdAt || null,
    updated_at: order.updated_at || order.updatedAt || null
  };
}

function normalizeFundingRequest(request) {
  if (!request) {
    return request;
  }

  return {
    ...request,
    id: request.id || request.funding_request_id || '',
    public_reference: request.public_reference || request.publicReference || '',
    requested_points: Number(request.requested_points ?? request.requestedPoints ?? 0),
    expected_amount_minor: Number(request.expected_amount_minor ?? request.expectedAmountMinor ?? 0),
    display_amount: request.display_amount || request.displayAmount || '',
    payment_reference: request.payment_reference || request.paymentReference || request.public_reference || '',
    destination_snapshot: request.destination_snapshot || request.destinationSnapshot || {},
    user_transaction_reference: request.user_transaction_reference || request.userTransactionReference || '',
    admin_note: request.admin_note || request.adminNote || '',
    rejection_reason: request.rejection_reason || request.rejectionReason || '',
    created_at: request.created_at || request.createdAt || null,
    submitted_at: request.submitted_at || request.submittedAt || null,
    reviewed_at: request.reviewed_at || request.reviewedAt || null,
    credited_at: request.credited_at || request.creditedAt || null,
    possible_duplicate: Boolean(request.possible_duplicate ?? request.possibleDuplicate ?? false)
  };
}

function mapUser(snapshotUser, snapshotProfile) {
  if (!snapshotUser) {
    return null;
  }

  const role = String(
    snapshotProfile?.role ||
      snapshotUser?.role ||
      snapshotUser?.profile?.role ||
      'USER'
  ).toUpperCase();
  const isOwner = Boolean(
    snapshotProfile?.is_owner ??
      snapshotProfile?.isOwner ??
      snapshotUser?.profile?.isOwner ??
      snapshotUser?.isOwner ??
      role === 'OWNER'
  );
  const adminClaim =
    snapshotProfile?.is_admin ??
    snapshotProfile?.isAdmin ??
    snapshotUser?.profile?.isAdmin ??
    snapshotUser?.isAdmin ??
    null;
  const isAdmin = Boolean(
    adminClaim ?? (isOwner || role === 'ADMIN')
  );

  return {
    ...snapshotUser,
    name: snapshotProfile?.name || snapshotUser.displayName || snapshotUser.name || '',
    role,
    permissions: snapshotProfile?.permissions || snapshotUser?.permissions || snapshotUser?.profile?.permissions || [],
    isAdmin,
    is_admin: isAdmin,
    isOwner,
    is_owner: isOwner
  };
}

function mapProfile(profileData, pointsData, referralData, userData) {
  if (!profileData && !pointsData && !referralData && !userData) {
    return null;
  }

  return {
    id: profileData?.id || userData?.id || null,
    user_id: profileData?.userId || profileData?.user_id || userData?.id || null,
    email: userData?.email || '',
    name: profileData?.name || userData?.displayName || userData?.name || '',
    wallet: userData?.wallet || null,
    points: Number(pointsData?.points ?? profileData?.points ?? 0),
    referral_code: referralData?.referral_code || profileData?.referralCode || profileData?.referral_code || '',
    referral_count: Number(
      referralData?.referral_count ??
        profileData?.referralCount ??
        profileData?.referral_count ??
        0
    ),
    role: String(profileData?.role || userData?.role || userData?.profile?.role || 'USER').toUpperCase(),
    permissions: profileData?.permissions || userData?.permissions || userData?.profile?.permissions || [],
    is_admin: Boolean(profileData?.isAdmin ?? profileData?.is_admin ?? userData?.isAdmin ?? userData?.is_admin ?? false),
    is_owner: Boolean(profileData?.isOwner ?? profileData?.is_owner ?? userData?.isOwner ?? userData?.is_owner ?? false),
    created_at: profileData?.createdAt || profileData?.created_at || userData?.createdAt || null
  };
}

function mapOrganizationContext(context) {
  if (!context?.organization) {
    return null;
  }

  return {
    mode: context.mode || 'individual',
    organization: context.organization,
    permissions: Array.isArray(context.permissions) ? context.permissions : [],
    tenantIsolation: context.tenantIsolation || null
  };
}

const ORGANIZATION_PREFERENCE_KEY = 'transferly.selected-organization-id';

function readSelectedOrganizationId() {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.localStorage.getItem(ORGANIZATION_PREFERENCE_KEY) || '';
}

function sortByOrderIndex(items = []) {
  return [...items].sort((left, right) => {
    const orderDelta = Number(left?.order_index ?? 0) - Number(right?.order_index ?? 0);
    if (orderDelta !== 0) {
      return orderDelta;
    }
    return String(left?.created_at ?? '').localeCompare(String(right?.created_at ?? ''));
  });
}

function upsertByKey(items = [], nextItem, key) {
  if (!nextItem) {
    return items;
  }

  const index = items.findIndex((entry) => entry?.[key] === nextItem?.[key]);
  if (index === -1) {
    return [nextItem, ...items];
  }

  return items.map((entry, entryIndex) => (entryIndex === index ? nextItem : entry));
}

function readProviderKey(provider) {
  if (!provider) {
    return '';
  }

  if (typeof provider === 'string') {
    return provider.toLowerCase();
  }

  return String(provider.key || provider.slug || provider.id || provider.provider || provider.name || '').toLowerCase();
}

function buildReceiptPayload(receiptData) {
  const serviceSlug = receiptData.serviceSlug || receiptData.service || '';

  if (receiptData.type === 'bank') {
    return {
      type: 'bank',
      serviceSlug,
      title: `Bank Transfer Slip - ${receiptData.senderName || 'Transferly'}`,
      summary: receiptData.narration || 'Bank transfer receipt',
      details: {
        senderName: receiptData.senderName || '',
        senderAccount: receiptData.senderAccount || '',
        senderBank: receiptData.senderBank || '',
        receiverName: receiptData.receiverName || '',
        receiverAccount: receiptData.receiverAccount || '',
        receiverBank: receiptData.receiverBank || '',
        amount: receiptData.amount || '',
        transactionDate: receiptData.transactionDate || '',
        transactionTime: receiptData.transactionTime || '',
        transactionRef: receiptData.transactionRef || '',
        narration: receiptData.narration || '',
        sessionId: receiptData.sessionId || '',
        status: receiptData.status || ''
      }
    };
  }

  return {
    type: 'email',
    serviceSlug,
    title: receiptData.subject || 'Email Receipt',
    summary: receiptData.body || 'Email receipt',
    emailTo: receiptData.toEmail || '',
    details: {
      fromName: receiptData.fromName || '',
      fromEmail: receiptData.fromEmail || '',
      toName: receiptData.toName || '',
      toEmail: receiptData.toEmail || '',
      subject: receiptData.subject || '',
      body: receiptData.body || '',
      date: receiptData.date || '',
      time: receiptData.time || '',
      provider: receiptData.provider || ''
    }
  };
}

export function AppContextProvider({ children }) {
  const telegram = useTelegramMiniApp();
  const authStateManager = getAuthStateManager();
  const [user, setUserState] = useState(null);
  const [profile, setProfileState] = useState(null);
  const [organizationContext, setOrganizationContextState] = useState(null);
  const [organizations, setOrganizationsState] = useState([]);
  const [organizationError, setOrganizationError] = useState(null);
  const [config, setConfigState] = useState(defaultConfig);
  const [receipts, setReceiptsState] = useState([]);
  const [faqs, setFaqsState] = useState([]);
  const [testimonials, setTestimonialsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramAuthState, setTelegramAuthState] = useState('idle');
  const [authState, setAuthState] = useState(() => authStateManager.getCurrentState() || { state: 'detecting-runtime' });
  const [allUsers, setAllUsers] = useState([]);
  const [invoices, setInvoicesState] = useState([]);
  const [invoiceReminderConfigurations, setInvoiceReminderConfigurationsState] = useState([]);
  const [invoiceTemplates, setInvoiceTemplatesState] = useState([]);
  const [paymentIssues, setPaymentIssuesState] = useState([]);
  const [payouts, setPayoutsState] = useState([]);
  const [invoicePagination, setInvoicePaginationState] = useState(null);
  const [payoutPagination, setPayoutPaginationState] = useState(null);
  const [financeSummary, setFinanceSummaryState] = useState(null);
  const [commandCenter, setCommandCenterState] = useState(null);
  const [initializationError, setInitializationError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [clientHealth, setClientHealth] = useState(null);
  const [bootstrapSource, setBootstrapSource] = useState('pending');
  const [lastInitializationIssue, setLastInitializationIssue] = useState(null);
  const [topUpOrders, setTopUpOrdersState] = useState([]);
  const [adminTopUpOrders, setAdminTopUpOrdersState] = useState([]);
  const [pointsFundingConfig, setPointsFundingConfigState] = useState({ packages: [], payment_destination: null, evidence_policy: null });
  const [pointsFundingRequests, setPointsFundingRequestsState] = useState([]);
  const [notifications, setNotificationsState] = useState([]);
  const [transactionActivity, setTransactionActivityState] = useState([]);
  const [paymentProviders, setPaymentProvidersState] = useState([]);
  const [providerCapabilities, setProviderCapabilitiesState] = useState([]);
  const [providerCapabilitiesLoaded, setProviderCapabilitiesLoaded] = useState(false);
  const [providerHealth, setProviderHealthState] = useState([]);
  const [providerBalances, setProviderBalancesState] = useState({});
  const [webhookEvents, setWebhookEventsState] = useState([]);
  const [deadLetterJobs, setDeadLetterJobsState] = useState([]);
  const telegramInitData = telegram.initData || getRawTelegramInitData();
  const telegramStartParam = telegram.startParam || getTelegramStartParam();
  const telegramLaunchDetected = Boolean(telegram.available || telegramInitData);

  const applyBootstrap = useCallback((payload) => {
    if (!payload) {
      return;
    }

    if (payload.platform) {
      setConfigState((previous) => ({
        ...previous,
        ...payload.platform,
        ...(payload.economy ? {
          default_service_point_charge: payload.economy.default_service_point_charge,
          points_value_note: payload.economy.value_note
        } : {})
      }));
    }

    setFaqsState(sortByOrderIndex(payload.faqs || []));
    setTestimonialsState(sortByOrderIndex(payload.testimonials || []));
  }, []);

  const readCollectionSnapshot = useCallback((collection) => {
    if (Array.isArray(collection)) {
      return { data: collection, pagination: null };
    }

    if (Array.isArray(collection?.data)) {
      return {
        data: collection.data,
        pagination: collection.pagination || null
      };
    }

    return { data: [], pagination: null };
  }, []);

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot) {
      setUserState(null);
      setProfileState(null);
      setReceiptsState([]);
      setInvoicesState([]);
      setInvoiceReminderConfigurationsState([]);
      setInvoiceTemplatesState([]);
      setPaymentIssuesState([]);
      setPayoutsState([]);
      setInvoicePaginationState(null);
      setPayoutPaginationState(null);
      setFinanceSummaryState(null);
      setCommandCenterState(null);
        setOrganizationContextState(null);
      setOrganizationsState([]);
      setOrganizationError(null);
      setInitializationError(null);
      setLastSyncedAt(null);
      setTopUpOrdersState([]);
      setAdminTopUpOrdersState([]);
      setPointsFundingConfigState({ packages: [], payment_destination: null, evidence_policy: null });
      setPointsFundingRequestsState([]);
      setPaymentProvidersState([]);
      setProviderHealthState([]);
      setProviderBalancesState({});
      setWebhookEventsState([]);
      setDeadLetterJobsState([]);
      return null;
    }

    const nextUser = mapUser(snapshot.user, snapshot.profile);
    const nextProfile = mapProfile(snapshot.profile, snapshot.points, snapshot.referrals, snapshot.user);
    const nextReceipts = (snapshot.receipts || []).map(normalizeReceipt);
    const nextTopUpOrders = Array.isArray(snapshot.topUpOrders)
      ? snapshot.topUpOrders.map(normalizeTopUpOrder)
      : loadTopUpOrders(nextUser?.id).map(normalizeTopUpOrder);
    const nextFundingRequests = Array.isArray(snapshot.pointsFundingRequests)
      ? snapshot.pointsFundingRequests.map(normalizeFundingRequest)
      : [];
    const nextInvoices = readCollectionSnapshot(snapshot.invoices);
    const nextPayouts = readCollectionSnapshot(snapshot.payouts);

    setUserState(nextUser);
    setProfileState(nextProfile);
    setReceiptsState(nextReceipts);
    setInvoicesState(nextInvoices.data);
    setInvoicePaginationState(nextInvoices.pagination);
    setPayoutsState(nextPayouts.data);
    setPayoutPaginationState(nextPayouts.pagination);
    setFinanceSummaryState(snapshot.financeSummary || null);
    setCommandCenterState(snapshot.commandCenter || null);
    setOrganizationContextState(mapOrganizationContext(snapshot.organizationContext));
    setInitializationError(null);
    setLastSyncedAt(new Date().toISOString());
    setTopUpOrdersState(nextTopUpOrders);
    setPointsFundingRequestsState(nextFundingRequests);

    return {
      user: nextUser,
      profile: nextProfile,
      receipts: nextReceipts,
      invoices: nextInvoices.data,
      payouts: nextPayouts.data,
      financeSummary: snapshot.financeSummary || null,
      commandCenter: snapshot.commandCenter || null,
      topUpOrders: nextTopUpOrders
    };
  }, [readCollectionSnapshot]);

  const refreshOrganizations = useCallback(async () => {
    if (authState?.state !== AUTH_STATES.AUTHENTICATED) {
      setOrganizationsState([]);
      return [];
    }
    try {
      const payload = await listMyOrganizations();
      const nextOrganizations = Array.isArray(payload?.data) ? payload.data : [];
      setOrganizationsState(nextOrganizations);
      setOrganizationError(null);
      if (!organizationContext?.organization?.id && nextOrganizations[0]?.id) {
        const preferredId = readSelectedOrganizationId();
        const selectedOrganization = nextOrganizations.find((organization) => organization.id === preferredId)
          || nextOrganizations[0];
        const contextPayload = await getMyOrganizationContext(selectedOrganization.id);
        setOrganizationContextState(mapOrganizationContext(contextPayload?.data));
      }
      return nextOrganizations;
    } catch (error) {
      setOrganizationError(error?.message || 'Unable to load organizations.');
      return [];
    }
  }, [authState?.state, organizationContext?.organization?.id]);

  const switchOrganization = useCallback(async (organizationId) => {
    const payload = await getMyOrganizationContext(organizationId);
    const nextContext = mapOrganizationContext(payload?.data);
    setOrganizationContextState(nextContext);
    if (typeof window !== 'undefined' && nextContext?.organization?.id) {
      window.localStorage.setItem(ORGANIZATION_PREFERENCE_KEY, nextContext.organization.id);
    }
    return nextContext;
  }, []);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  const fetchConfig = useCallback(async () => {
    const payload = await getBootstrap();
    applyBootstrap(payload);
    return payload.platform || null;
  }, [applyBootstrap]);

  const fetchFaqs = useCallback(async () => {
    const payload = await getBootstrap();
    applyBootstrap(payload);
    return payload.faqs || [];
  }, [applyBootstrap]);

  const fetchTestimonials = useCallback(async () => {
    const payload = await getBootstrap();
    applyBootstrap(payload);
    return payload.testimonials || [];
  }, [applyBootstrap]);

  const fetchCommandCenter = useCallback(async () => {
    // Gate behind authentication
    if (authState?.state !== AUTH_STATES.AUTHENTICATED) {
      return null;
    }
    try {
      const payload = await getMiniAppCommandCenter();
      const nextCommandCenter = payload?.commandCenter || null;
      setCommandCenterState(nextCommandCenter);
      setLastSyncedAt(new Date().toISOString());
      return nextCommandCenter;
    } catch (error) {
      console.error('Failed to fetch mini app command center', error);
      return null;
    }
  }, [authState?.state]);

  const fetchReceipts = useCallback(async () => {
    const snapshot = await getMe();
    const applied = applySnapshot(snapshot);
    return applied?.receipts || [];
  }, [applySnapshot]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const payload = await getAdminUsers();
      const users = Array.isArray(payload?.data) ? payload.data : [];
      setAllUsers(users);
      return users;
    } catch (error) {
      console.error('Failed to fetch admin users', error);
      setAllUsers([]);
      return [];
    }
  }, []);

  const fetchInvoices = useCallback(async (filters = {}) => {
    try {
      const payload = profile?.is_admin
        ? await listAdminInvoicesRequest(filters)
        : await listInvoicesRequest(filters);
      const nextInvoices = Array.isArray(payload?.data) ? payload.data : [];
      setInvoicesState(nextInvoices);
      setInvoicePaginationState(payload?.pagination || null);
      return nextInvoices;
    } catch (error) {
      console.error('Failed to fetch invoices', error);
      setInvoicesState([]);
      setInvoicePaginationState(null);
      return [];
    }
  }, [profile?.is_admin]);

  const fetchInvoiceTemplates = useCallback(async () => {
    try {
      const payload = await listAdminInvoiceTemplatesRequest();
      const templates = Array.isArray(payload?.data) ? payload.data : [];
      setInvoiceTemplatesState(templates);
      return templates;
    } catch (error) {
      console.error('Failed to fetch invoice templates', error);
      setInvoiceTemplatesState([]);
      return [];
    }
  }, []);

  const fetchInvoiceReminderConfigurations = useCallback(async (type) => {
    try {
      const payload = await listInvoiceReminderConfigurationsRequest(type);
      const configurations = Array.isArray(payload?.data) ? payload.data : [];
      setInvoiceReminderConfigurationsState(configurations);
      return configurations;
    } catch (error) {
      console.error('Failed to fetch invoice reminder configurations', error);
      setInvoiceReminderConfigurationsState([]);
      return [];
    }
  }, []);

  const fetchPaymentProviders = useCallback(async () => {
    // Gate behind authentication
    if (authState?.state !== AUTH_STATES.AUTHENTICATED) {
      return [];
    }
    try {
      const payload = await listPaymentProvidersRequest();
      const providers = Array.isArray(payload?.data) ? payload.data : [];
      setPaymentProvidersState(providers);
      return providers;
    } catch (error) {
      console.error('Failed to fetch payment providers', error);
      setPaymentProvidersState([]);
      return [];
    }
  }, [authState?.state]);

  const fetchProviderCapabilities = useCallback(async () => {
    if (authState?.state !== AUTH_STATES.AUTHENTICATED) {
      setProviderCapabilitiesState([]);
      setProviderCapabilitiesLoaded(false);
      return [];
    }

    try {
      const payload = await listProviderCapabilitiesRequest();
      const providers = Array.isArray(payload?.data) ? payload.data : [];
      setProviderCapabilitiesState(providers);
      setProviderCapabilitiesLoaded(true);
      return providers;
    } catch (error) {
      // Keep the static provider registry available when the capability API is
      // temporarily unreachable; only a successful response may hide a route.
      void error;
      setProviderCapabilitiesState([]);
      setProviderCapabilitiesLoaded(false);
      return [];
    }
  }, [authState?.state]);

  useEffect(() => {
    void fetchProviderCapabilities();
  }, [fetchProviderCapabilities]);

  const fetchProviderHealth = useCallback(async () => {
    // Gate behind authentication
    if (authState?.state !== AUTH_STATES.AUTHENTICATED) {
      return [];
    }
    try {
      const payload = await listPaymentProviderHealthRequest();
      const report = Array.isArray(payload?.data) ? payload.data : [];
      setProviderHealthState(report);
      return report;
    } catch (error) {
      console.error('Failed to fetch payment provider health', error);
      setProviderHealthState([]);
      return [];
    }
  }, [authState?.state]);

  const fetchProviderBalances = useCallback(async (providers = []) => {
    const providerKeys = [...new Set(providers.map(readProviderKey).filter(Boolean))];

    if (!providerKeys.length) {
      setProviderBalancesState({});
      return {};
    }

    const results = await Promise.allSettled(
      providerKeys.map(async (provider) => ({
        provider,
        payload: await getPaymentProviderBalanceRequest(provider)
      }))
    );

    const balances = {};
    results.forEach((result) => {
      if (result.status !== 'fulfilled') {
        return;
      }

      balances[result.value.provider] = result.value.payload?.balance || result.value.payload || null;
    });

    setProviderBalancesState(balances);
    return balances;
  }, []);

  const fetchWebhookEvents = useCallback(async (filters = {}) => {
    try {
      const payload = await listAdminWebhookEventsRequest(filters);
      const events = Array.isArray(payload?.data) ? payload.data : [];
      setWebhookEventsState(events);
      return events;
    } catch (error) {
      console.error('Failed to fetch webhook events', error);
      setWebhookEventsState([]);
      return [];
    }
  }, []);

  const fetchDeadLetterJobs = useCallback(async (filters = {}) => {
    try {
      const payload = await listDeadLetterJobsRequest(filters);
      const jobs = Array.isArray(payload?.data) ? payload.data : [];
      setDeadLetterJobsState(jobs);
      return jobs;
    } catch (error) {
      console.error('Failed to fetch dead-letter jobs', error);
      setDeadLetterJobsState([]);
      return [];
    }
  }, []);

  const recoverDeadLetterJob = useCallback(async (jobId, note) => {
    try {
      const payload = await recoverDeadLetterJobRequest(jobId, note);
      const recoveredJob = payload?.dead_letter || null;
      const recovery = payload?.recovery || recoveredJob?.recovery || null;

      setDeadLetterJobsState((previous) =>
        previous.map((job) => {
          const currentId = String(job?.job_id || job?.jobId || job?.id || '');
          if (currentId !== String(jobId)) {
            return job;
          }

          return {
            ...job,
            ...recoveredJob,
            recovery,
            recovered_at: recovery?.recovered_at || job.recovered_at
          };
        })
      );

      return { success: true, deadLetter: recoveredJob, recovery };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchWebhookEvent = useCallback(async (webhookEventId) => {
    try {
      const payload = await getAdminWebhookEventRequest(webhookEventId);
      const event = payload?.event || null;
      setWebhookEventsState((previous) => upsertByKey(previous, event, 'webhook_event_id'));
      return { success: true, event };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const replayWebhookEvent = useCallback(async (webhookEventId, note) => {
    try {
      const payload = await replayAdminWebhookEventRequest(webhookEventId, note);
      const event = payload?.event || null;
      setWebhookEventsState((previous) => upsertByKey(previous, event, 'webhook_event_id'));
      return { success: true, event };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const ignoreWebhookEvent = useCallback(async (webhookEventId, note) => {
    try {
      const payload = await ignoreAdminWebhookEventRequest(webhookEventId, note);
      const event = payload?.event || null;
      setWebhookEventsState((previous) => upsertByKey(previous, event, 'webhook_event_id'));
      return { success: true, event };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchPaymentIssues = useCallback(async (filters = {}) => {
    try {
      const payload = await listPaymentOpsIssuesRequest(filters);
      const issues = Array.isArray(payload?.data) ? payload.data : [];
      setPaymentIssuesState(issues);
      return issues;
    } catch (error) {
      console.error('Failed to fetch payment issues', error);
      setPaymentIssuesState([]);
      return [];
    }
  }, []);

  const acknowledgePaymentIssue = useCallback(async (issueId, note) => {
    try {
      const payload = await acknowledgePaymentOpsIssueRequest(issueId, note);
      const issue = payload?.issue || null;
      setPaymentIssuesState((previous) => upsertByKey(previous, issue, 'payment_issue_id'));
      return { success: true, issue };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const resolvePaymentIssue = useCallback(async (issueId, note) => {
    try {
      const payload = await resolvePaymentOpsIssueRequest(issueId, note);
      const issue = payload?.issue || null;
      setPaymentIssuesState((previous) => upsertByKey(previous, issue, 'payment_issue_id'));
      return { success: true, issue };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const reopenPaymentIssue = useCallback(async (issueId, note) => {
    try {
      const payload = await reopenPaymentOpsIssueRequest(issueId, note);
      const issue = payload?.issue || null;
      setPaymentIssuesState((previous) => upsertByKey(previous, issue, 'payment_issue_id'));
      return { success: true, issue };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchPayouts = useCallback(async (filters = {}) => {
    try {
      const payload = profile?.is_admin
        ? await listAdminPayoutsRequest(filters)
        : await listPayoutsRequest(filters);
      const nextPayouts = Array.isArray(payload?.data) ? payload.data : [];
      setPayoutsState(nextPayouts);
      setPayoutPaginationState(payload?.pagination || null);
      return nextPayouts;
    } catch (error) {
      console.error('Failed to fetch payouts', error);
      setPayoutsState([]);
      setPayoutPaginationState(null);
      return [];
    }
  }, [profile?.is_admin]);

  const fetchTopUpOrders = useCallback(async () => {
    try {
      const payload = await listTopUpOrdersRequest();
      const orders = Array.isArray(payload?.data) ? payload.data.map(normalizeTopUpOrder) : [];
      setTopUpOrdersState(orders);
      if (user?.id) {
        saveTopUpOrders(user.id, orders);
      }
      return orders;
    } catch (error) {
      console.error('Failed to fetch top-up orders', error);
      return [];
    }
  }, [user?.id]);

  const fetchAdminTopUpOrders = useCallback(async (filters = {}) => {
    try {
      const payload = await listAdminTopUpOrdersRequest(filters);
      const orders = Array.isArray(payload?.data) ? payload.data.map(normalizeTopUpOrder) : [];
      setAdminTopUpOrdersState(orders);
      return orders;
    } catch (error) {
      console.error('Failed to fetch admin top-up orders', error);
      setAdminTopUpOrdersState([]);
      return [];
    }
  }, []);

  const fetchPointsFundingConfig = useCallback(async () => {
    try {
      const payload = await getPointsFundingConfigRequest();
      const nextConfig = {
        packages: Array.isArray(payload?.packages) ? payload.packages : [],
        payment_destination: payload?.payment_destination || null,
        evidence_policy: payload?.evidence_policy || null
      };
      setPointsFundingConfigState(nextConfig);
      return nextConfig;
    } catch (error) {
      console.warn('Points funding config is temporarily unavailable', error);
      return { packages: [], payment_destination: null, evidence_policy: null };
    }
  }, []);

  const fetchPointsFundingRequests = useCallback(async () => {
    try {
      const payload = await listPointsFundingRequestsRequest();
      const requests = Array.isArray(payload?.data) ? payload.data.map(normalizeFundingRequest) : [];
      setPointsFundingRequestsState(requests);
      return requests;
    } catch (error) {
      console.warn('Points funding requests are temporarily unavailable', error);
      return [];
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const payload = await listNotificationsRequest({ limit: 50 });
      const records = Array.isArray(payload?.data) ? payload.data : [];
      setNotificationsState(records);
      return { success: true, records };
    } catch (error) {
      console.warn('Notifications are temporarily unavailable', error);
      return {
        success: false,
        records: [],
        message: error?.message || 'Notifications are temporarily unavailable.'
      };
    }
  }, []);

  const fetchTransactionActivity = useCallback(async (params = {}) => {
    try {
      const payload = await listTransactionActivityRequest({ limit: 100, ...params });
      const records = Array.isArray(payload?.data) ? payload.data : [];
      setTransactionActivityState(records);
      return { success: true, records };
    } catch (error) {
      console.warn('Transaction activity is temporarily unavailable', error);
      return {
        success: false,
        records: [],
        message: error?.message || 'Transaction activity is temporarily unavailable.'
      };
    }
  }, []);

  const markNotificationRead = useCallback(async (notificationId) => {
    try {
      const payload = await markNotificationReadRequest(notificationId);
      setNotificationsState((previous) => previous.map((notification) => (
        notification.id === notificationId ? payload.notification : notification
      )));
      return { success: true, notification: payload.notification };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const authenticateTelegramMiniApp = useCallback(async () => {
    if (!telegramInitData) {
      authStateManager.recordError({
        code: 'AUTH_INIT_DATA_MISSING',
        message: 'Telegram initData not available'
      });
      setTelegramAuthState(telegramLaunchDetected ? 'pending' : 'unavailable');
      return false;
    }

    try {
      // Use authStateManager to execute authentication (prevents parallel requests + retry logic)
      const result = await authStateManager.executeAuthentication(async () => {
        return loginWithTelegramMiniAppRequest({
          initData: telegramInitData,
          startParam: telegramStartParam
        });
      });

      if (!result?.token) {
        authStateManager.recordError({
          code: 'SESSION_TOKEN_MISSING',
          message: 'Transferly did not return a session token'
        });
        setTelegramAuthState('failed');
        return false;
      }

      setStoredToken(result.token);
      const snapshot = await getMe();
      const applied = applySnapshot(snapshot);
      authStateManager.setAuthenticated(applied?.user || null);
      setTelegramAuthState('authenticated');
      return true;
    } catch (error) {
      // Classify the error
      if (error.code === 'AUTH_SIGNATURE_INVALID') {
        authStateManager.recordError({
          code: 'AUTH_SIGNATURE_INVALID',
          message: error.message
        });
      } else if (error.code === 'AUTH_DATA_EXPIRED') {
        authStateManager.recordError({
          code: 'AUTH_DATA_EXPIRED',
          message: error.message
        });
      } else if (error.status === 401 || error.status === 403) {
        authStateManager.recordError({
          code: 'AUTH_SIGNATURE_INVALID',
          message: 'Invalid authentication credentials'
        });
      } else {
        authStateManager.recordError({
          code: 'API_UNREACHABLE',
          message: error.message
        });
      }
      setTelegramAuthState('failed');
      return false;
    }
  }, [applySnapshot, telegramInitData, telegramLaunchDetected, telegramStartParam, authStateManager]);

  const refreshClientHealth = useCallback(async () => {
    try {
      const payload = await getClientHealth({ retries: 1 });
      setClientHealth(payload);
      return payload;
    } catch (error) {
      const issue = buildInitializationIssue(error);
      setLastInitializationIssue(issue);
      logInitializationIssue('Transferly client health check unavailable.', error);
      return null;
    }
  }, []);

  const initializeApp = useCallback(async ({ isActive = () => true } = {}) => {
    setLoading(true);
    setInitializationError(null);
    setBootstrapSource('pending');
    setLastInitializationIssue(null);
    void refreshClientHealth();

    try {
      let bootstrapPayload = null;

      try {
        bootstrapPayload = await getBootstrap({ retries: 2 });
        if (!isActive()) {
          return;
        }
        applyBootstrap(bootstrapPayload);
        writeCachedBootstrap(bootstrapPayload);
        setBootstrapSource('network');
      } catch (error) {
        const issue = buildInitializationIssue(error);
        const cachedBootstrap = readCachedBootstrap();
        if (!issue.recoverable) {
          throw error;
        }

        logInitializationIssue(
          cachedBootstrap
            ? 'Transferly bootstrap unavailable; using cached public workspace data.'
            : 'Transferly bootstrap unavailable; using built-in public workspace defaults.',
          error
        );
        if (!isActive()) {
          return;
        }
        if (cachedBootstrap) {
          applyBootstrap(cachedBootstrap);
          setBootstrapSource('cache');
        } else {
          setBootstrapSource('fallback');
        }
        setLastInitializationIssue(issue);
      }

      const token = getStoredToken() || getStoredAdminToken();
      if (!token) {
        try {
          await authenticateTelegramMiniApp();
        } catch (error) {
          const issue = buildInitializationIssue(error);
          if (!issue.recoverable) {
            throw error;
          }
          logInitializationIssue(
            'Transferly Telegram session exchange unavailable; keeping workspace shell available.',
            error
          );
          if (isActive()) {
            setLastInitializationIssue(issue);
          }
        }
        return;
      }

      try {
        const snapshot = await getMe();
        if (isActive()) {
          const applied = applySnapshot(snapshot);
          authStateManager.setAuthenticated(applied?.user || null);
          setTelegramAuthState('authenticated');
        }
      } catch (error) {
        // Only clear token on AUTH failures, NOT on provider/connection failures
        if (error.status === 401 || error.status === 403 || error.code === 'SESSION_EXPIRED') {
          clearStoredToken();
          authStateManager.recordError({
            code: 'SESSION_EXPIRED',
            message: 'Session has expired, attempting to reauthenticate'
          });
          try {
            await authenticateTelegramMiniApp();
          } catch (authError) {
            const issue = buildInitializationIssue(authError);
            if (!issue.recoverable) {
              throw authError;
            }
            logInitializationIssue(
              'Transferly Telegram session refresh unavailable; keeping workspace shell available.',
              authError
            );
            if (isActive()) {
              setLastInitializationIssue(issue);
            }
          }
        } else if (isRecoverableConnectionError(error)) {
          // Connection errors do NOT clear token - preserve session for retry
          setLastInitializationIssue(buildInitializationIssue(error));
          logInitializationIssue('Transferly account snapshot unavailable; continuing with public workspace shell.', error);
        } else {
          throw error;
        }
      }
    } catch (error) {
      const issue = buildInitializationIssue(error);
      logInitializationIssue('Failed to initialize Transferly Mini App context.', error);
      if (isActive()) {
        setLastInitializationIssue(issue);
        setInitializationError({
          code: issue.code,
          requestId: issue.requestId,
          status: issue.status,
          message: issue.message,
          recoverable: issue.recoverable
        });
      }
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, [applyBootstrap, applySnapshot, authenticateTelegramMiniApp, refreshClientHealth, authStateManager]);

  useEffect(() => {
    let active = true;
    initializeApp({ isActive: () => active });

    return () => {
      active = false;
    };
  }, [initializeApp]);

  // Subscribe to authStateManager changes
  useEffect(() => {
    let mounted = true;  // Track component mount status to prevent stale updates

    const unsubscribe = authStateManager.subscribe((nextAuthState) => {
      // Guard against state updates after unmount
      if (mounted && nextAuthState) {
        setAuthState(nextAuthState);
      }
    });

    // Notify authStateManager that Telegram runtime is available
    authStateManager.setTelegramDetected(Boolean(telegram.available), telegramInitData || null);

    return () => {
      mounted = false;  // Mark as unmounted
      unsubscribe();    // Clean up subscription
    };
  }, [telegram.available, telegramInitData, authStateManager]);

  // When initData becomes available and we're waiting, resume authentication
  useEffect(() => {
    let mounted = true;  // Track component mount status

    if (!telegramInitData) {
      return;
    }

    if (authState?.state === AUTH_STATES.WAITING_FOR_INIT_DATA) {
      // Check mounted status before resuming auth
      if (mounted) {
        authenticateTelegramMiniApp().catch((error) => {
          // Handle any async errors that occur after unmount has been initiated
          if (mounted) {
            console.error('[AppContext] Auth resume error', error);
          }
        });
      }
    }

    return () => {
      mounted = false;
    };
  }, [telegramInitData, authState?.state, authenticateTelegramMiniApp]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void fetchPointsFundingConfig();
    void fetchPointsFundingRequests();
    void fetchNotifications();
    void fetchTransactionActivity();
  }, [fetchNotifications, fetchPointsFundingConfig, fetchPointsFundingRequests, fetchTransactionActivity, user?.id]);

  const retryInitialization = useCallback(() => {
    authStateManager.resetRetries();
    authStateManager.clearError();
    return initializeApp();
  }, [authStateManager, initializeApp]);

  const logout = useCallback(async () => {
    clearStoredToken();
    setUserState(null);
    setProfileState(null);
    setReceiptsState([]);
    setAllUsers([]);
    setInvoicesState([]);
    setInvoiceReminderConfigurationsState([]);
    setInvoiceTemplatesState([]);
    setPaymentIssuesState([]);
    setPayoutsState([]);
    setInvoicePaginationState(null);
    setPayoutPaginationState(null);
    setFinanceSummaryState(null);
    setCommandCenterState(null);
    setInitializationError(null);
    setLastSyncedAt(null);
    setBootstrapSource('pending');
    setClientHealth(null);
    setLastInitializationIssue(null);
    setTopUpOrdersState([]);
    setAdminTopUpOrdersState([]);
    setPointsFundingConfigState({ packages: [], payment_destination: null, evidence_policy: null });
    setPointsFundingRequestsState([]);
    setNotificationsState([]);
    setTransactionActivityState([]);
    setPaymentProvidersState([]);
    setProviderHealthState([]);
    setProviderBalancesState({});
    setWebhookEventsState([]);
    setDeadLetterJobsState([]);
  }, []);

  const addReceipt = useCallback(async (receiptData) => {
    if (!user?.id || !profile) {
      return { error: 'Authentication required' };
    }

    try {
      const result = await generateReceiptRequest(buildReceiptPayload(receiptData));
      const nextReceipt = normalizeReceipt(result.receipt);

      setReceiptsState((previous) => (nextReceipt ? [nextReceipt, ...previous] : previous));

      if (typeof result.summary?.remaining_points !== 'undefined') {
        setProfileState((previous) =>
          previous
            ? {
                ...previous,
                points: Number(result.summary.remaining_points)
              }
            : previous
        );
      }

      fetchCommandCenter();
      return nextReceipt || result;
    } catch (error) {
      return { error: error.message };
    }
  }, [fetchCommandCenter, profile, user]);

  const updateProfile = useCallback(async (updates) => {
    try {
      const result = await updateProfileRequest({ name: updates?.name || '' });
      const userRecord = result?.user || null;
      const nextUser = mapUser(userRecord, userRecord?.profile);
      const nextProfile = mapProfile(
        userRecord?.profile,
        { points: userRecord?.points },
        {
          referral_count: userRecord?.referral_count,
          referral_code: userRecord?.referral_code
        },
        userRecord
      );

      setUserState(nextUser);
      setProfileState(nextProfile);

      return {
        success: true,
        user: nextUser,
        profile: nextProfile
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);
  const updateConfig = useCallback(async (updates) => {
    try {
      const payload = await updatePlatformConfig(updates);
      const nextConfig = payload?.config || {};
      setConfigState((previous) => ({ ...previous, ...nextConfig }));
      return { success: true, config: nextConfig };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const addFaq = useCallback(async (input) => {
    try {
      const payload = await createFaqRequest(input);
      const faq = payload?.faq || null;
      setFaqsState((previous) => sortByOrderIndex(faq ? [...previous, faq] : previous));
      return { success: true, faq };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const updateFaq = useCallback(async (faqId, updates) => {
    try {
      const payload = await updateFaqRequest(faqId, updates);
      const faq = payload?.faq || null;
      setFaqsState((previous) =>
        sortByOrderIndex(previous.map((entry) => (entry.id === faq?.id ? faq : entry)))
      );
      return { success: true, faq };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const deleteFaq = useCallback(async (faqId) => {
    try {
      await deleteFaqRequest(faqId);
      setFaqsState((previous) => previous.filter((entry) => entry.id !== faqId));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const addTestimonial = useCallback(async (input) => {
    try {
      const payload = await createTestimonialRequest(input);
      const testimonial = payload?.testimonial || null;
      setTestimonialsState((previous) =>
        sortByOrderIndex(testimonial ? [...previous, testimonial] : previous)
      );
      return { success: true, testimonial };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const updateTestimonial = useCallback(async (testimonialId, updates) => {
    try {
      const payload = await updateTestimonialRequest(testimonialId, updates);
      const testimonial = payload?.testimonial || null;
      setTestimonialsState((previous) =>
        sortByOrderIndex(previous.map((entry) => (entry.id === testimonial?.id ? testimonial : entry)))
      );
      return { success: true, testimonial };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const deleteTestimonial = useCallback(async (testimonialId) => {
    try {
      await deleteTestimonialRequest(testimonialId);
      setTestimonialsState((previous) => previous.filter((entry) => entry.id !== testimonialId));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);
  const adjustUserPoints = useCallback(async (userId, delta, reason) => {
    try {
      const payload = await adjustUserPointsRequest(userId, delta, reason);
      const updatedUser = payload?.user || null;

      setAllUsers((previous) =>
        previous.map((entry) =>
          entry.user_id === updatedUser?.user_id || entry.id === updatedUser?.user_id ? updatedUser : entry
        )
      );

      if (updatedUser && (user?.id === updatedUser.user_id || user?.id === updatedUser.id)) {
        const mappedUser = mapUser(updatedUser, updatedUser.profile);
        const mappedProfile = mapProfile(
          updatedUser.profile,
          { points: updatedUser.points },
          {
            referral_count: updatedUser.referral_count,
            referral_code: updatedUser.referral_code
          },
          updatedUser
        );

        setUserState(mappedUser);
        setProfileState(mappedProfile);
      }

      return { success: true, user: updatedUser };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user]);
  const deleteAccount = useCallback(async () => {
    try {
      await deleteAccountRequest();
      clearStoredToken();
      setUserState(null);
      setProfileState(null);
      setReceiptsState([]);
      setAllUsers([]);
      setInvoicesState([]);
      setInvoiceReminderConfigurationsState([]);
      setInvoiceTemplatesState([]);
      setPaymentIssuesState([]);
      setPayoutsState([]);
      setInvoicePaginationState(null);
      setPayoutPaginationState(null);
      setFinanceSummaryState(null);
      setCommandCenterState(null);
      setInitializationError(null);
      setLastSyncedAt(null);
      setTopUpOrdersState([]);
      setAdminTopUpOrdersState([]);
      setPointsFundingConfigState({ packages: [], payment_destination: null, evidence_policy: null });
      setPointsFundingRequestsState([]);
      setPaymentProvidersState([]);
      setProviderHealthState([]);
      setProviderBalancesState({});
      setWebhookEventsState([]);
      setDeadLetterJobsState([]);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const createTopUpOrder = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const payload = await createTopUpOrderRequest({
        points: Number(input?.points || 0),
        amountLabel: input?.amountLabel,
        methodId: input?.methodId || '',
        methodTitle: input?.methodTitle || '',
        serviceIntent: input?.serviceIntent || '',
        instructions: input?.instructions || '',
        vendorUrl: input?.vendorUrl || '',
        notes: input?.notes || ''
      });
      const order = normalizeTopUpOrder(payload?.order);
      const nextOrders = order ? [order, ...topUpOrders.filter((entry) => entry.order_id !== order.order_id)] : topUpOrders;
      setTopUpOrdersState(nextOrders);
      saveTopUpOrders(user.id, nextOrders);
      fetchCommandCenter();
      return { success: true, order };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchCommandCenter, topUpOrders, user?.id]);

  const updateTopUpOrderStatus = useCallback(async (orderId, status) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const payload = await updateTopUpOrderStatusRequest(orderId, { status });
      const updatedOrder = normalizeTopUpOrder(payload?.order);
      const nextOrders = topUpOrders.map((order) =>
        order.order_id === orderId ? updatedOrder : order
      );
      setTopUpOrdersState(nextOrders);
      saveTopUpOrders(user.id, nextOrders);
      fetchCommandCenter();
      return { success: true, order: updatedOrder };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchCommandCenter, topUpOrders, user?.id]);

  const createPointsFundingRequest = useCallback(async (input = {}) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const payload = await createPointsFundingRequestRequest({
        packageId: input.packageId,
        userNote: input.userNote || ''
      });
      const fundingRequest = normalizeFundingRequest(payload?.funding_request);
      setPointsFundingRequestsState((previous) => upsertByKey(previous, fundingRequest, 'id'));
      if (payload?.payment_destination) {
        setPointsFundingConfigState((previous) => ({
          ...previous,
          payment_destination: payload.payment_destination
        }));
      }
      fetchCommandCenter();
      return { success: true, fundingRequest, paymentDestination: payload?.payment_destination || null };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchCommandCenter, user?.id]);

  const submitPointsFundingEvidence = useCallback(async (requestId, input = {}) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const payload = await submitPointsFundingEvidenceRequest(requestId, {
        evidence: input.evidence,
        userTransactionReference: input.userTransactionReference || '',
        userNote: input.userNote || ''
      });
      const fundingRequest = normalizeFundingRequest(payload?.funding_request);
      setPointsFundingRequestsState((previous) => upsertByKey(previous, fundingRequest, 'id'));
      fetchCommandCenter();
      return { success: true, fundingRequest };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchCommandCenter, user?.id]);

  const uploadPointsFundingEvidence = useCallback(async (requestId, input = {}) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const payload = await uploadPointsFundingEvidenceRequest(requestId, {
        fileName: input.fileName,
        mimeType: input.mimeType,
        contentBase64: input.contentBase64,
        userTransactionReference: input.userTransactionReference || '',
        userNote: input.userNote || ''
      });
      const fundingRequest = normalizeFundingRequest(payload?.funding_request);
      setPointsFundingRequestsState((previous) => upsertByKey(previous, fundingRequest, 'id'));
      fetchCommandCenter();
      return { success: true, fundingRequest };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchCommandCenter, user?.id]);

  const completeTopUpOrder = useCallback(async (orderId, notes) => {
    try {
      const payload = await completeAdminTopUpOrderRequest(orderId, notes);
      const order = normalizeTopUpOrder(payload?.order);
      setAdminTopUpOrdersState((previous) => upsertByKey(previous, order, 'order_id'));
      setTopUpOrdersState((previous) => upsertByKey(previous, order, 'order_id'));
      return { success: true, order };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const cancelTopUpOrder = useCallback(async (orderId, notes) => {
    try {
      const payload = await cancelAdminTopUpOrderRequest(orderId, notes);
      const order = normalizeTopUpOrder(payload?.order);
      setAdminTopUpOrdersState((previous) => upsertByKey(previous, order, 'order_id'));
      setTopUpOrdersState((previous) => upsertByKey(previous, order, 'order_id'));
      return { success: true, order };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchReferrals = useCallback(async () => {
    try {
      const stats = await getReferralStats();
      setProfileState((previous) =>
        previous
          ? {
              ...previous,
              referral_code: stats.referral_code || previous.referral_code,
              referral_count: Number(stats.referral_count ?? previous.referral_count ?? 0)
            }
          : previous
      );
      return stats.referred_users || [];
    } catch (error) {
      console.error('Failed to fetch referrals', error);
      return [];
    }
  }, []);

  const createInvoiceTemplate = useCallback(async (input) => {
    try {
      const payload = await createAdminInvoiceTemplateRequest(input);
      const template = payload?.template || null;
      setInvoiceTemplatesState((previous) => upsertByKey(previous, template, 'id'));
      return { success: true, template };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const createInvoice = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const invoice = await createInvoiceRequest({
        ...input,
        userId: input?.userId || user.id
      });
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user?.id]);

  const previewInvoice = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const preview = await previewInvoiceRequest({
        ...input,
        userId: input?.userId || user.id
      });
      return { success: true, preview };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user?.id]);

  const updateInvoiceTemplate = useCallback(async (templateId, updates) => {
    try {
      const payload = await updateAdminInvoiceTemplateRequest(templateId, updates);
      const template = payload?.template || null;
      setInvoiceTemplatesState((previous) => upsertByKey(previous, template, 'id'));
      return { success: true, template };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const deleteInvoiceTemplate = useCallback(async (templateId) => {
    try {
      await deleteAdminInvoiceTemplateRequest(templateId);
      setInvoiceTemplatesState((previous) => previous.filter((entry) => entry.id !== templateId));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const refreshInvoice = useCallback(async (invoiceId) => {
    try {
      const invoice = await refreshInvoiceRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const sendInvoiceReminder = useCallback(async (invoiceId) => {
    try {
      const invoice = await sendInvoiceReminderRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const cancelInvoiceAutoReminders = useCallback(async (invoiceId) => {
    try {
      const invoice = await cancelInvoiceAutoRemindersRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const generateInvoiceQr = useCallback(async (invoiceId) => {
    try {
      const invoice = await generateInvoiceQrRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const cancelInvoice = useCallback(async (invoiceId) => {
    try {
      const invoice = await cancelInvoiceRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const createPayout = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const payout = await createPayoutRequest({
        ...input,
        userId: input?.userId || user.id
      });
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user?.id]);

  const previewPayout = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const preview = await previewPayoutRequest({
        ...input,
        userId: input?.userId || user.id
      });
      return { success: true, preview };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user?.id]);

  const approvePayout = useCallback(async (payoutId) => {
    try {
      const payout = await approveAdminPayoutRequest(payoutId);
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const rejectPayout = useCallback(async (payoutId, reason) => {
    try {
      const payout = await rejectAdminPayoutRequest(payoutId, reason);
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const releaseInvoiceFunds = useCallback(async (invoiceId, payload = {}) => {
    try {
      const release = await releaseAdminInvoiceFundsRequest(invoiceId, payload);
      return { success: true, release };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const markInvoiceReviewRequired = useCallback(async (invoiceId, payload = {}) => {
    try {
      const invoice = await markAdminInvoiceReviewRequiredRequest(invoiceId, payload);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const addInvoiceNote = useCallback(async (invoiceId, note) => {
    try {
      const result = await addAdminInvoiceNoteRequest(invoiceId, note);
      return { success: true, note: result?.note || note };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const addPayoutNote = useCallback(async (payoutId, note) => {
    try {
      const result = await addAdminPayoutNoteRequest(payoutId, note);
      return { success: true, note: result?.note || note };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const cancelUnclaimedPayout = useCallback(async (payoutId) => {
    try {
      const payout = await cancelUnclaimedPayoutRequest(payoutId);
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const updateInvoiceReminderConfiguration = useCallback(async (configurationId, updates) => {
    try {
      const payload = await updateInvoiceReminderConfigurationRequest(configurationId, updates);
      const configuration = payload?.configuration || null;
      setInvoiceReminderConfigurationsState((previous) => upsertByKey(previous, configuration, 'id'));
      return { success: true, configuration };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const suspendInvoiceReminderConfiguration = useCallback(async (configurationId) => {
    try {
      const payload = await suspendInvoiceReminderConfigurationRequest(configurationId);
      const configuration = payload?.configuration || null;
      setInvoiceReminderConfigurationsState((previous) => upsertByKey(previous, configuration, 'id'));
      return { success: true, configuration };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const resumeInvoiceReminderConfiguration = useCallback(async (configurationId) => {
    try {
      const payload = await resumeInvoiceReminderConfigurationRequest(configurationId);
      const configuration = payload?.configuration || null;
      setInvoiceReminderConfigurationsState((previous) => upsertByKey(previous, configuration, 'id'));
      return { success: true, configuration };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchInvoiceTimeline = useCallback(async (invoiceId, limit = 25) => {
    try {
      const payload = await getInvoiceTimelineRequest(invoiceId, limit);
      return payload?.data || [];
    } catch (error) {
      console.error('Failed to fetch invoice timeline', error);
      return [];
    }
  }, []);

  const refreshPayout = useCallback(async (payoutId) => {
    try {
      const payout = await refreshPayoutRequest(payoutId);
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchPayoutTimeline = useCallback(async (payoutId, limit = 25) => {
    try {
      const payload = await getPayoutTimelineRequest(payoutId, limit);
      return payload?.data || [];
    } catch (error) {
      console.error('Failed to fetch payout timeline', error);
      return [];
    }
  }, []);

  const runPaymentReconciliation = useCallback(async (payload = {}) => {
    try {
      const result = await runPaymentReconciliationRequest(payload);
      return { success: true, result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const value = {
    user,
    profile,
    loading,
    telegramAuthState,
    authState,
    isAuthenticated: authState?.state === AUTH_STATES.AUTHENTICATED,
    logout,
    deleteAccount,
    config,
    updateConfig,
    fetchConfig,
    receipts,
    addReceipt,
    fetchReceipts,
    fetchCommandCenter,
    retryInitialization,
    updateProfile,
    allUsers,
    fetchAllUsers,
    adjustUserPoints,
    invoices,
    invoiceReminderConfigurations,
    invoiceTemplates,
    paymentIssues,
    payouts,
    invoicePagination,
    payoutPagination,
    financeSummary,
    commandCenter,
    organizationContext,
    organizations,
    organizationError,
    refreshOrganizations,
    switchOrganization,
    initializationError,
    lastSyncedAt,
    clientHealth,
    bootstrapSource,
    lastInitializationIssue,
    apiEnvironment: getApiEnvironmentStatus(),
    apiDiagnostics: getApiDiagnostics(),
    degradedMode: bootstrapSource === 'cache' || bootstrapSource === 'fallback',
    refreshClientHealth,
    topUpOrders,
    adminTopUpOrders,
    pointsFundingConfig,
    pointsFundingRequests,
    notifications,
    transactionActivity,
    paymentProviders,
    providerCapabilities,
    providerCapabilitiesLoaded,
    providerHealth,
    providerBalances,
    webhookEvents,
    deadLetterJobs,
    fetchInvoices,
    fetchInvoiceReminderConfigurations,
    fetchInvoiceTemplates,
    fetchPaymentProviders,
    fetchProviderCapabilities,
    fetchProviderHealth,
    fetchProviderBalances,
    fetchWebhookEvents,
    fetchDeadLetterJobs,
    fetchWebhookEvent,
    ignoreWebhookEvent,
    replayWebhookEvent,
    recoverDeadLetterJob,
    fetchPaymentIssues,
    acknowledgePaymentIssue,
    resolvePaymentIssue,
    reopenPaymentIssue,
    fetchPayouts,
    fetchTopUpOrders,
    fetchAdminTopUpOrders,
    fetchPointsFundingConfig,
    fetchPointsFundingRequests,
    fetchNotifications,
    fetchTransactionActivity,
    markNotificationRead,
    createInvoice,
    previewInvoice,
    createPayout,
    previewPayout,
    approvePayout,
    rejectPayout,
    releaseInvoiceFunds,
    markInvoiceReviewRequired,
    addInvoiceNote,
    addPayoutNote,
    createInvoiceTemplate,
    updateInvoiceTemplate,
    deleteInvoiceTemplate,
    refreshInvoice,
    sendInvoiceReminder,
    cancelInvoiceAutoReminders,
    generateInvoiceQr,
    cancelInvoice,
    cancelUnclaimedPayout,
    updateInvoiceReminderConfiguration,
    suspendInvoiceReminderConfiguration,
    resumeInvoiceReminderConfiguration,
    fetchInvoiceTimeline,
    refreshPayout,
    fetchPayoutTimeline,
    runPaymentReconciliation,
    createTopUpOrder,
    updateTopUpOrderStatus,
    createPointsFundingRequest,
    submitPointsFundingEvidence,
    uploadPointsFundingEvidence,
    completeTopUpOrder,
    cancelTopUpOrder,
    faqs,
    addFaq,
    updateFaq,
    deleteFaq,
    fetchFaqs,
    testimonials,
    addTestimonial,
    updateTestimonial,
    deleteTestimonial,
    fetchTestimonials,
    fetchReferrals,
    setConfig: updateConfig,
    setUser: setProfileState
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
}
