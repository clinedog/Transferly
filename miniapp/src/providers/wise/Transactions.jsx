import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { ProviderTransactions } from '../shared/BaseProviderUI';
import { StatusBadge } from '../../components/ui';

/**
 * Wise transaction item renderer.
 * Handles Transfer-shaped items from /v1/transfers.
 */
function WiseTransferItem({ item }) {
  const id = item.id || '—';
  const sourceAmount = item.sourceValue ?? item.sourceAmount ?? '—';
  const sourceCurrency = item.sourceCurrency || '';
  const targetAmount = item.targetValue ?? item.targetAmount ?? null;
  const targetCurrency = item.targetCurrency || '';
  const status = item.status || 'unknown';
  const reference = item.details?.reference || item.reference || null;
  const date = item.created ? new Date(item.created).toLocaleDateString() : null;

  return (
    <article
      className="flex items-start gap-3 rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] p-4"
      aria-label={`Wise transfer ${id}`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#00b9ff]/10 text-[#00b9ff]">
        <ArrowRightLeft size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black text-[var(--miniapp-text-primary)]">
            Transfer · #{id}
          </p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 text-xs font-bold text-[var(--miniapp-text-muted)]">
          {sourceAmount !== '—' ? `${sourceAmount} ${sourceCurrency}` : '—'}
          {targetAmount ? ` → ${targetAmount} ${targetCurrency}` : ''}
          {reference ? ` · ${reference}` : ''}
          {date ? ` · ${date}` : ''}
        </p>
      </div>
    </article>
  );
}

export default function WiseTransactions({ manifest, transactions, pagination, loading, error, onPageChange }) {
  return (
    <ProviderTransactions
      manifest={manifest}
      transactions={transactions}
      pagination={pagination}
      loading={loading}
      error={error}
      onPageChange={onPageChange}
      renderItem={(item, index) => (
        <WiseTransferItem key={item.id || index} item={item} />
      )}
    />
  );
}
