import React from 'react';
import { CheckCircle2, LockKeyhole, PlayCircle } from 'lucide-react';

function formatLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarizeRequirements(requirements = {}) {
  if (Array.isArray(requirements)) {
    return requirements.map((item) => item.label || item.code).filter(Boolean);
  }

  return Object.entries(requirements)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => formatLabel(key));
}

export default function ProviderActionPanel({ dashboard, activeLane }) {
  const actions = Array.isArray(dashboard?.preflight) ? dashboard.preflight : [];
  const nextActions = Array.isArray(dashboard?.next_recommended_actions) ? dashboard.next_recommended_actions : [];

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Action preflight</p>
          <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">{formatLabel(activeLane || 'overview')}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            Sensitive provider actions are checked for setup, readiness, idempotency, balance, risk, and service availability before users proceed.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {actions.length ? actions.map((action) => {
          const requirements = summarizeRequirements(action.requirements);

          return (
            <article key={action.operation} className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-start gap-3">
                {action.allowed ? (
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-200" size={18} />
                ) : (
                  <LockKeyhole className="mt-0.5 shrink-0 text-amber-100" size={18} />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-black text-[var(--tg-text-color)]">{action.label || formatLabel(action.operation)}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
                    {action.allowed ? action.status : action.reason || action.status || 'Unavailable'}
                  </p>
                  {requirements.length ? (
                    <p className="mt-2 text-[11px] font-bold leading-4 text-[var(--tg-hint-color)]">
                      Requires: {requirements.join(', ')}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        }) : (
          <p className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]">
            Action preflight is not loaded yet.
          </p>
        )}
      </div>

      {nextActions.length ? (
        <div className="mt-4 grid gap-2">
          {nextActions.slice(0, 4).map((item) => (
            <div key={item.code || item.label} className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/[0.035] p-3">
              <PlayCircle className="mt-0.5 shrink-0 text-[var(--tg-button-color)]" size={17} />
              <div>
                <p className="text-sm font-black text-[var(--tg-text-color)]">{item.label || formatLabel(item.code)}</p>
                {item.detail ? <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{item.detail}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
