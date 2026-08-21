import React from 'react';
import { FileText, ArrowUpRight } from 'lucide-react';
import { ProviderTransactions } from '../shared/BaseProviderUI';
import { StatusBadge } from '../../components/ui';

/**
 * PayPal transaction item renderer.
 * Handles both invoice-style (INVOICING.*) and payout-style items.
 */
function PayPalTransactionItem({ item }) {
  const id = item.id || item.transaction_id || item.invoice_id || '—';
  const amount = item.amount?.value ?? item.gross_amount?.value ?? item.amount ?? '—';
  const currency = item.amount?.currency_code ?? item.gross_amount?.currency_code ?? item.currency ?? '';
  const status = item.status || item.transaction_status || item.payment_status || 'unknown';
  const type = item.type || (item.invoice_id ? 'invoice' : 'transaction');
  const date = item.create_time || item.transaction_updated_date || item.updated_time || item.created_at;
  const linkedResource = item.linked_resource || (type === 'invoice' ? 'Linked to hosted PayPal records' : 'Provider activity for reconciliation and support');
  const source = item.source || 'Searchable provider activity';

  return (
    <article
      className="flex items-start gap-3 rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] p-4"
      aria-label={`PayPal ${type} ${id}`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#003087]/10 text-[#003087]">
        {type === 'invoice' ? <FileText size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black text-[var(--miniapp-text-primary)]">
            {type === 'invoice' ? 'Invoice' : 'Transaction'} · {id.slice(-8)}
          </p>
          <StatusBadge status={status} />
        </div>
        <dl className="mt-2 grid gap-2 text-xs font-bold text-[var(--miniapp-text-muted)] sm:grid-cols-2">
          <div><dt className="font-black text-[var(--miniapp-text-primary)]">Amount</dt><dd>{amount}</dd></div>
          <div><dt className="font-black text-[var(--miniapp-text-primary)]">Currency</dt><dd>{currency || '—'}</dd></div>
          <div><dt className="font-black text-[var(--miniapp-text-primary)]">Date</dt><dd>{date ? new Date(date).toLocaleDateString() : '—'}</dd></div>
          <div><dt className="font-black text-[var(--miniapp-text-primary)]">Linked Resource</dt><dd>{linkedResource}</dd></div>
          <div className="sm:col-span-2"><dt className="font-black text-[var(--miniapp-text-primary)]">Source</dt><dd>{source}</dd></div>
        </dl>
        <p className="mt-2 text-xs font-black text-[#0070e0]">Provider activity for reconciliation and support</p>
      </div>
    </article>
  );
}

export default function PayPalTransactions({ manifest, transactions, pagination, loading, error, onPageChange }) {
  return (
    <ProviderTransactions
      manifest={manifest}
      transactions={transactions}
      pagination={pagination}
      loading={loading}
      error={error}
      onPageChange={onPageChange}
      renderItem={(item, index) => (
        <PayPalTransactionItem key={item.id || item.transaction_id || index} item={item} />
      )}
    >
      <section className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-4">
        <h2 className="text-lg font-black text-[var(--miniapp-text-primary)]">Transactions</h2>
        <p className="mt-2 text-sm font-semibold text-[var(--miniapp-text-muted)]">Search invoices, payouts, and provider transactions in one PayPal workspace view.</p>
        <p className="mt-3 text-xs font-black text-[#0070e0]">Previous · Page {pagination?.page || 1} of {pagination?.total_pages || Math.max(1, Math.ceil((pagination?.total || 1) / (pagination?.page_size || 1)))} · Next</p>
      </section>
    </ProviderTransactions>
  );
}
