# 🚀 Quick Start: Phase 16 Implementation

**Location**: See [PHASE_16_28_HANDOFF.md](./PHASE_16_28_HANDOFF.md) for detailed guide

## Phase 16: Responsive Design & Accessibility (8-12 hours)

### Prerequisites Check
```bash
cd /home/ednutlabs/Transferly
npm run lint --prefix miniapp     # Should be 0 errors
npm test --prefix miniapp          # Should be 17/17 passing
```

### Core Tasks

#### 1. Accessibility Audit (3 hours)
- [ ] Run axe DevTools on every page
- [ ] Fix WCAG 2.1 AA violations (target: 0)
- [ ] Document accessibility score in `PHASE_16_COMPLETION_REPORT.md`

**Checklist**:
- Semantic HTML (proper heading hierarchy)
- ARIA labels on all interactive elements
- Color contrast ≥ 4.5:1 for text
- Focus management and visible focus indicators
- Keyboard navigation on all pages
- Alt text for all meaningful images
- Form labels associated with inputs
- Error messages linked to inputs
- No content only visible to mouse users
- Motion preferences respected (prefers-reduced-motion)

#### 2. Responsive Layout Testing (3 hours)
Test these viewports:
- [ ] 320px (iPhone SE)
- [ ] 375px (iPhone 12)
- [ ] 768px (iPad)
- [ ] 1024px (iPad Pro)
- [ ] 1440px (Desktop)

**Key breakpoints** (from `DesignTokens.jsx`):
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

#### 3. Keyboard Navigation (2 hours)
Test on every page:
- [ ] Tab through all interactive elements
- [ ] Shift+Tab goes backward
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals
- [ ] Arrow keys work in lists
- [ ] Focus never trapped
- [ ] Focus visible (ring-2 applied)

#### 4. Motion Preferences (2 hours)
- [ ] Wrap all animations with `motion-safe:` class
- [ ] Example: `motion-safe:animate-pulse` (vs. always-animating)
- [ ] Test with macOS: System Preferences > Accessibility > Display > Reduce motion

#### 5. E2E Test Coverage (2 hours)
Create `miniapp/tests/accessibility.spec.js`:
```javascript
import { test, expect } from '@playwright/test';

test('homepage keyboard navigation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  // verify focus moved
  await page.keyboard.press('Enter');
  // verify action executed
});

test('dark mode toggle respects prefers-color-scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  // verify dark styling applied
});
```

### Files to Modify

**Core components**:
- `miniapp/src/pages/*.jsx` — Add ARIA labels, keyboard handlers
- `miniapp/src/components/*.jsx` — Semantic HTML, focus management
- `miniapp/src/index.css` — motion-safe prefixes, focus styling

**Test files**:
- Create: `miniapp/tests/accessibility.spec.js`
- Create: `miniapp/tests/responsive.spec.js`

### Verification Commands
```bash
# Linting must still pass
npm run lint --prefix miniapp

# All tests must pass
npm test --prefix miniapp

# Build must succeed
npm run build --prefix miniapp

# E2E tests for accessibility
npm run test:e2e --prefix miniapp

# Audit with axe (if installed)
npm run test:a11y --prefix miniapp
```

### Success Criteria
- ✅ 0 WCAG 2.1 AA violations
- ✅ Keyboard navigation on all 7 pages
- ✅ All interactive elements have visible focus
- ✅ All animations wrapped in `motion-safe:`
- ✅ Responsive layout verified at 5 breakpoints
- ✅ All 17 tests still passing
- ✅ Linting clean
- ✅ Build succeeding

### Completion Template
Create `PHASE_16_COMPLETION_REPORT.md`:
```markdown
# Phase 16: Responsive Design & Accessibility

## Summary
✅ All responsive layouts tested  
✅ All accessibility violations fixed  
✅ Keyboard navigation verified  
✅ Motion preferences implemented  

## Verification
- Axe violations: 0
- Tests passing: 17/17
- Build: ✅
- Linting: ✅

## Pages Audited
- [ ] HomePage
- [ ] WalletPage
- [ ] InvoicePage
- [ ] PayoutPage
- [ ] ProfilePage
- [ ] SettingsPage
- [ ] AdminPage

## Responsive Viewports
- [x] 320px
- [x] 375px
- [x] 768px
- [x] 1024px
- [x] 1440px

## Accessibility Features Added
- [ ] Semantic HTML
- [ ] ARIA labels
- [ ] Focus management
- [ ] Keyboard navigation
- [ ] Motion preferences
- [ ] Color contrast
- [ ] Form labels
```

### After Phase 16
1. Commit with:
   ```bash
   git add -A
   git commit -m "Phase 16: Responsive Design & Accessibility

   ✅ 0 WCAG 2.1 AA violations
   ✅ Keyboard navigation on all pages
   ✅ Motion preferences integrated
   ✅ 5 viewports tested
   ✅ All tests passing"
   ```

2. Move to [Phase 17: Performance & Caching](./PHASE_16_28_HANDOFF.md#phase-17-performance--caching)

---

## Reference Materials
- **Design System Guide**: [docs/codex/design-system-guide.md](./docs/codex/design-system-guide.md)
- **Component States**: [miniapp/src/components/ui/ComponentStateCatalog.jsx](./miniapp/src/components/ui/ComponentStateCatalog.jsx)
- **Design Tokens**: [miniapp/src/components/ui/DesignTokens.jsx](./miniapp/src/components/ui/DesignTokens.jsx)
- **Full Handoff**: [PHASE_16_28_HANDOFF.md](./PHASE_16_28_HANDOFF.md)
- **Master Plan**: [PHASE_EXECUTION_PLAN.md](./PHASE_EXECUTION_PLAN.md)

## Questions?
- Review design system guide for component patterns
- Check existing pages for examples
- Reference ComponentStateCatalog for state handling
- Consult WCAG 2.1 AA guidelines for accessibility

---

**Estimated Time**: 8-12 hours  
**Complexity**: Medium  
**Blocking**: Nothing (can run in parallel with Phase 21 if needed)  
**Blocked By**: Phase 15 ✅ COMPLETE  

Good luck! 🎉
