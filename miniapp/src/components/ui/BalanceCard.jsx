/**
 * BalanceCard - Interactive Balance Display with Visibility Toggle
 * Beautiful balance card with show/hide functionality
 */

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function BalanceCard({
  label,
  balance,
  currency = 'USD',
  isVisible = true,
  description,
  source = 'Transferly balance'
}) {
  const [showBalance, setShowBalance] = React.useState(isVisible);
  const ToggleIcon = showBalance ? Eye : EyeOff;
  const numericBalance = Number(balance);
  const formattedBalance = Number.isFinite(numericBalance)
    ? numericBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

  return (
    <section className="miniapp-surface-card p-6 text-[var(--tg-text-color)]" aria-label={`${label} balance`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--miniapp-shell-text-muted)]">
          {label}
          </h3>
          <p className="mt-1 text-xs font-medium text-[var(--miniapp-shell-text-muted)]">
            {description || source}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBalance(!showBalance)}
          aria-label={showBalance ? 'Hide balance' : 'Show balance'}
          className="miniapp-pressable miniapp-touch-target inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--miniapp-accent-soft)] text-[var(--tg-button-color)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--miniapp-focus-ring)]"
        >
          <ToggleIcon size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-end gap-2" aria-live="polite">
        <span className="text-4xl font-black tracking-tight text-[var(--tg-text-color)]">
          {showBalance ? formattedBalance : '•••••'}
        </span>
        <span className="pb-2 text-lg font-semibold text-[var(--miniapp-shell-text-muted)]">
          {currency}
        </span>
      </div>
    </section>
  );
}
