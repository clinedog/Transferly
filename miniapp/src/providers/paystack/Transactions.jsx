import React from 'react';
import { CreditCard } from 'lucide-react';
import { ProviderTransactions } from '../shared/BaseProviderUI';
import { StatusBadge } from '../../components/ui';

/**
 * Paystack transaction item renderer.
 * Amounts are in kobo (1 NGN = 100 kobo).
 */
function PaystackTransactionItem({ item }) {
  const id = item.id || item.reference || '—';
  const amount = item.amount !== undefined ? (item.amount / 100).toFixed(2) : '—';
  const currency = (item.currency || 'NGN').toUpperCase();
  const status = item.status || 'unknown';
  const channel = item.channel || null;
  const customer = item.customer?.email || null;
  const date = item.paid_at || item.created_at;

  return (
    <article
      className="flex items-start gap-3 rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] p-4"
      aria-label={`Paystack transaction ${id}`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#00c3f7]/10 text-[#00c3f7]">
        <CreditCard size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black text-[var(--miniapp-text-primary)]">
            {typeof id === 'number' ? `TXN #${id}` : String(id).slice(-12)}
          </p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 text-xs font-bold text-[var(--miniapp-text-muted)]">
          {amount !== '—' ? `₦${amount} ${currency}` : '—'}
          {channel ? ` · ${channel}` : ''}
          {customer ? ` · ${customer}` : ''}
          {date ? ` · ${new Date(date).toLocaleDateString()}` : ''}
        </p>
      </div>
    </article>
  );
}

export default function PaystackTransactions({ manifest, transactions, pagination, loading, error, onPageChange }) {
  return (
    <ProviderTransactions
      manifest={manifest}
      transactions={transactions}
      pagination={pagination}
      loading={loading}
      error={error}
      onPageChange={onPageChange}
      renderItem={(item, index) => (
        <PaystackTransactionItem key={item.id || item.reference || index} item={item} />
      )}
    />
  );
}
