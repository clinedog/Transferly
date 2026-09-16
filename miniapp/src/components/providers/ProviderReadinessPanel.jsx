import React from 'react';
import { AlertTriangle, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';

function formatStatus(status) {
  return String(status || 'coming_soon')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readinessTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (['ready', 'healthy', 'active', 'live'].includes(normalized)) {
    return 'text-emerald-200';
  }
  if (['degraded', 'needs_review', 'needs_env', 'needs_webhook'].includes(normalized)) {
    return 'text-amber-100';
  }
  return 'text-[var(--tg-text-color)]';
}

export default function ProviderReadinessPanel({ dashboard, snapshot }) {
  const readiness = dashboard?.readiness || snapshot?.readiness || snapshot || {};
  const operations = Array.isArray(readiness.operations) ? readiness.operations : [];
  const setup = dashboard?.settings || {};
  const missing = readiness.configuration?.missing || setup.missing_env || readiness.missing_env || [];

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-[var(--tg-button-color)]" size={20} />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Readiness</p>
          <h2 className={`mt-2 text-xl font-black ${readinessTone(readiness.status)}`}>
            {formatStatus(readiness.status)}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            {readiness.summary?.message || 'Transferly checks provider setup before enabling service actions.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {operations.length ? operations.map((operation) => (
          <article key={operation.operation} className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
            {operation.execution_eligible?.production === true ? (
              <CheckCircle2 className="text-emerald-200" size={17} aria-hidden="true" />
            ) : (
              <LockKeyhole className="text-[var(--tg-hint-color)]" size={17} aria-hidden="true" />
            )}
            <p className="mt-2 text-sm font-black text-[var(--tg-text-color)]">{operation.label || formatStatus(operation.operation)}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
              {formatStatus(operation.operation_status || operation.status)} · {operation.execution_eligible?.production === true ? 'Live execution enabled' : operation.execution_eligible?.sandbox === true ? 'Sandbox only' : 'Execution unavailable'}
            </p>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">
              {operation.provider_native === true ? 'Provider native' : 'Transferly managed'}
            </p>
          </article>
        )) : (
          <p className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]">
            Operation readiness has not been loaded.
          </p>
        )}
      </div>

      {missing.length ? (
        <div className="mt-4 rounded-[22px] border border-amber-300/25 bg-amber-300/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-100" size={18} />
            <div>
              <p className="text-sm font-black text-[var(--tg-text-color)]">Configuration needed</p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
                Missing: {missing.join(', ')}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
