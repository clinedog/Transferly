import React from 'react';
import { LoadingSkeletonCard } from './LoadingSkeletonCard';

export default function LoadingFallback({ variant = 'dashboard', count = 1 }) {
  return (
    <div className="p-4">
      <LoadingSkeletonCard variant={variant} count={count} />
    </div>
  );
}
