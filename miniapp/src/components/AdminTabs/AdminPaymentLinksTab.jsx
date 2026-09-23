import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Copy, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { listPaymentLinks } from '../../lib/api';
import SurfaceCard from '../ui/SurfaceCard';

function formatAmount(cents, currency) {
  return `${currency || ''} ${(Number(cents || 0) / 100).toLocaleString()}`;
}

function getLinkState(link) {
  const status = String(link.status || '').toLowerCase();
  if (['cancelled', 'canceled', 'expired', 'paid', 'refunded'].includes(status)) {
    return status === 'canceled' ? 'cancelled' : status;
  }

  if (link.due_date) {
    const dueDate = new Date(link.due_date);
    if (!Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now()) {
      return 'expired';
    }
  }

  return status || 'active';
}

function formatExpiry(link) {
  if (!link.due_date) {
    return 'No expiry date';
  }

  const date = new Date(link.due_date);
  if (Number.isNaN(date.getTime())) {
    return 'Expiry unavailable';
  }

  const state = getLinkState(link);
  return `${state === 'expired' ? 'Expired' : 'Expires'} ${date.toLocaleDateString()}`;
}

export default function AdminPaymentLinksTab() {
  const [links, setLinks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await listPaymentLinks({ page: 1, pageSize: 100 });
      setLinks(payload.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Payment links unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Payment link copied');
    } catch {
      toast.error('Could not copy payment link');
    }
  };

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Payment links</p>
        <h2 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Provider-backed checkout links</h2>
        <p className="mt-2 text-sm text-[var(--tg-subtitle-text-color)]">Links are sourced from invoice records and remain subject to provider status, payment state, and due-date expiration.</p>
        <button type="button" onClick={loadLinks} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--miniapp-accent-border)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)] disabled:opacity-60">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh links
        </button>
      </SurfaceCard>
      {error ? <SurfaceCard className="p-5 text-sm font-bold text-red-200">{error}</SurfaceCard> : null}
      {!error && !loading && links.length === 0 ? <SurfaceCard className="p-5 text-sm font-bold text-[var(--tg-hint-color)]">No hosted payment links found.</SurfaceCard> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {links.map((link) => (
          <SurfaceCard as="article" key={link.id} className="p-4">
            {(() => {
              const state = getLinkState(link);
              const unavailable = ['cancelled', 'expired', 'paid', 'refunded'].includes(state);
              return (
                <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-[var(--tg-text-color)]">{link.invoice_number || link.id}</p>
                <p className="mt-1 text-sm font-bold text-[var(--tg-text-color)]">{formatAmount(link.amount_cents, link.currency)}</p>
                <p className="mt-1 truncate text-xs text-[var(--tg-hint-color)]">{link.url}</p>
                <p className="mt-2 text-xs font-bold text-[var(--tg-hint-color)]">{formatExpiry(link)}</p>
              </div>
              <span className="rounded-full border border-[var(--miniapp-accent-border)] px-2 py-1 text-[10px] font-black uppercase text-[var(--tg-hint-color)]">{state}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(link.url)} disabled={!link.url} className="inline-flex items-center gap-2 rounded-xl border border-[var(--miniapp-accent-border)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)] disabled:opacity-50"><Copy size={14} />Copy</button>
              {unavailable ? (
                <span className="inline-flex items-center rounded-xl border border-[var(--miniapp-accent-border)] px-3 py-2 text-xs font-black text-[var(--tg-hint-color)]">Link unavailable</span>
              ) : (
                <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[var(--tg-button-color)] px-3 py-2 text-xs font-black text-[var(--tg-button-text-color)]"><ExternalLink size={14} />Open</a>
              )}
            </div>
                </>
              );
            })()}
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
