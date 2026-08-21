import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function ProviderReadinessPanel({ dashboard }) {
  const readiness = dashboard?.readiness || {};
  const operations = Array.isArray(readiness.operations) ? readiness.operations : [];
  const setup = dashboard?.settings || {};
  const missing = Array.isArray(setup.missing_configuration) ? setup.missing_configuration : [];

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-[var(--tg-button-color)]" size={20} />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Readiness</p>
          <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">{readiness.status || 'Preview'}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            {readiness.summary?.message || 'Transferly checks provider setup before enabling service actions.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {operations.length ? operations.map((operation) => (
          <article key={operation.operation} className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
            <CheckCircle2 className={operation.status === 'live' ? 'text-emerald-200' : 'text-[var(--tg-hint-color)]'} size={17} />
            <p className="mt-2 text-sm font-black text-[var(--tg-text-color)]">{operation.label || operation.operation}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{operation.message || operation.status}</p>
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
