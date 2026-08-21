import React from 'react';
import { Banknote } from 'lucide-react';
import { ProviderTransactions } from '../shared/BaseProviderUI';
import { StatusBadge } from '../../components/ui';

/**
 * Flutterwave transaction item renderer.
 * Handles items from GET /v3/transactions.
 */
function FlutterwaveTransactionItem({ item }) {
  const id = item.id || item.tx_ref || '—';
  const amount = item.amount !== undefined ? Number(item.amount).toFixed(2) : '—';
  const currency = (item.currency || 'NGN').toUpperCase();
  const status = item.status || 'unknown';
  const paymentType = item.payment_type || null;
  const customer = item.customer?.email || null;
  const date = item.created_at;

  return (
    <article
      className="flex items-start gap-3 rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] p-4"
      aria-label={`Flutterwave transaction ${id}`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#f5a623]/10 text-[#f5a623]">
        <Banknote size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black text-[var(--miniapp-text-primary)]">
            {typeof id === 'number' ? `FLW #${id}` : String(id).slice(-12)}
          </p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 text-xs font-bold text-[var(--miniapp-text-muted)]">
          {amount !== '—' ? `${amount} ${currency}` : '—'}
          {paymentType ? ` · ${paymentType}` : ''}
          {customer ? ` · ${customer}` : ''}
          {date ? ` · ${new Date(date).toLocaleDateString()}` : ''}
        </p>
      </div>
    </article>
  );
}

export default function FlutterwaveTransactions({ manifest, transactions, pagination, loading, error, onPageChange }) {
  return (
    <ProviderTransactions
      manifest={manifest}
      transactions={transactions}
      pagination={pagination}
      loading={loading}
      error={error}
      onPageChange={onPageChange}
      renderItem={(item, index) => (
        <FlutterwaveTransactionItem key={item.id || item.tx_ref || index} item={item} />
      )}
    />
  );
}
