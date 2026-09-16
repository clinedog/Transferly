import React from 'react';
import { LoadingSkeletonCard } from './LoadingSkeletonCard';

export default function LoadingFallback({ variant = 'dashboard', count = 1 }) {
  return (
    <div className="miniapp-card-surface rounded-[var(--miniapp-radius-card)] p-4" aria-busy="true">
      <LoadingSkeletonCard variant={variant} count={count} />
    </div>
  );
}
