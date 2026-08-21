import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from './AppContext';
import { useTelegramMiniApp } from './TelegramMiniAppContext';

const MiniAppRuntimeContext = createContext(null);

function readOnlineState() {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return true;
  }

  return navigator.onLine;
}

function describeRuntimeStatus({
  online,
  loading,
  bootstrapSource,
  initializationError,
  telegramAuthState,
  telegramAvailable,
  hasUser
}) {
  if (!online) {
    return {
      status: 'offline',
      label: 'Connection unavailable',
      detail: 'Reconnect to the internet, then retry the Transferly workspace.'
    };
  }

  if (loading) {
    return {
      status: 'loading',
      label: 'Preparing Transferly',
      detail: telegramAvailable
        ? 'Securing the Telegram session and loading workspace data.'
        : 'Loading browser preview data and workspace state.'
    };
  }

  if (telegramAuthState === 'failed') {
    return {
      status: 'auth-failed',
      label: 'Telegram session needs a retry',
      detail: 'Transferly could not verify the Telegram launch session. Retry once Telegram is connected.'
    };
  }

  if (initializationError) {
    const needsDeploymentConfig = initializationError.code === 'API_BASE_URL_MISSING';

    return {
      status: 'error',
      label: needsDeploymentConfig ? 'Connection setup required' : 'Transferly is temporarily unavailable',
      detail: needsDeploymentConfig
        ? 'The Mini App deployment is missing its Transferly API URL.'
        : initializationError.message || 'Transferly could not finish loading the mini app session.'
    };
  }

  if (bootstrapSource === 'cache' || bootstrapSource === 'fallback') {
    const usingCache = bootstrapSource === 'cache';
    return {
      status: 'degraded',
      label: usingCache ? 'Workspace running from saved data' : 'Workspace running with defaults',
      detail: usingCache
        ? 'Transferly is showing saved workspace basics while it reconnects.'
        : 'Transferly is showing the workspace shell while it reconnects.'
    };
  }

  if (telegramAvailable && !hasUser && ['pending', 'unavailable'].includes(telegramAuthState)) {
    return {
      status: 'auth-pending',
      label: 'Telegram session pending',
      detail: 'Waiting for Telegram launch data before loading account data.'
    };
  }

  return {
    status: 'ready',
    label: telegramAvailable
      ? (hasUser ? 'Telegram session secured' : 'Telegram session detected')
      : 'Guest preview mode',
    detail: telegramAvailable
      ? 'Native Telegram controls and Transferly workspace data are ready.'
      : 'Telegram runtime is unavailable, so Transferly is shown in guest preview mode.'
  };
}

export function MiniAppRuntimeProvider({ children }) {
  const {
    apiDiagnostics,
    apiEnvironment,
    bootstrapSource,
    clientHealth,
    degradedMode,
    initializationError,
    lastSyncedAt,
    lastInitializationIssue,
    loading,
    refreshClientHealth,
    retryInitialization,
    telegramAuthState,
    user
  } = useAppContext();
  const telegram = useTelegramMiniApp();
  const { refresh: refreshTelegramRuntime } = telegram;
  const [online, setOnline] = useState(readOnlineState);
  const [retrying, setRetrying] = useState(false);
  const retryingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateOnlineState = () => setOnline(readOnlineState());
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  const retry = useCallback(async () => {
    if (retryingRef.current) {
      return null;
    }

    retryingRef.current = true;
    setRetrying(true);

    try {
      refreshTelegramRuntime?.();
      await refreshClientHealth?.();
      return await retryInitialization?.();
    } finally {
      retryingRef.current = false;
      setRetrying(false);
    }
  }, [refreshClientHealth, refreshTelegramRuntime, retryInitialization]);

  const value = useMemo(() => {
    const telegramAvailable = Boolean(telegram.available || telegram.initData);
    const status = describeRuntimeStatus({
      online,
      loading,
      bootstrapSource,
      initializationError,
      telegramAuthState,
      telegramAvailable,
      hasUser: Boolean(user?.id)
    });

    const requestId = initializationError?.requestId ||
      lastInitializationIssue?.requestId ||
      apiDiagnostics?.lastFailure?.requestId ||
      clientHealth?.requestId ||
      null;

    // Runtime status is derived from the existing app and Telegram contexts so
    // auth, native controls, and route data keep their original ownership.
    return {
      ...status,
      online,
      mode: telegramAvailable ? 'telegram' : 'browser-preview',
      isTelegram: telegramAvailable,
      isPreview: !telegramAvailable,
      authState: telegramAuthState,
      bootstrapSource,
      clientHealth,
      degradedMode,
      initializationError,
      lastSyncedAt,
      lastInitializationIssue,
      diagnostics: {
        api: apiEnvironment,
        apiRequests: apiDiagnostics,
        bootstrapSource,
        clientHealth,
        lastInitializationIssue,
        requestId,
        telegram: {
          available: Boolean(telegram.available),
          hasInitData: Boolean(telegram.initData),
          platform: telegram.platform || null,
          version: telegram.version || null
        },
        user: {
          authenticated: Boolean(user?.id)
        }
      },
      safeArea: telegram.safeArea,
      contentSafeArea: telegram.contentSafeArea,
      viewport: telegram.viewport,
      retrying,
      retry
    };
  }, [
    apiDiagnostics,
    apiEnvironment,
    bootstrapSource,
    clientHealth,
    degradedMode,
    initializationError,
    lastSyncedAt,
    lastInitializationIssue,
    loading,
    online,
    retry,
    retrying,
    telegramAuthState,
    telegram.available,
    telegram.contentSafeArea,
    telegram.initData,
    telegram.safeArea,
    telegram.viewport,
    user?.id
  ]);

  return (
    <MiniAppRuntimeContext.Provider value={value}>
      {children}
    </MiniAppRuntimeContext.Provider>
  );
}

export function useMiniAppRuntime() {
  const context = useContext(MiniAppRuntimeContext);
  if (!context) {
    throw new Error('useMiniAppRuntime must be used within MiniAppRuntimeProvider');
  }
  return context;
}
