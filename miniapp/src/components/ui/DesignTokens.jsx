/**
 * Transferly Design Tokens
 * Single source of truth for design language across Mini App and Admin
 */

export const DesignTokens = {
  // Typography
  typography: {
    fontFamily: {
      sans: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
    fontSize: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem',      // 48px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
    lineHeight: {
      tight: 1.1,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
    },
    letterSpacing: {
      tight: '-0.04em',
      normal: '0',
      wide: '0.02em',
      wider: '0.16em',
    },
    // Named roles keep page-level typography consistent without coupling
    // components to arbitrary Tailwind sizes.
    roles: {
      displayXl: { size: 'clamp(2.25rem, 9vw, 4rem)', lineHeight: 1.05, weight: 900 },
      displayL: { size: 'clamp(2rem, 7vw, 3rem)', lineHeight: 1.1, weight: 900 },
      displayM: { size: 'clamp(1.75rem, 6vw, 2.25rem)', lineHeight: 1.15, weight: 800 },
      h1: { size: '1.875rem', lineHeight: 1.2, weight: 900 },
      h2: { size: '1.5rem', lineHeight: 1.25, weight: 800 },
      h3: { size: '1.25rem', lineHeight: 1.35, weight: 800 },
      h4: { size: '1.125rem', lineHeight: 1.4, weight: 800 },
      bodyLarge: { size: '1.125rem', lineHeight: 1.55, weight: 500 },
      body: { size: '1rem', lineHeight: 1.5, weight: 500 },
      bodySmall: { size: '0.875rem', lineHeight: 1.45, weight: 500 },
      label: { size: '0.75rem', lineHeight: 1.3, weight: 800 },
      caption: { size: '0.6875rem', lineHeight: 1.35, weight: 700 },
      metadata: { size: '0.75rem', lineHeight: 1.35, weight: 700 },
      button: { size: '0.875rem', lineHeight: 1.2, weight: 800 },
      navigation: { size: '0.75rem', lineHeight: 1.2, weight: 800 },
      financial: { size: 'clamp(1.75rem, 8vw, 2.75rem)', lineHeight: 1.05, weight: 900 },
    },
  },

  // Spacing scale
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.375rem',    // 6px
    md: '0.5rem',      // 8px
    lg: '0.75rem',     // 12px
    xl: '1rem',        // 16px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    full: '9999px',
  },

  // Shadows
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    glass: '0 18px 48px rgba(0,0,0,0.18)',
    'glass-hover': '0 28px 80px rgba(0,0,0,0.22)',
    card: '0 18px 50px rgba(15,23,42,0.06)',
    'card-hover': '0 24px 64px rgba(15,23,42,0.08)',
  },

  // Semantic surfaces and borders map to the Telegram-aware CSS variables.
  surfaces: {
    app: 'var(--miniapp-bg)',
    shell: 'var(--miniapp-shell-bg)',
    panel: 'var(--miniapp-panel-bg)',
    card: 'var(--miniapp-card-surface)',
    elevated: 'var(--miniapp-surface-elevated)',
    border: 'var(--miniapp-border)',
    divider: 'var(--miniapp-divider)',
  },

  // Dracula-inspired semantic palette. Components should consume semantic
  // roles rather than hard-coding palette values.
  dracula: {
    background: '#282a36',
    surface: '#44475a',
    surfaceElevated: '#4d5064',
    foreground: '#f8f8f2',
    muted: '#6272a4',
    primary: '#bd93f9',
    accent: '#ff79c6',
    success: '#50fa7b',
    warning: '#f1fa8c',
    danger: '#ff5555',
    info: '#8be9fd',
  },

  // Transitions/Animation
  transitions: {
    fast: '150ms ease-out',
    normal: '200ms ease-out',
    slow: '300ms ease-out',
    spring: '400ms cubic-bezier(0.16, 1, 0.3, 1)',
  },

  // Z-index
  zIndex: {
    hide: -1,
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    modal: 1300,
    popover: 1400,
    toast: 1500,
    tooltip: 1600,
  },

  // Touch targets
  touchTarget: {
    minimum: '44px',
    comfortable: '48px',
    generous: '56px',
  },

  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};

// Status color palette - Semantic, consistent across the app
export const StatusColors = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  pending: {
    bg: 'bg-slate-50 dark:bg-slate-900/20',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500',
    border: 'border-slate-200 dark:border-slate-800',
    icon: 'text-slate-600 dark:text-slate-400',
  },
  processing: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-500',
    border: 'border-indigo-200 dark:border-indigo-800',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
  unknown: {
    bg: 'bg-slate-100 dark:bg-slate-800/30',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500',
    border: 'border-slate-300 dark:border-slate-700',
    icon: 'text-slate-600 dark:text-slate-400',
  },
  comingSoon: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
    border: 'border-purple-200 dark:border-purple-800',
    icon: 'text-purple-600 dark:text-purple-400',
  },
};

// Helper function for conditional class names
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default DesignTokens;