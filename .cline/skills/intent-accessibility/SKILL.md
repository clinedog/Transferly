---
name: intent-accessibility
description: Improve Transferly Mini App and admin accessibility across keyboard, screen readers, color contrast, focus management, motion, forms, dialogs, tables, and touch targets.
---

# Purpose

Make financial workflows usable and understandable for all users.

## Workflow

1. Inspect the component and nearest user-flow test.
2. Check semantic structure, labels, focus order, keyboard behavior, and error announcements.
3. Verify contrast, reduced motion, responsive layout, and touch targets.
4. Add automated and browser-assisted assertions.
5. Recheck loading, empty, error, confirmation, and destructive states.

## Validation checklist

- Every control has an accessible name.
- Dialogs trap and restore focus correctly.
- Errors are associated with fields and announced.
- Color is not the only status signal.
- Mobile controls meet usable touch target sizes.

