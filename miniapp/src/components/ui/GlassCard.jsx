/**
 * GlassCard - Glassmorphism Container with Premium Styling
 * Creates beautiful frosted glass effect cards with smooth interactions
 */

import React from 'react';

export function GlassCard({ children, className = '', interactive = true }) {
  return (
    <div className={`
      miniapp-surface-card backdrop-blur-md
      ${interactive ? 'miniapp-surface-card-interactive' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}
