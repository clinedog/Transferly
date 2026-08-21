import React from 'react';
import { CreditCard } from 'lucide-react';
import { ProviderTransactions } from '../shared/BaseProviderUI';
import { StatusBadge } from '../../components/ui';

/**
 * Stripe transaction item renderer.
 * Handles PaymentIntent-shaped items from /v1/payment_intents.
 */
function StripeTransactionItem({ item }) {
  const id = item.id || '—';
  // Stripe amounts are in smallest currency unit (cents)
  const amount = item.amount !== undefined ? (item.amount / 100).toFixed(2) : '—';
  const currency = (item.currency || '').toUpperCase();
  const status = item.status || 'unknown';
  const description = item.description || item.metadata?.description || null;
  const date = item.created ? new Date(item.created * 1000).toLocaleDateString() : null;

  return (
    <article
      className="flex items-start gap-3 rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] p-4"
      aria-label={`Stripe payment intent ${id}`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#635bff]/10 text-[#635bff]">
        <CreditCard size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black text-[var(--miniapp-text-primary)]">
            {id.startsWith('pi_') ? `PI · ${id.slice(-8)}` : id.slice(-12)}
          </p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 text-xs font-bold text-[var(--miniapp-text-muted)]">
          {amount !== '—' ? `${amount} ${currency}` : '—'}
          {description ? ` · ${description}` : ''}
          {date ? ` · ${date}` : ''}
        </p>
      </div>
    </article>
  );
}

export default function StripeTransactions({ manifest, transactions, pagination, loading, error, onPageChange }) {
  return (
    <ProviderTransactions
      manifest={manifest}
      transactions={transactions}
      pagination={pagination}
      loading={loading}
      error={error}
      onPageChange={onPageChange}
      renderItem={(item, index) => (
        <StripeTransactionItem key={item.id || index} item={item} />
      )}
    />
  );
}
