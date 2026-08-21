import React from 'react';
import { useLocation } from 'react-router-dom';
import { useMiniAppRuntime } from '../context/MiniAppRuntimeContext';
import { MiniAppState } from './MiniAppState';

const blockingStatuses = new Set(['offline', 'error', 'auth-failed']);

function MiniAppRuntimeNotice({ runtime }) {
  const temporaryIssue = runtime.initializationError?.recoverable || runtime.status === 'auth-failed';
  const retryLabel = runtime.retrying ? 'Retrying' : 'Retry';
  const title = runtime.status === 'error'
    ? 'Transferly connection needs a retry'
    : runtime.label;
  const description = runtime.status === 'error'
    ? 'Some workspace data could not refresh. You can keep using available screens or retry the connection.'
    : runtime.detail;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-[90] mx-auto max-w-[640px]"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-[24px] border border-[var(--tg-button-color)]/20 bg-[var(--tg-section-bg-color)]/95 p-4 text-[var(--tg-text-color)] shadow-[0_18px_55px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{title}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--tg-subtitle-text-color)]">
              {description}
            </p>
            {temporaryIssue ? (
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
                Temporary issue detected
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={runtime.retry}
            disabled={runtime.retrying}
            aria-busy={runtime.retrying ? 'true' : undefined}
            aria-disabled={runtime.retrying ? 'true' : undefined}
            aria-label={retryLabel}
            className="miniapp-pressable miniapp-touch-target inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--tg-button-color)] px-4 py-2 text-xs font-black text-[var(--tg-button-text-color)] motion-safe:transition disabled:opacity-70"
          >
            {retryLabel}
          </button>
        </div>
        {runtime.diagnostics?.requestId ? (
          <p className="mt-2 text-[11px] font-bold text-[var(--tg-hint-color)]">
            Request {runtime.diagnostics.requestId}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MiniAppRuntimeGate({ children }) {
  const location = useLocation();
  const runtime = useMiniAppRuntime();
  const adminWorkspace = location.pathname === '/admin';
  const miniAppWorkspace = location.pathname.startsWith('/miniapp');
  const protectedWorkspace = adminWorkspace || miniAppWorkspace;

  if (!protectedWorkspace) {
    return children;
  }

  if (runtime.status === 'loading' && runtime.authState === 'authenticating') {
    return (
      <MiniAppState
        tone="loading"
        title={runtime.label}
        description={runtime.detail}
        requestId={runtime.diagnostics?.requestId}
      />
    );
  }

  if (adminWorkspace && blockingStatuses.has(runtime.status)) {
    return (
      <MiniAppState
        tone="error"
        title={runtime.label}
        description={runtime.detail}
        secondaryDetail={
          runtime.initializationError?.recoverable
            ? 'Temporary network or service issue detected. Retry is safe.'
            : null
        }
        requestId={runtime.diagnostics?.requestId}
        actionLabel={runtime.retrying ? 'Retrying' : 'Retry'}
        actionDisabled={runtime.retrying}
        onAction={runtime.retry}
      />
    );
  }

  if (miniAppWorkspace && runtime.status === 'offline') {
    return (
      <>
        <MiniAppRuntimeNotice runtime={runtime} />
        {children}
      </>
    );
  }

  return children;
}
