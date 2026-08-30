/**
 * EmptyState - Consistent, Helpful Empty States
 * Provides context and next action for every empty data scenario
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Inbox } from 'lucide-react';
import { cn } from './DesignTokens';

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  actionLabel,
  actionTo,
  actionHref,
  className = '',
  size = 'md',
}) {
  const sizeClasses = {
    sm: 'py-6 px-4',
    md: 'py-10 px-6',
    lg: 'py-16 px-8',
  };

  const iconSizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-14 w-14',
    lg: 'h-20 w-20',
  };

  const renderAction = () => {
    if (!action && !actionTo && !actionHref) return null;

    if (action) {
      return (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.99]"
        >
          {action.label}
          <ArrowRight size={14} />
        </button>
      );
    }

    if (actionTo) {
      return (
        <Link
          to={actionTo}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
        >
          {actionLabel}
          <ArrowRight size={14} />
        </Link>
      );
    }

    return (
      <a
        href={actionHref}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
      >
        {actionLabel}
        <ArrowRight size={14} />
      </a>
    );
  };

  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 text-center',
      sizeClasses[size],
      className
    )}>
      <div className={cn(
        'flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400',
        iconSizeClasses[size]
      )}>
        <Icon size={size === 'lg' ? 32 : 24} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-black text-slate-900 md:text-lg">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm font-semibold text-slate-500">
          {description}
        </p>
      ) : null}
      {renderAction()}
    </div>
  );
}