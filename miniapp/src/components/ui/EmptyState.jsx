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
  body,
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
          className="miniapp-touch-target miniapp-pressable mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--tg-button-color)] px-5 text-sm font-black text-[var(--tg-button-text-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--miniapp-focus-ring)]"
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
          className="miniapp-touch-target miniapp-pressable mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--tg-button-color)] px-5 text-sm font-black text-[var(--tg-button-text-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--miniapp-focus-ring)]"
        >
          {actionLabel}
          <ArrowRight size={14} />
        </Link>
      );
    }

    return (
      <a
        href={actionHref}
        className="miniapp-touch-target miniapp-pressable mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--tg-button-color)] px-5 text-sm font-black text-[var(--tg-button-text-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--miniapp-focus-ring)]"
      >
        {actionLabel}
        <ArrowRight size={14} />
      </a>
    );
  };

  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-[var(--miniapp-radius-card)] border border-dashed border-[var(--miniapp-border)] bg-[var(--miniapp-panel-bg)] text-center',
      sizeClasses[size],
      className
    )}>
      <div className={cn(
        'flex items-center justify-center rounded-2xl bg-[var(--miniapp-accent-soft)] text-[var(--miniapp-text-muted)]',
        iconSizeClasses[size]
      )}>
        <Icon size={size === 'lg' ? 32 : 24} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-black text-[var(--miniapp-text-primary)] md:text-lg">
        {title}
      </h3>
      {description || body ? (
        <p className="mt-1 max-w-sm text-sm font-semibold text-[var(--miniapp-text-secondary)]">
          {description || body}
        </p>
      ) : null}
      {renderAction()}
    </div>
  );
}