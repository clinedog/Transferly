import React from 'react';

const variantClassName = {
  card: 'h-20 rounded-2xl',
  metric: 'h-24 rounded-[22px]',
  row: 'h-14 rounded-[18px]',
  chip: 'h-9 rounded-full',
  dashboard: 'h-32 rounded-[26px]'
};

export function LoadingSkeletonCard({
  count = 1,
  height = '',
  variant = 'card',
  className = '',
  ariaLabel = 'Loading Transferly content'
}) {
  const shape = height || variantClassName[variant] || variantClassName.card;

  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          role="status"
          aria-label={ariaLabel}
          aria-live="polite"
          className={`${shape} overflow-hidden border border-[var(--miniapp-border-color,rgba(148,163,184,0.2))] bg-[linear-gradient(110deg,var(--miniapp-panel-bg,rgba(255,255,255,0.06))_8%,var(--miniapp-accent-soft,rgba(42,171,238,0.14))_18%,var(--miniapp-panel-bg,rgba(255,255,255,0.06))_33%)] shadow-sm motion-safe:animate-pulse ${className}`}
          style={{
            backgroundSize: '1400px 100%'
          }}
        >
          <span className="sr-only">{ariaLabel}</span>
        </div>
      ))}
    </>
  );
}
