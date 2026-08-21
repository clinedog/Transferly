/**
 * Centralized authentication state machine for Mini App
 * Prevents race conditions and explicit tracking of Telegram initialization
 * 
 * States:
 * - 'detecting-runtime': Checking if Telegram WebApp is available
 * - 'waiting-for-init-data': Telegram detected, waiting for initData
 * - 'authenticating': Sending initData to backend
 * - 'authenticated': JWT obtained, user logged in
 * - 'refreshing-session': Attempting to refresh token
 * - 'guest-preview': No Telegram, browser preview mode
 * - 'offline': Network unavailable
 * - 'failed': Permanent authentication failure
 */

const AUTH_STATES = {
  DETECTING_RUNTIME: 'detecting-runtime',
  WAITING_FOR_INIT_DATA: 'waiting-for-init-data',
  AUTHENTICATING: 'authenticating',
  AUTHENTICATED: 'authenticated',
  REFRESHING_SESSION: 'refreshing-session',
  GUEST_PREVIEW: 'guest-preview',
  OFFLINE: 'offline',
  FAILED: 'failed'
};

const ERROR_CLASSIFICATIONS = {
  API_NOT_CONFIGURED: 'API_NOT_CONFIGURED',
  API_UNREACHABLE: 'API_UNREACHABLE',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  CORS_BLOCKED: 'CORS_BLOCKED',
  AUTH_INIT_DATA_MISSING: 'AUTH_INIT_DATA_MISSING',
  AUTH_SIGNATURE_INVALID: 'AUTH_SIGNATURE_INVALID',
  AUTH_DATA_EXPIRED: 'AUTH_DATA_EXPIRED',
  SESSION_TOKEN_MISSING: 'SESSION_TOKEN_MISSING',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  UNKNOWN: 'UNKNOWN'
};

const PERMANENT_ERROR_CODES = new Set([
  ERROR_CLASSIFICATIONS.AUTH_SIGNATURE_INVALID,
  ERROR_CLASSIFICATIONS.AUTH_DATA_EXPIRED,
  ERROR_CLASSIFICATIONS.SESSION_TOKEN_MISSING,
  'TELEGRAM_MINI_APP_AUTH_DISABLED'
]);

const OFFLINE_ERROR_CODES = new Set([
  ERROR_CLASSIFICATIONS.API_NOT_CONFIGURED,
  ERROR_CLASSIFICATIONS.API_UNREACHABLE,
  ERROR_CLASSIFICATIONS.REQUEST_TIMEOUT,
  ERROR_CLASSIFICATIONS.CORS_BLOCKED,
  ERROR_CLASSIFICATIONS.PROVIDER_UNAVAILABLE,
  ERROR_CLASSIFICATIONS.RATE_LIMITED,
  'NETWORK_ERROR',
  'SERVICE_UNAVAILABLE'
]);

class AuthStateManager {
  constructor() {
    this.state = AUTH_STATES.DETECTING_RUNTIME;
    this.user = null;
    this.error = null;
    this.lastError = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.inFlightPromise = null;
    this.listeners = [];
    this.requestId = null;
    this.telegramAvailable = false;
    this.telegramInitData = null;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (e) {
        console.error('[AuthStateManager] Listener error:', e);
      }
    });
  }

  getState() {
    return {
      state: this.state,
      user: this.user,
      error: this.error,
      lastError: this.lastError,
      retryCount: this.retryCount,
      telegramAvailable: this.telegramAvailable,
      telegramInitData: Boolean(this.telegramInitData),
      requestId: this.requestId,
      isAuthenticated: this.state === AUTH_STATES.AUTHENTICATED,
      isAuthenticating: this.state === AUTH_STATES.AUTHENTICATING,
      isGuestPreview: this.state === AUTH_STATES.GUEST_PREVIEW,
      canRetry: this.canRetry()
    };
  }

  getCurrentState() {
    return this.getState();
  }

  setTelegramDetected(available = this.telegramAvailable, initData = this.telegramInitData) {
    this.telegramAvailable = Boolean(available);
    this.telegramInitData = initData || null;

    if (
      this.state === AUTH_STATES.AUTHENTICATED ||
      this.state === AUTH_STATES.AUTHENTICATING ||
      this.state === AUTH_STATES.REFRESHING_SESSION
    ) {
      this.notify();
      return;
    }

    if (this.telegramAvailable && this.telegramInitData) {
      this.setState(AUTH_STATES.AUTHENTICATING);
    } else if (this.telegramAvailable && !this.telegramInitData) {
      this.setState(AUTH_STATES.WAITING_FOR_INIT_DATA);
    } else {
      this.setState(AUTH_STATES.GUEST_PREVIEW);
    }
  }

  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.notify();
    }
  }

  setError(error, classification) {
    const code = error?.code || classification || ERROR_CLASSIFICATIONS.UNKNOWN;
    this.lastError = this.error;
    this.error = {
      message: error?.message || 'Unknown error',
      code,
      status: error?.status || null,
      requestId: error?.requestId || this.requestId,
      classification: classification || code,
      at: new Date().toISOString()
    };
    this.notify();
  }

  recordError(error = {}, classification) {
    const code = error.code || classification || ERROR_CLASSIFICATIONS.UNKNOWN;

    this.setError({ ...error, code }, classification || code);

    if (code === ERROR_CLASSIFICATIONS.AUTH_INIT_DATA_MISSING) {
      this.setState(this.telegramAvailable ? AUTH_STATES.WAITING_FOR_INIT_DATA : AUTH_STATES.GUEST_PREVIEW);
      return;
    }

    if (code === ERROR_CLASSIFICATIONS.SESSION_EXPIRED) {
      this.setState(AUTH_STATES.REFRESHING_SESSION);
      return;
    }

    if (PERMANENT_ERROR_CODES.has(code)) {
      this.setState(AUTH_STATES.FAILED);
      return;
    }

    if (OFFLINE_ERROR_CODES.has(code) || error.status >= 500 || error.status === 429) {
      this.setState(AUTH_STATES.OFFLINE);
      return;
    }

    this.setState(AUTH_STATES.FAILED);
  }

  transitionTo(newState, metadata = {}) {
    if (newState === AUTH_STATES.AUTHENTICATED) {
      this.setAuthenticated(metadata.user || this.user || null);
      return;
    }

    this.setState(newState);
  }

  clearError() {
    if (this.error) {
      this.lastError = this.error;
    }
    this.error = null;
    this.notify();
  }

  setAuthenticated(user) {
    this.user = user;
    this.state = AUTH_STATES.AUTHENTICATED;
    this.error = null;
    this.retryCount = 0;
    this.notify();
  }

  canRetry() {
    // Don't retry if permanently failed
    if (this.state === AUTH_STATES.FAILED) {
      return false;
    }

    // Don't retry if already authenticated
    if (this.state === AUTH_STATES.AUTHENTICATED) {
      return false;
    }

    // Can retry if have attempts left
    return this.retryCount < this.maxRetries;
  }

  incrementRetry() {
    this.retryCount += 1;
    if (this.retryCount >= this.maxRetries) {
      this.setState(AUTH_STATES.FAILED);
    }
    this.notify();
  }

  resetRetries() {
    this.retryCount = 0;
    this.notify();
  }

  setRefreshing() {
    this.setState(AUTH_STATES.REFRESHING_SESSION);
  }

  setOffline() {
    this.setState(AUTH_STATES.OFFLINE);
  }

  // Ensure only one auth request in flight
  async executeAuthentication(fn) {
    if (this.inFlightPromise) {
      return this.inFlightPromise;
    }

    this.setState(AUTH_STATES.AUTHENTICATING);
    this.inFlightPromise = fn()
      .finally(() => {
        this.inFlightPromise = null;
      });

    return this.inFlightPromise;
  }

  reset() {
    this.state = AUTH_STATES.DETECTING_RUNTIME;
    this.user = null;
    this.error = null;
    this.lastError = null;
    this.retryCount = 0;
    this.inFlightPromise = null;
    this.requestId = null;
    this.telegramAvailable = false;
    this.telegramInitData = null;
    this.notify();
  }
}

// Singleton instance
let instance = null;

export function getAuthStateManager() {
  if (!instance) {
    instance = new AuthStateManager();
  }
  return instance;
}

export { AUTH_STATES, ERROR_CLASSIFICATIONS };
