import React from 'react';

/**
 * Shared card surface for page content.
 *
 * The min-width and overflow rules keep cards safe inside responsive grids and
 * prevent long provider names or financial values from widening the layout.
 */
export const SurfaceCard = React.forwardRef(function SurfaceCard(
  {
    as: Component = 'section',
    children,
    className = '',
    interactive = false,
    ...props
  },
  ref
) {
  const interactiveProps = interactive
    ? {
        role: props.role || 'button',
        tabIndex: props.tabIndex ?? 0,
        onKeyDown: (event) => {
          props.onKeyDown?.(event);
          if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            props.onClick?.(event);
          }
        },
      }
    : {};

  return (
    <Component
      ref={ref}
      {...props}
      {...interactiveProps}
      className={[
        'miniapp-surface-card',
        interactive ? 'miniapp-surface-card-interactive' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </Component>
  );
});

SurfaceCard.displayName = 'SurfaceCard';

export default SurfaceCard;
