---
name: intent-uiux
description: Improve Transferly product UX, interaction design, visual hierarchy, responsiveness, and accessibility. Use for design critique, workflow redesign, forms, dashboards, or user journey improvements.
---

# Purpose

Turn user workflows into clear, low-friction, inclusive interfaces.

## Trigger conditions

Use for UX review, layout, navigation, interaction states, visual regression, or accessibility improvements.

## Best practices

Prioritize task completion and clarity over decoration. Preserve the existing design system, show system status, provide error recovery, and avoid relying on color alone.

## Workflow

1. Identify user goal, constraints, and failure points.
2. Inspect the current flow on mobile and desktop.
3. Propose the smallest coherent interaction improvement.
4. Implement reusable primitives and explicit states.
5. Validate with Playwright and accessibility checks.

## Validation checklist

- Focus order, labels, contrast, and touch targets support real use.
- Important actions have feedback and reversible/confirmed destructive paths.
- Screens remain usable under slow, empty, and error data states.

## Expected outputs

UX rationale, focused UI diff, visual/e2e evidence, and accessibility notes.
