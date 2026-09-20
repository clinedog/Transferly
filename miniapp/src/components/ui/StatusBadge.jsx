/**
 * StatusBadge - Animated Status Indicator with 6 States
 * Shows status with animated dot and semantic colors
 */

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Loader2,
  PlugZap,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle
} from 'lucide-react';

export function StatusBadge({ status = 'pending', animated = true, size = 'md', className = '' }) {
  const statusConfig = {
    unknown: {
      bg: 'bg-slate-100 dark:bg-slate-800/30',
      text: 'text-slate-700 dark:text-slate-300',
      dot: 'bg-slate-500',
      icon: AlertTriangle,
      label: 'Reconciling',
      meaning: 'Final financial state is not confirmed',
    },
    reconciling: {
      bg: 'bg-slate-100 dark:bg-slate-800/30',
      text: 'text-slate-700 dark:text-slate-300',
      dot: 'bg-slate-500',
      icon: AlertTriangle,
      label: 'Reconciling',
      meaning: 'Final financial state is not confirmed',
    },
    reconciliation_required: {
      bg: 'bg-slate-100 dark:bg-slate-800/30',
      text: 'text-slate-700 dark:text-slate-300',
      dot: 'bg-slate-500',
      icon: AlertTriangle,
      label: 'Reconciliation required',
      meaning: 'Provider outcome requires financial reconciliation',
    },
    requires_action: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      icon: AlertTriangle,
      label: 'Action required',
      meaning: 'A human review is required before the operation can continue safely',
    },
    requires_user_action: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      icon: AlertTriangle,
      label: 'Action required',
      meaning: 'A human review is required before the operation can continue safely',
    },
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
    requested: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500',
      icon: Clock3,
      label: 'Requested',
      meaning: 'Request received and awaiting eligibility checks',
    },
    risk_check: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      icon: ShieldCheck,
      label: 'Risk check',
      meaning: 'Risk and policy checks are in progress',
    },
    succeeded: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
      label: 'Succeeded',
      meaning: 'Completed successfully',
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
    auto_approved: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      icon: ShieldCheck,
      label: 'Auto-approved',
      meaning: 'Passed policy checks and can proceed automatically',
    },
    reserved: {
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      text: 'text-indigo-700 dark:text-indigo-300',
      dot: 'bg-indigo-500',
      icon: LockKeyhole,
      label: 'Reserved',
      meaning: 'Funds are reserved while processing',
    },
    submitted: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500',
      icon: Send,
      label: 'Submitted',
      meaning: 'Submitted to the provider',
    },
    reconciliation: {
      bg: 'bg-slate-100 dark:bg-slate-800/30',
      text: 'text-slate-700 dark:text-slate-300',
      dot: 'bg-slate-500',
      icon: AlertTriangle,
      label: 'Reconciliation required',
      meaning: 'Provider outcome requires reconciliation',
    },
    rejected: {
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      text: 'text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      icon: XCircle,
      label: 'Rejected',
      meaning: 'Rejected',
    },
    // Funding-specific states
    payment_instructions: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500',
      icon: Clock3,
      label: 'Awaiting Payment',
      meaning: 'Make payment to receive points',
    },
    payment_reported: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      icon: Loader2,
      label: 'Under Review',
      meaning: 'Payment evidence is being verified',
    },
    under_review: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      icon: Loader2,
      label: 'Under Review',
      meaning: 'Verification in progress',
    },
    points_credited: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
      label: 'Credited',
      meaning: 'Points added to your wallet',
    },
    needs_more_information: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-700 dark:text-orange-300',
      dot: 'bg-orange-500',
      icon: AlertTriangle,
      label: 'Info Needed',
      meaning: 'Additional details required',
    },
    awaiting_confirmation: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500',
      icon: Loader2,
      label: 'Awaiting',
      meaning: 'Waiting for confirmation',
    },
    cancelled: {
      bg: 'bg-slate-100 dark:bg-slate-800/20',
      text: 'text-slate-600 dark:text-slate-400',
      dot: 'bg-slate-500',
      icon: XCircle,
      label: 'Cancelled',
      meaning: 'Order cancelled',
    },
    expired: {
      bg: 'bg-slate-100 dark:bg-slate-800/20',
      text: 'text-slate-600 dark:text-slate-400',
      dot: 'bg-slate-500',
      icon: Clock3,
      label: 'Expired',
      meaning: 'Order expired',
    },
    draft: {
      bg: 'bg-slate-100 dark:bg-slate-800/20',
      text: 'text-slate-600 dark:text-slate-400',
      dot: 'bg-slate-500',
      icon: Sparkles,
      label: 'Draft',
      meaning: 'Not yet submitted',
    },
    live: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
      label: 'Live',
      meaning: 'Active and working',
    },
    coming_soon: {
      bg: 'bg-[var(--miniapp-accent-pink)]/10',
      text: 'text-[var(--miniapp-accent-pink)]',
      dot: 'bg-[var(--miniapp-accent-pink)]',
      icon: Sparkles,
      label: 'Coming Soon',
      meaning: 'Not yet available',
    },
    sandbox: {
      bg: 'bg-cyan-400/10',
      text: 'text-cyan-300',
      dot: 'bg-cyan-300',
      icon: PlugZap,
      label: 'Sandbox',
      meaning: 'Safe test environment; real funds are not affected',
    },
    maintenance: {
      bg: 'bg-amber-300/10',
      text: 'text-amber-200',
      dot: 'bg-amber-300',
      icon: AlertTriangle,
      label: 'Maintenance',
      meaning: 'Temporarily unavailable while maintenance is in progress',
    },
  };

  // Normalize status to match keys (handle uppercase, spaces, hyphens)
  const normalizedStatus = (status || 'pending')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  const config = statusConfig[normalizedStatus] || statusConfig.pending;
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
        className={`${config.text} ${normalizedStatus === 'processing' && animated ? 'motion-safe:animate-spin' : ''}`}
        aria-hidden="true"
      />
      <span
        className={`
          h-2 w-2 rounded-full ${config.dot}
          ${animated && normalizedStatus !== 'completed' && normalizedStatus !== 'approved' && normalizedStatus !== 'points_credited' ? 'motion-safe:animate-pulse-subtle' : ''}
        `}
        aria-hidden="true"
      />
      <span className={`font-semibold uppercase tracking-wider ${config.text}`}>
        {config.label}
      </span>
    </span>
  );
}
