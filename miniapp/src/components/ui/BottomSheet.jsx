import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = 'Close',
  className = '',
  panelClassName = ''
}) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const closeRef = React.useRef(null);

  React.useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus?.(), 0);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] flex items-end justify-center px-3 sm:items-center sm:px-4 ${className}`}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/62 backdrop-blur-sm"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={`miniapp-enter relative z-10 w-full max-w-[560px] rounded-t-[28px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-bg)] p-4 pb-[calc(var(--miniapp-safe-area-bottom,0px)+1rem)] text-[var(--tg-text-color)] shadow-[0_30px_90px_rgba(0,0,0,0.48)] sm:rounded-[28px] sm:p-5 ${panelClassName}`}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--miniapp-divider-color,rgba(148,163,184,0.3))] sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? (
              <h2 id={titleId} className="text-lg font-black text-[var(--tg-text-color)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm font-semibold leading-6 text-[var(--tg-hint-color)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            className="miniapp-pressable miniapp-touch-target inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] text-[var(--tg-hint-color)] hover:text-[var(--tg-text-color)]"
            aria-label={closeLabel}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4">{children}</div>

        {footer ? (
          <div className="mt-4 border-t border-[var(--miniapp-border-color)] pt-4">
            {footer}
          </div>
        ) : null}
      </section>
    </div>,
    document.body
  );
}
