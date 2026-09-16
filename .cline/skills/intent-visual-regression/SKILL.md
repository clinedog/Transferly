---
name: intent-visual-regression
description: Validate Transferly Dracula-themed Mini App and admin visual quality, responsive layouts, card overlap, overflow, typography, dialogs, tables, and state variants with browser screenshots.
---

# Purpose

Protect the shared design system from responsive and visual regressions.

## Workflow

1. Identify the shared primitive and all affected surfaces.
2. Test target mobile and desktop viewports.
3. Capture stable screenshots for loading, empty, success, warning, error, and dense data states.
4. Fix layout at the shared component layer where possible.
5. Review keyboard and reduced-motion behavior alongside screenshots.

## Validation checklist

- No card overlap or horizontal overflow.
- Shared spacing, typography, status badges, and focus states remain consistent.
- Tables become mobile cards or sheets instead of shrinking unreadably.
- Financial warnings remain visually prominent and unambiguous.

