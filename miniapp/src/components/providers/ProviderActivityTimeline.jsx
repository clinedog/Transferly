import React from 'react';
import { Activity, AlertTriangle, Webhook } from 'lucide-react';

export default function ProviderActivityTimeline({ dashboard }) {
  const activity = Array.isArray(dashboard?.recent_activity?.items) ? dashboard.recent_activity.items : [];
  const webhooks = dashboard?.webhook_status || {};

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Activity & webhooks</p>
          <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">Recent provider events</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            Provider activity, webhook freshness, and operational issues stay visible without exposing raw event payloads.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
        <div className="grid gap-2">
          {activity.length ? activity.slice(0, 6).map((item) => (
            <article key={`${item.type || 'activity'}-${item.id}`} className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
              <Activity className="mt-0.5 shrink-0 text-[var(--tg-button-color)]" size={17} />
              <div className="min-w-0">
                <p className="text-sm font-black text-[var(--tg-text-color)]">{item.label || item.id || 'Provider event'}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{item.type || 'activity'} · {item.status || 'recorded'}</p>
              </div>
            </article>
          )) : (
            <p className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]">
              No recent provider events are available for this workspace.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
            <Webhook className="text-[var(--tg-button-color)]" size={18} />
            <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">Webhook status</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
              {webhooks.message || `${webhooks.failed_count || 0} failed events · ${webhooks.pending_count || 0} pending events`}
            </p>
          </div>
          {dashboard?.risk_flags?.items?.length ? (
            <div className="rounded-[20px] border border-amber-300/25 bg-amber-300/10 p-4">
              <AlertTriangle className="text-amber-100" size={18} />
              <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">Risk flags</p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
                {dashboard.risk_flags.items.slice(0, 2).map((item) => item.label || item.code).join(', ')}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
