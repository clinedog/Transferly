import React from 'react';

/**
 * Shared page frame. It accounts for Telegram safe areas and the fixed
 * bottom navigation without requiring every page to repeat those constraints.
 */
export function MiniAppPageContainer({
  as: Component = 'main',
  children,
  className = '',
  ...props
}) {
  return (
    <Component
      {...props}
      className={['miniapp-page-container', className].filter(Boolean).join(' ')}
    >
      {children}
    </Component>
  );
}

export default MiniAppPageContainer;
