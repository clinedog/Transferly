/**
 * StatusBadge - Animated Status Indicator with 6 States
 * Shows status with animated dot and semantic colors
 */

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldCheck,
  XCircle
} from 'lucide-react';

export function StatusBadge({ status = 'pending', animated = true, size = 'md', className = '' }) {
  const statusConfig = {
    pending: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      icon: Clock3,
      label: 'Pending',
      meaning: 'Waiting for confirmation',
    },
    processing: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500',
      icon: Loader2,
      label: 'Processing',
      meaning: 'In progress',
    },
    completed: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
      label: 'Completed',
      meaning: 'Completed successfully',
    },
    failed: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      dot: 'bg-red-500',
      icon: AlertTriangle,
      label: 'Failed',
      meaning: 'Action failed',
    },
    approved: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300',
      dot: 'bg-green-500',
      icon: ShieldCheck,
      label: 'Approved',
      meaning: 'Approved',
    },
    rejected: {
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      text: 'text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      icon: XCircle,
      label: 'Rejected',
      meaning: 'Rejected',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span
      role="status"
      aria-label={`${config.label}: ${config.meaning}`}
      title={`${config.label}: ${config.meaning}`}
      className={`
      inline-flex items-center gap-2 rounded-full
      ${config.bg} ${sizeClasses[size]} ${className}
    `}
    >
      <Icon
        size={size === 'lg' ? 16 : 14}
        className={`${config.text} ${status === 'processing' && animated ? 'motion-safe:animate-spin' : ''}`}
        aria-hidden="true"
      />
      <span
        className={`
          h-2 w-2 rounded-full ${config.dot}
          ${animated && status !== 'completed' ? 'motion-safe:animate-pulse-subtle' : ''}
        `}
        aria-hidden="true"
      />
      <span className={`font-semibold uppercase tracking-wider ${config.text}`}>
        {config.label}
      </span>
    </span>
  );
}
