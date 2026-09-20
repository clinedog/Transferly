import React, { useEffect, useState } from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { listPaymentLinks } from '../../lib/api';
import SurfaceCard from '../ui/SurfaceCard';

function formatAmount(cents, currency) {
  return `${currency || ''} ${(Number(cents || 0) / 100).toLocaleString()}`;
}

export default function AdminPaymentLinksTab() {
  const [links, setLinks] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listPaymentLinks({ page: 1, pageSize: 100 })
      .then((payload) => { if (active) setLinks(payload.data || []); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Payment links unavailable.'); });
    return () => { active = false; };
  }, []);

  const copy = async (url) => {
    await navigator.clipboard.writeText(url);
  };

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Payment links</p>
        <h2 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Provider-backed checkout links</h2>
        <p className="mt-2 text-sm text-[var(--tg-subtitle-text-color)]">Links are sourced from invoice records and remain subject to provider status and payment state.</p>
      </SurfaceCard>
      {error ? <SurfaceCard className="p-5 text-sm font-bold text-red-200">{error}</SurfaceCard> : null}
      {!error && links.length === 0 ? <SurfaceCard className="p-5 text-sm font-bold text-[var(--tg-hint-color)]">No hosted payment links found.</SurfaceCard> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {links.map((link) => (
          <SurfaceCard as="article" key={link.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-[var(--tg-text-color)]">{link.invoice_number || link.id}</p>
                <p className="mt-1 text-sm font-bold text-[var(--tg-text-color)]">{formatAmount(link.amount_cents, link.currency)}</p>
                <p className="mt-1 truncate text-xs text-[var(--tg-hint-color)]">{link.url}</p>
              </div>
              <span className="rounded-full border border-[var(--miniapp-accent-border)] px-2 py-1 text-[10px] font-black uppercase text-[var(--tg-hint-color)]">{link.status}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(link.url)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--miniapp-accent-border)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)]"><Copy size={14} />Copy</button>
              <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[var(--tg-button-color)] px-3 py-2 text-xs font-black text-[var(--tg-button-text-color)]"><ExternalLink size={14} />Open</a>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
