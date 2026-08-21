/**
 * Central authentication error recovery panel
 * Deduplicates errors and provides one unified recovery UI
 * Prevents repeated error cards from appearing
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

export function AuthErrorRecoveryPanel({ authState, initializationIssue, onRetry, onDismiss }) {
  const [lastSeenErrorKey, setLastSeenErrorKey] = useState(null);
  const [retryInProgress, setRetryInProgress] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState(null);

  const error = authState?.error || initializationIssue || null;
  const hasError = Boolean(error);
  const errorKey = `${error?.code || error?.classification || 'UNKNOWN'}:${error?.requestId || ''}`;
  const errorChanged = hasError && errorKey !== lastSeenErrorKey;

  const isRecoverable = useMemo(() => {
    if (!error) return false;
    const code = error.code || error.classification;
    // These errors are not recoverable (permanent)
    const permanentErrors = new Set([
      'AUTH_SIGNATURE_INVALID',
      'TELEGRAM_MINI_APP_AUTH_DISABLED'
    ]);
    return !permanentErrors.has(code);
  }, [error]);

  const title = useMemo(() => {
    const code = error?.code || error?.classification;
    if (code === 'AUTH_INIT_DATA_MISSING' || code === 'SESSION_EXPIRED' || code === 'AUTH_DATA_EXPIRED') {
      return 'Telegram session needs a retry';
    }
    return 'Transferly connection needs a retry';
  }, [error]);

  const userFriendlyMessage = useMemo(() => {
    if (!error) return '';
    const code = error.code || error.classification;

    const messages = {
      API_NOT_CONFIGURED: 'API configuration is missing. Please check your deployment settings.',
      API_UNREACHABLE: 'Cannot reach the Transferly API. Please check your connection.',
      NETWORK_ERROR: 'Cannot reach the Transferly API. Please check your connection.',
      SERVICE_UNAVAILABLE: 'Transferly is temporarily unavailable. Please try again shortly.',
      REQUEST_TIMEOUT: 'Request timed out. Please check your connection and try again.',
      CORS_BLOCKED: 'Your request was blocked by security policy. Please try again.',
      AUTH_INIT_DATA_MISSING: 'Waiting for Telegram data. This usually resolves in a few seconds.',
      AUTH_SIGNATURE_INVALID: 'Your Telegram session is invalid. Please restart the app.',
      AUTH_DATA_EXPIRED: 'Your Telegram session has expired. Please restart the app.',
      SESSION_TOKEN_MISSING: 'Authentication session is missing. Please refresh the page.',
      SESSION_EXPIRED: 'Your session has expired. Please log in again.',
      PROVIDER_UNAVAILABLE: 'A provider service is temporarily unavailable. Please try again later.',
      RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
      UNKNOWN: error.message || 'An unexpected error occurred.'
    };

    return messages[code] || messages.UNKNOWN;
  }, [error]);

  const shouldShowPanel = useMemo(() => {
    // Don't show if dismissed recently
    if (dismissedUntil && Date.now() < dismissedUntil) {
      return false;
    }

    // Show if we have a new error
    if (errorChanged) {
      return true;
    }

    // Show if still have error and it's recoverable
    return hasError && isRecoverable;
  }, [errorChanged, hasError, isRecoverable, dismissedUntil]);

  useEffect(() => {
    if (errorChanged && error) {
      setLastSeenErrorKey(errorKey);
    }
  }, [errorChanged, error, errorKey]);

  const handleRetry = useCallback(async () => {
    setRetryInProgress(true);
    try {
      await onRetry?.();
    } finally {
      setRetryInProgress(false);
    }
  }, [onRetry]);

  const handleDismiss = useCallback(() => {
    // Dismiss for 30 seconds
    setDismissedUntil(Date.now() + 30000);
    onDismiss?.();
  }, [onDismiss]);

  if (!shouldShowPanel || !error) {
    return null;
  }

  const canRetry = isRecoverable && authState?.canRetry && !retryInProgress;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-[85] sm:inset-x-auto sm:right-4 sm:max-w-[420px]"
      style={{
        bottom: 'calc(var(--miniapp-bottom-nav-height, 72px) + var(--miniapp-safe-area-bottom, 0px) + 14px)'
      }}
    >
      <section
        role="status"
        aria-live="polite"
        className="pointer-events-auto rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-bg)] p-4 text-[var(--tg-text-color)] shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur"
      >
        <div className="flex gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] bg-[color-mix(in_srgb,var(--tg-destructive-text-color)_12%,var(--miniapp-card-bg))] text-[var(--tg-destructive-text-color)]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-black leading-5">{title}</h3>
              <button
                type="button"
                onClick={handleDismiss}
                className="miniapp-pressable -mr-1 -mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--miniapp-shell-text-muted)] hover:bg-[var(--miniapp-accent-soft)] hover:text-[var(--tg-text-color)]"
                aria-label="Dismiss recovery message"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm leading-5 text-[var(--miniapp-shell-text-muted)]">{userFriendlyMessage}</p>

            {error.requestId && (
              <p className="mt-2 break-all text-[11px] font-semibold text-[var(--miniapp-shell-text-muted)]">
                Support ID: <span className="font-mono">{error.requestId}</span>
              </p>
            )}

            <div className="mt-4 flex gap-2">
              {canRetry ? (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retryInProgress}
                  className="miniapp-pressable flex min-h-10 items-center gap-2 rounded-full bg-[var(--tg-button-color)] px-4 py-2 text-sm font-black text-[var(--tg-button-text-color)] disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${retryInProgress ? 'animate-spin' : ''}`} aria-hidden="true" />
                  {retryInProgress ? 'Retrying...' : 'Try Again'}
                </button>
              ) : null}
            </div>

            {authState?.retryCount ? (
              <p className="mt-2 text-xs font-semibold text-[var(--miniapp-shell-text-muted)]">
                Attempt {authState.retryCount} of {3}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export default AuthErrorRecoveryPanel;
