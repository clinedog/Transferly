/**
 * PremiumButton - Enhanced Button Component with Variants
 * Flexible button with multiple variants (primary, secondary, outline, ghost)
 */

import React from 'react';

export function PremiumButton({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon: Icon,
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)] hover:brightness-110',
    secondary: 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-text-color)] hover:brightness-110',
    outline: 'border-2 border-[var(--miniapp-border-color)] text-[var(--tg-text-color)] hover:bg-[var(--miniapp-nav-hover-bg)]',
    ghost: 'text-[var(--tg-text-color)] hover:bg-[var(--miniapp-nav-hover-bg)]',
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-5 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading ? 'true' : undefined}
      aria-disabled={disabled || isLoading ? 'true' : undefined}
      className={`
        miniapp-pressable miniapp-touch-target inline-flex items-center justify-center gap-2 rounded-full font-bold
        motion-safe:transition motion-safe:duration-300 motion-safe:ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
        hover:shadow-md-glass disabled:active:scale-100
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {isLoading && (
        <span
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
          aria-hidden="true"
        />
      )}
      {Icon && !isLoading && <Icon size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}
