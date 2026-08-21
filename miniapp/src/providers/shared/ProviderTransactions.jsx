/**
 * ProviderTransactions — shared Transactions tab component.
 *
 * Renders a paginated, filterable list of provider transactions sourced from
 * GET /api/providers/:provider/transactions. All providers share this layout;
 * provider-specific columns or filters can be injected via `renderItem` or `children`.
 *
 * Props:
 *   manifest      {object}   Provider manifest from providerManifests.js
 *   transactions  {Array}    Transaction items
 *   pagination    {object}   { page, page_size, total, has_next_page }
 *   loading       {boolean}
 *   error         {string|null}
 *   onPageChange  {function} (page: number) => void
 *   renderItem    {function} Optional custom item renderer (item) => ReactNode
 *   children      {ReactNode} Optional extra sections appended after the list
 */
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { TransactionItem, LoadingSkeletonCard, StatusBadge } from '../../components/ui';

function EmptyState({ providerName }) {
  return (
    <div className="rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-8 text-center">
      <p className="text-base font-black text-[var(--miniapp-text-primary)]">No transactions yet</p>
      <p className="mt-2 text-sm font-semibold text-[var(--miniapp-text-muted)]">
        {providerName} transactions will appear here once provider operations are active.
      </p>
    </div>
  );
}

function PaginationBar({ pagination, onPageChange }) {
  if (!pagination || pagination.total <= pagination.page_size) return null;
  const { page, total, page_size, has_next_page } = pagination;
  const totalPages = Math.ceil(total / page_size);

  return (
    <nav
      className="flex items-center justify-between rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-3"
      aria-label="Transaction pagination"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] px-3 text-xs font-black text-[var(--miniapp-text-primary)] disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft size={15} aria-hidden="true" /> Previous
      </button>
      <span className="text-xs font-bold text-[var(--miniapp-text-muted)]">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={!has_next_page}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] px-3 text-xs font-black text-[var(--miniapp-text-primary)] disabled:opacity-40"
        aria-label="Next page"
      >
        Next <ChevronRight size={15} aria-hidden="true" />
      </button>
    </nav>
  );
}

export default function ProviderTransactions({
  manifest,
  transactions = [],
  pagination = null,
  loading = false,
  error = null,
  onPageChange,
  renderItem,
  children
}) {
  const [search, setSearch] = useState('');
  const providerName = manifest?.displayName || 'Provider';

  const filtered = search.trim()
    ? transactions.filter((item) => {
        const text = JSON.stringify(item).toLowerCase();
        return text.includes(search.trim().toLowerCase());
      })
    : transactions;

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-busy="true" aria-live="polite">
        <LoadingSkeletonCard count={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-[22px] border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-[var(--tg-text-color)]"
        role="alert"
      >
        <p className="font-black">Failed to load transactions</p>
        <p className="mt-1 text-[var(--tg-subtitle-text-color)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <label className="flex items-center gap-2 rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] px-4 py-3">
        <Search size={16} className="shrink-0 text-[var(--miniapp-text-muted)]" aria-hidden="true" />
        <input
          type="search"
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--miniapp-text-primary)] placeholder:text-[var(--miniapp-text-muted)] focus:outline-none"
          placeholder={`Search ${providerName} transactions…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={`Search ${providerName} transactions`}
        />
      </label>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <EmptyState providerName={providerName} />
      ) : (
        <div className="space-y-2">
          {filtered.map((item, index) => {
            if (renderItem) return renderItem(item, index);
            return (
              <TransactionItem
                key={item.id || item.transaction_id || index}
                transaction={item}
              />
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {onPageChange && (
        <PaginationBar pagination={pagination} onPageChange={onPageChange} />
      )}

      {/* Provider-specific extra sections */}
      {children}
    </div>
  );
}
