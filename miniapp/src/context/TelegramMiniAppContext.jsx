import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyTelegramTheme,
  applyTelegramViewportVars,
  configureClosingConfirmation,
  configureTelegramBackButton,
  configureTelegramMainButton,
  configureTelegramSettingsButton,
  configureVerticalSwipe,
  exitTelegramFullscreen,
  getMiniAppViewportState,
  getRawTelegramInitData,
  getTelegramColorScheme,
  getTelegramSafeArea,
  getTelegramWebApp,
  initializeTelegramMiniApp,
  openTelegramLink,
  requestTelegramFullscreen,
  shareTelegramUrl,
  showTelegramAlert,
  showTelegramConfirm,
  showTelegramPopup,
  triggerTelegramImpact,
  triggerTelegramNotification
} from '../lib/telegramMiniApp';

const TelegramMiniAppContext = createContext(null);
const HAPTICS_STORAGE_KEY = 'transferly_miniapp_haptics_enabled';
const DEFAULT_NATIVE_CONTROLS = {
  backButton: { visible: false },
  mainButton: { visible: false },
  settingsButton: { visible: false },
  closingConfirmation: false,
  verticalSwipe: true
};
const DEFAULT_SAFE_AREA = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};
const DEFAULT_VIEWPORT = {
  mode: 'browser',
  width: 0,
  height: 0,
  stableHeight: 0,
  orientation: 'portrait',
  platform: 'unknown',
  version: '',
  safeArea: DEFAULT_SAFE_AREA,
  contentSafeArea: DEFAULT_SAFE_AREA,
  isExpanded: false,
  isFullscreen: false,
  supportsFullscreen: false
};

function readStoredBoolean(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const stored = window.localStorage.getItem(key);
  if (stored === null) {
    return fallback;
  }

  return stored === 'true';
}

function readBrowserViewport(previous = {}) {
  const width = typeof window === 'undefined' ? previous.width || 0 : window.innerWidth;
  const height = typeof window === 'undefined' ? previous.height || 0 : window.innerHeight;

  return {
    ...DEFAULT_VIEWPORT,
    ...previous,
    mode: 'browser',
    width,
    height,
    stableHeight: height,
    orientation: width > height ? 'landscape' : 'portrait',
    safeArea: DEFAULT_SAFE_AREA,
    contentSafeArea: DEFAULT_SAFE_AREA,
    isExpanded: false,
    isFullscreen: false,
    supportsFullscreen: false
  };
}

function readTelegramRuntimeState(previous = {}) {
  const initialized = initializeTelegramMiniApp();
  const webApp = initialized.webApp;

  if (webApp) {
    return {
      ...initialized,
      viewport: initialized.viewport || getMiniAppViewportState(webApp, previous.viewport)
    };
  }

  return {
    ...initialized,
    viewport: initialized.viewport || readBrowserViewport(previous.viewport)
  };
}

export function TelegramMiniAppProvider({ children }) {
  const [state, setState] = useState(() => ({
    webApp: null,
    available: false,
    theme: {},
    user: null,
    startParam: '',
    initData: '',
    platform: 'unknown',
    version: '',
    colorScheme: 'light',
    safeArea: DEFAULT_SAFE_AREA,
    contentSafeArea: DEFAULT_SAFE_AREA,
    hapticsEnabled: readStoredBoolean(HAPTICS_STORAGE_KEY, true),
    fullscreenError: '',
    viewport: readBrowserViewport()
  }));
  const [nativeControls, setNativeControlsState] = useState(DEFAULT_NATIVE_CONTROLS);

  const refresh = useCallback(() => {
    setState((previous) => ({
      ...previous,
      ...readTelegramRuntimeState(previous)
    }));
  }, []);

  useEffect(() => {
    const initialized = initializeTelegramMiniApp();
    setState((previous) => ({
      ...previous,
      ...initialized,
      fullscreenError: '',
      viewport: initialized.viewport || readBrowserViewport(previous.viewport)
    }));
  }, []);

  useEffect(() => {
    if (state.webApp || state.initData || typeof window === 'undefined') {
      return undefined;
    }

    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      const webApp = getTelegramWebApp();
      const initData = getRawTelegramInitData(webApp);

      if (webApp || initData || attempts >= 24) {
        refresh();
      }

      if (webApp || initData || attempts >= 24) {
        window.clearInterval(intervalId);
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [refresh, state.initData, state.webApp]);

  useEffect(() => {
    const webApp = state.webApp;

    if (!webApp) {
      return undefined;
    }

    const handleThemeChanged = () => {
      const theme = applyTelegramTheme(webApp.themeParams);
      setState((previous) => ({
        ...previous,
        theme,
        colorScheme: getTelegramColorScheme(webApp)
      }));
    };

    const syncViewport = (fullscreenError = '') => {
      const viewportState = applyTelegramViewportVars(webApp);
      setState((previous) => ({
        ...previous,
        safeArea: viewportState.safeArea,
        contentSafeArea: viewportState.contentSafeArea,
        fullscreenError,
        viewport: viewportState.viewport || getMiniAppViewportState(webApp, previous.viewport)
      }));
    };

    const handleViewportChanged = () => syncViewport('');
    const handleFullscreenChanged = () => syncViewport('');
    const handleSafeAreaChanged = () => syncViewport('');
    const handleFullscreenFailed = () => syncViewport('failed');

    webApp.onEvent?.('themeChanged', handleThemeChanged);
    webApp.onEvent?.('viewportChanged', handleViewportChanged);
    webApp.onEvent?.('fullscreenChanged', handleFullscreenChanged);
    webApp.onEvent?.('fullscreenFailed', handleFullscreenFailed);
    webApp.onEvent?.('safeAreaChanged', handleSafeAreaChanged);
    webApp.onEvent?.('contentSafeAreaChanged', handleSafeAreaChanged);

    return () => {
      webApp.offEvent?.('themeChanged', handleThemeChanged);
      webApp.offEvent?.('viewportChanged', handleViewportChanged);
      webApp.offEvent?.('fullscreenChanged', handleFullscreenChanged);
      webApp.offEvent?.('fullscreenFailed', handleFullscreenFailed);
      webApp.offEvent?.('safeAreaChanged', handleSafeAreaChanged);
      webApp.offEvent?.('contentSafeAreaChanged', handleSafeAreaChanged);
    };
  }, [state.webApp]);

  useEffect(() => {
    if (state.webApp || typeof window === 'undefined') {
      return undefined;
    }

    const handleBrowserResize = () => {
      if (getTelegramWebApp()) {
        refresh();
        return;
      }

      const viewportState = applyTelegramViewportVars(null);
      setState((previous) => ({
        ...previous,
        safeArea: viewportState.safeArea,
        contentSafeArea: viewportState.contentSafeArea,
        viewport: viewportState.viewport || readBrowserViewport(previous.viewport)
      }));
    };

    window.addEventListener('resize', handleBrowserResize);
    window.addEventListener('orientationchange', handleBrowserResize);
    handleBrowserResize();

    return () => {
      window.removeEventListener('resize', handleBrowserResize);
      window.removeEventListener('orientationchange', handleBrowserResize);
    };
  }, [state.webApp]);

  const setHapticsEnabled = useCallback((enabled) => {
    const nextValue = Boolean(enabled);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HAPTICS_STORAGE_KEY, String(nextValue));
    }

    setState((previous) => ({
      ...previous,
      hapticsEnabled: nextValue
    }));
  }, []);

  const setNativeControls = useCallback((controls = {}) => {
    setNativeControlsState((previous) => ({
      ...previous,
      ...controls
    }));
  }, []);

  const resetNativeControls = useCallback(() => {
    setNativeControlsState(DEFAULT_NATIVE_CONTROLS);
  }, []);

  const configureBackButton = useCallback((options = {}) => {
    setNativeControls({ backButton: options });
    return () => setNativeControls({ backButton: { visible: false } });
  }, [setNativeControls]);

  const configureMainButton = useCallback((options = {}) => {
    setNativeControls({ mainButton: options });
    return () => setNativeControls({ mainButton: { visible: false } });
  }, [setNativeControls]);

  const configureSettingsButton = useCallback((options = {}) => {
    setNativeControls({ settingsButton: options });
    return () => setNativeControls({ settingsButton: { visible: false } });
  }, [setNativeControls]);

  const configureClosing = useCallback((enabled) => {
    const nextEnabled = Boolean(enabled);
    setNativeControls({ closingConfirmation: nextEnabled });
    return () => setNativeControls({ closingConfirmation: false });
  }, [setNativeControls]);

  const configureSwipe = useCallback((enabled) => {
    const nextEnabled = Boolean(enabled);
    setNativeControls({ verticalSwipe: nextEnabled });
    return () => setNativeControls({ verticalSwipe: true });
  }, [setNativeControls]);

  useEffect(() => (
    configureTelegramBackButton(state.webApp, nativeControls.backButton)
  ), [nativeControls.backButton, state.webApp]);

  useEffect(() => (
    configureTelegramMainButton(state.webApp, nativeControls.mainButton)
  ), [nativeControls.mainButton, state.webApp]);

  useEffect(() => (
    configureTelegramSettingsButton(state.webApp, nativeControls.settingsButton)
  ), [nativeControls.settingsButton, state.webApp]);

  useEffect(() => {
    configureClosingConfirmation(state.webApp, nativeControls.closingConfirmation);
    return () => configureClosingConfirmation(state.webApp, false);
  }, [nativeControls.closingConfirmation, state.webApp]);

  useEffect(() => {
    configureVerticalSwipe(state.webApp, nativeControls.verticalSwipe);
    return () => configureVerticalSwipe(state.webApp, true);
  }, [nativeControls.verticalSwipe, state.webApp]);

  const impact = useCallback((style) => {
    if (state.hapticsEnabled) {
      triggerTelegramImpact(style);
    }
  }, [state.hapticsEnabled]);

  const notify = useCallback((type) => {
    if (state.hapticsEnabled) {
      triggerTelegramNotification(type);
    }
  }, [state.hapticsEnabled]);

  const showPopup = useCallback((options) => showTelegramPopup(options), []);
  const showAlert = useCallback((message) => showTelegramAlert(message), []);
  const showConfirm = useCallback((message) => showTelegramConfirm(message), []);
  const openLink = useCallback((url, options) => openTelegramLink(url, options), []);
  const shareUrl = useCallback((url, text) => shareTelegramUrl(url, text), []);

  const requestFullscreen = useCallback(() => {
    const result = requestTelegramFullscreen(state.webApp);
    setState((previous) => ({
      ...previous,
      fullscreenError: result.ok ? '' : result.reason,
      viewport: getMiniAppViewportState(state.webApp, previous.viewport)
    }));
    return result;
  }, [state.webApp]);

  const exitFullscreen = useCallback(() => {
    const result = exitTelegramFullscreen(state.webApp);
    setState((previous) => ({
      ...previous,
      fullscreenError: result.ok ? '' : result.reason,
      viewport: getMiniAppViewportState(state.webApp, previous.viewport)
    }));
    return result;
  }, [state.webApp]);

  const value = useMemo(() => ({
    ...state,
    displayMode: state.viewport?.mode || 'browser',
    nativeControls,
    refresh,
    setHapticsEnabled,
    setNativeControls,
    resetNativeControls,
    configureBackButton,
    configureClosingConfirmation: configureClosing,
    configureMainButton,
    configureSettingsButton,
    configureVerticalSwipe: configureSwipe,
    impact,
    notify,
    showPopup,
    showAlert,
    showConfirm,
    openLink,
    shareUrl,
    requestFullscreen,
    exitFullscreen,
    getSafeArea: () => getTelegramSafeArea(state.webApp)
  }), [
    configureBackButton,
    configureClosing,
    configureMainButton,
    configureSettingsButton,
    configureSwipe,
    exitFullscreen,
    impact,
    nativeControls,
    notify,
    openLink,
    requestFullscreen,
    refresh,
    resetNativeControls,
    setHapticsEnabled,
    setNativeControls,
    shareUrl,
    showAlert,
    showConfirm,
    showPopup,
    state
  ]);

  return (
    <TelegramMiniAppContext.Provider value={value}>
      {children}
    </TelegramMiniAppContext.Provider>
  );
}

export function useTelegramMiniApp() {
  const context = useContext(TelegramMiniAppContext);
  if (!context) {
    throw new Error('useTelegramMiniApp must be used inside TelegramMiniAppProvider');
  }

  return context;
}

export function useMiniAppViewport() {
  return useTelegramMiniApp().viewport;
}
