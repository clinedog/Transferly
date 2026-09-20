# Transferly Mini App — Design System Guide

**Version**: 2026-09-20  
**Status**: Phase 15 Complete  

---

## DESIGN SYSTEM OVERVIEW

Transferly Mini App uses a unified, premium design system that ensures consistency across all user interfaces while respecting Telegram's native design language.

### Core Principles

1. **Telegram-Native First** — Respect Telegram's CSS variables and viewport constraints
2. **Semantic Consistency** — Components use semantic roles, not arbitrary colors
3. **State Clarity** — Every interaction has an explicit loading, success, error, and empty state
4. **Financial Honesty** — Financial states never hide UNKNOWN or RECONCILIATION requirements
5. **Accessibility by Default** — All components support keyboard nav, screen readers, high contrast
6. **Responsive by Design** — Every component works at 320px, tablet, and desktop
7. **Performance-Conscious** — Design decisions avoid unnecessary complexity or animation
8. **Dark Mode Native** — Optimized for Telegram's dark appearance

---

## DESIGN TOKENS

All design decisions flow from a centralized token system. Never hard-code colors, spacing, or typography.

### Location
`miniapp/src/components/ui/DesignTokens.jsx`

### Token Categories

#### Typography
```javascript
DesignTokens.typography.roles.{
  displayXl,      // Hero headlines 
  h1, h2, h3, h4, // Section headings
  bodyLarge, body, bodySmall, // Text
  label, caption, // Metadata
  financial,      // Large money amounts
}
```

**Usage in Components**:
```jsx
<h1 style={{ fontSize: DesignTokens.typography.roles.h1.size }}>
  Hello
</h1>
```

Or better, use Tailwind classes that match the design token scale.

#### Spacing
```javascript
DesignTokens.spacing = {
  0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24
}
// Use Tailwind: p-4, gap-2, mb-6, etc.
```

#### Border Radius
```javascript
DesignTokens.borderRadius = {
  sm, md, lg, xl, 2xl, 3xl, full
}
// Use Tailwind: rounded-md, rounded-2xl, etc.
```

#### Shadows
```javascript
DesignTokens.shadows = {
  none, sm, md, lg, xl, 2xl, inner,
  glass, glass-hover,
  card, card-hover
}
// Use Tailwind: shadow-md, shadow-card, etc.
```

#### Surfaces (Telegram-Aware)
```javascript
DesignTokens.surfaces = {
  app,        // Full app background (var(--miniapp-bg))
  shell,      // Shell container
  panel,      // Panel/section
  card,       // Card surface
  elevated,   // Elevated surface
  border,     // Border color
  divider,    // Divider color
}
```

**Usage**: Always use CSS variables when available:
```jsx
<div className="bg-[var(--miniapp-card-surface)]">
  Content respects Telegram theme
</div>
```

#### Semantic Status Colors
```javascript
StatusColors = {
  success: { bg, text, dot, border, icon },
  warning,
  danger,
  info,
  pending,
  processing,
  unknown,
  comingSoon,
}
```

---

## COMPONENT STATE CATALOG

Every component must support explicit states. Never leave the user guessing about what's happening.

### Location
`miniapp/src/components/ui/ComponentStateCatalog.jsx`

### Standard States for All Pages

```javascript
ComponentStatePattern.ALL_PAGES = [
  'loading',  // Data fetching
  'empty',    // No data
  'error',    // Operation failed
  'success',  // Operation succeeded
]
```

### Additional States for Financial Pages

```javascript
ComponentStatePattern.FINANCIAL_PAGES = [
  ...ALL_PAGES,
  'unknown',          // Provider outcome not confirmed
  'reconciliation',   // Provider state requires review
]
```

### Additional States for Admin Pages

```javascript
ComponentStatePattern.ADMIN_PAGES = [
  ...FINANCIAL_PAGES,
  'rate_limited',     // Too many requests
  'permission_denied', // Access denied
]
```

### Using StandardComponentStates

```jsx
import { StandardComponentStates, MiniAppState } from '../components/ui';

function MyPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  if (isLoading) {
    return <MiniAppState {...StandardComponentStates.loading} />;
  }

  if (error) {
    return <MiniAppState {...StandardComponentStates.error} />;
  }

  if (!data || data.length === 0) {
    return <MiniAppState {...StandardComponentStates.empty} />;
  }

  return <div>{/* render data */}</div>;
}
```

### Financial Transaction States

For financial operations, always use explicit state progression:

```javascript
FinancialTransactionStates = {
  REQUESTED,      // User initiated
  VALIDATING,     // Input check
  QUOTED,         // Quote shown
  AUTHORIZED,     // User confirmed
  RESERVED,       // Funds reserved
  PROCESSING,     // Provider processing
  UNKNOWN,        // ⚠️ NEVER SHOW AS SUCCESS
  COMPLETED,      // Confirmed success
  FAILED,         // Confirmed failure
  RECONCILIATION, // ⚠️ MUST NOT BE HIDDEN
  CANCELLED,      // User cancelled
  REJECTED,       // Risk/compliance rejected
}
```

### StatusBadge States

The `StatusBadge` component normalizes all status inputs and maps them to semantic labels:

```javascript
StatusBadgeStates = {
  RECONCILIATION_REQUIRED: 'Reconciliation required',
  REQUIRES_ACTION: 'Action required',
  REQUIRES_USER_ACTION: 'Action required',
  UNKNOWN: 'Reconciling',
  // ... many more
}
```

**Usage**:
```jsx
<StatusBadge status="RECONCILIATION_REQUIRED" />
// Renders: "Reconciliation required" with appropriate colors
```

**Status normalization** converts any input format to canonical form:
```javascript
normalizeStatus('RECONCILIATION_REQUIRED')  // → 'reconciliation_required'
normalizeStatus('reconciliation required')  // → 'reconciliation_required'
normalizeStatus('Reconciliation-Required')  // → 'reconciliation_required'
```

---

## COMPONENT LIBRARY

### Premium Components

#### GlassCard
Elevated card surface with glass-morphism effect.
```jsx
<GlassCard className="p-6">
  Content with premium appearance
</GlassCard>
```

#### StatusBadge
Semantic status indicator with animated dot.
```jsx
<StatusBadge status="processing" size="md" animated />
```
Sizes: `sm`, `md`, `lg`  
Statuses: All UNKNOWN/RECONCILIATION states supported

#### PremiumButton
High-touch-target button for financial actions.
```jsx
<PremiumButton variant="primary" size="lg" disabled={isLoading}>
  Confirm Payment
</PremiumButton>
```

#### PremiumInput
Accessible form input with inline validation.
```jsx
<PremiumInput
  label="Amount"
  type="text"
  pattern="[0-9.]+"
  required
/>
```

#### BalanceCard
Display wallet balance with context.
```jsx
<BalanceCard
  label="Available Balance"
  amount={1250.50}
  currency="USD"
/>
```

#### TransactionItem
Transaction row in transaction lists.
```jsx
<TransactionItem
  id="INV-001"
  type="invoice"
  status="RECONCILIATION_REQUIRED"
  amount={250.00}
  currency="USD"
  date="2026-09-20"
  recipient="client@example.com"
/>
```

#### MiniAppState
Full-page state display (loading, error, empty, success, unknown, reconciling).
```jsx
<MiniAppState
  tone="reconciling"
  title="Reconciliation required"
  description="This transaction needs review..."
  actionLabel="View details"
  onAction={() => {}}
/>
```

#### MiniAppPageContainer
Wrapper for consistent page layout and safe areas.
```jsx
<MiniAppPageContainer title="Invoices" subtitle="Manage your invoices">
  <div>{/* page content */}</div>
</MiniAppPageContainer>
```

#### BottomSheet
Mobile-friendly action sheet for decisions.
```jsx
<BottomSheet isOpen={isOpen} onClose={onClose}>
  <div>Choose an action...</div>
</BottomSheet>
```

#### ConfirmationModal
High-risk action confirmation.
```jsx
<ConfirmationModal
  isOpen={isOpen}
  title="Confirm Payout"
  description="This will send $500 to the recipient."
  onConfirm={handleConfirm}
  onCancel={handleCancel}
/>
```

---

## RESPONSIVE BREAKPOINTS

Test at minimum these viewports:

```javascript
DesignTokens.breakpoints = {
  sm: '640px',   // Mobile
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  2xl: '1536px', // Extra large
}
```

Telegram Mini App viewport is typically:
- **Width**: 320-430px (most phones)
- **Height**: 100dvh (dynamic viewport height)
- **Safe areas**: Notched devices need padding

**Mobile-first Tailwind patterns**:
```jsx
<div className="px-4 md:px-6 lg:px-8">
  {/* 16px padding on mobile, 24px on tablet, 32px on desktop */}
</div>
```

---

## ACCESSIBILITY CHECKLIST

Every component must:

- ✅ Have semantic HTML (`<button>`, `<nav>`, `<header>`, etc.)
- ✅ Support keyboard navigation (Tab, Enter, Escape, Arrow keys)
- ✅ Include ARIA labels for icons and status indicators
- ✅ Maintain focus visibility (visible ring on focus)
- ✅ Respect `prefers-reduced-motion` setting
- ✅ Support high-contrast mode
- ✅ Have touch targets ≥ 44x44px
- ✅ Use color + additional indicators (not color alone)
- ✅ Be screen-reader compatible
- ✅ Have proper heading hierarchy

**Example accessible button**:
```jsx
<button
  className="px-4 py-2 min-w-[44px] min-h-[44px] rounded-lg bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)] focus-visible:ring-2 focus-visible:ring-[var(--miniapp-focus-ring)] motion-safe:transition"
  aria-label="Submit payment of $250"
>
  Submit Payment
</button>
```

---

## ANIMATION GUIDELINES

Respect user motion preferences. All animations use `motion-safe:` prefix:

```jsx
{/* Spin only if motion is safe */}
<div className="motion-safe:animate-spin">
  <Loader2 className="h-6 w-6" />
</div>

{/* Fade in smoothly */}
<div className="motion-safe:animate-fade-in">
  Content appears
</div>
```

Available animations:
- `fade-in` / `fade-out`
- `slide-up` / `slide-down` / `slide-in-left` / `slide-in-right`
- `scale-in`
- `pulse-subtle` / `pulse-glow`
- `float`
- `shimmer`
- `spin-slow`
- `ping-soft`

---

## DARK MODE & THEMING

Transferly respects Telegram's native theme colors via CSS variables.

**Never** hard-code colors. **Always** use Telegram variables or `var(--miniapp-*)` CSS variables:

```jsx
// ✅ GOOD — Respects Telegram theme
<div className="bg-[var(--tg-bg-color)] text-[var(--tg-text-color)]">
  This respects user's Telegram theme
</div>

// ❌ BAD — Hard-coded color
<div className="bg-blue-500 text-white">
  Does not respect theme
</div>
```

Available Telegram CSS variables:
- `--tg-bg-color` — Main background
- `--tg-text-color` — Primary text
- `--tg-hint-color` — Secondary text / hints
- `--tg-link-color` — Links
- `--tg-button-color` — Button/accent color
- `--tg-button-text-color` — Button text
- `--tg-section-bg-color` — Section backgrounds
- `--tg-destructive-text-color` — Danger/destructive actions

---

## TESTING DESIGN SYSTEM

### Visual Regression Testing
Screenshots should be verified at:
- 320px (small phone)
- 414px (standard phone)
- 768px (tablet)
- 1280px (desktop)

### Accessibility Testing
Use automated checker (axe DevTools) + manual testing:
- Keyboard-only navigation
- Screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)
- High-contrast mode
- Reduced-motion mode

### Responsive Testing
Use browser DevTools viewport emulation + real devices:
- iPhone SE (375px)
- iPhone 14 (390px)
- Samsung Galaxy S20 (360px)
- iPad (768px)

---

## COMPONENT API DOCUMENTATION

See `ComponentStateCatalog.jsx` for:
- `StandardComponentStates` — Pre-built state configs
- `normalizeStatus()` — Convert any status string to canonical form
- `getComponentStateConfig()` — Get config for any state name
- `requiresReconciliationUI()` — Check if reconciliation UI needed

---

## BEST PRACTICES

### ✅ Do

1. Use semantic HTML elements
2. Consume design tokens from centralized exports
3. Support all required states for your page type
4. Test responsive behavior at multiple viewports
5. Verify accessibility with automated + manual testing
6. Use Telegram CSS variables for colors
7. Include alt text for all images
8. Test keyboard navigation
9. Respect `prefers-reduced-motion`
10. Log financial state transitions

### ❌ Don't

1. Hard-code colors
2. Use arbitrary `bg-blue-500` instead of semantic roles
3. Hide UNKNOWN or RECONCILIATION states
4. Show unconfirmed financial success
5. Use decorative animations without `motion-safe:` prefix
6. Assume screen size (mobile-first!)
7. Forget accessibility (WCAG 2.1 AA minimum)
8. Skip state handling (no "loading" state = confusing UX)
9. Trust client-side balance calculations
10. Combine color + indicator omission for status (always add label)

---

## TROUBLESHOOTING

### "My component looks weird in Telegram"
→ Check that you're using Telegram CSS variables. Hard-coded colors won't respect the user's theme.

### "Text is tiny on mobile"
→ Use responsive font sizes with clamp() or Tailwind's responsive prefixes.

### "Button is hard to tap"
→ Ensure touch target is at least 44x44px. Use `min-h-[44px] min-w-[44px]`.

### "Animation is jarring"
→ Wrap in `motion-safe:` class. Respect user's system motion preferences.

### "Screen reader doesn't announce my status"
→ Add `aria-label` to status indicators. Use `role="status"` for dynamic content.

### "UNKNOWN state showing as SUCCESS"
→ Import `StandardComponentStates.unknown` instead of guessing. Use explicit state mapping.

---

## GETTING HELP

- **Design System Questions** → See `DesignTokens.jsx`
- **Component API** → See `ComponentStateCatalog.jsx`
- **Accessibility** → Check Tailwind docs for `aria-*` patterns
- **Responsive Behavior** → Test in browser DevTools at multiple viewports
- **Telegram Integration** → Review [Telegram Mini Apps docs](https://docs.telegram-mini-apps.com/)

---

**Phase 15 Status**: ✅ COMPLETE  
**Next Phase**: Phase 16 — Responsive Design & Accessibility  
**Updated**: 2026-09-20T16:15Z
