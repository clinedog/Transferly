/**
 * BaseProviderUI — shared provider UI primitives barrel.
 *
 * Exports:
 *   ProviderShell       — Minimal wrapper with header + status (original)
 *   ProviderOverview    — Full Overview tab with metrics, activity, readiness
 *   ProviderTransactions — Full Transactions tab with search + pagination
 */
import React from 'react';

// Original ProviderShell kept for backward compatibility
export function ProviderShell({ children, title, status }) {
  return (
    <div className="provider-shell space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-black">{title}</h1>
        {status && <div className="text-sm text-[var(--miniapp-text-muted)]">{status}</div>}
      </header>
      <main>{children}</main>
    </div>
  );
}

export { default as ProviderOverview } from './ProviderOverview';
export { default as ProviderTransactions } from './ProviderTransactions';

export default ProviderShell;
