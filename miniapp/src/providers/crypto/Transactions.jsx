import React from 'react';
import { Bitcoin } from 'lucide-react';
import { ProviderTransactions } from '../shared/BaseProviderUI';
import { StatusBadge } from '../../components/ui';

/**
 * Crypto Commerce transaction item renderer.
 * Handles Charge objects from GET /charges.
 */
function CryptoChargeItem({ item }) {
  // item may be wrapped in { data: charge } or be the charge directly
  const charge = item?.data ?? item;
  const id = charge.id || charge.code || '—';
  const name = charge.name || null;
  const pricing = charge.pricing?.local;
  const amount = pricing?.amount ?? '—';
  const currency = pricing?.currency ?? '';
  const timeline = Array.isArray(charge.timeline) ? charge.timeline : [];
  const lastEvent = timeline[timeline.length - 1];
  const status = lastEvent?.status || charge.status || 'unknown';
  const date = charge.created_at;

  return (
    <article
      className="flex items-start gap-3 rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] p-4"
      aria-label={`Crypto charge ${id}`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#0052ff]/10 text-[#0052ff]">
        <Bitcoin size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black text-[var(--miniapp-text-primary)]">
            {name || `Charge · ${String(id).slice(-8)}`}
          </p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 text-xs font-bold text-[var(--miniapp-text-muted)]">
          {amount !== '—' ? `${amount}${currency ? ` ${currency}` : ''}` : '—'}
          {date ? ` · ${new Date(date).toLocaleDateString()}` : ''}
        </p>
      </div>
    </article>
  );
}

export default function CryptoTransactions({ manifest, transactions, pagination, loading, error, onPageChange }) {
  return (
    <ProviderTransactions
      manifest={manifest}
      transactions={transactions}
      pagination={pagination}
      loading={loading}
      error={error}
      onPageChange={onPageChange}
      renderItem={(item, index) => (
        <CryptoChargeItem key={(item?.data ?? item)?.id || (item?.data ?? item)?.code || index} item={item} />
      )}
    />
  );
}
