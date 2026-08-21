---
name: intent-playwright
description: Use the official Playwright skill with Transferly-specific Mini App end-to-end, visual, and browser workflow checks. Use for Playwright specs, browser regressions, snapshots, or interaction validation.
---

# Purpose

Provide Transferly context around the installed official `playwright` skill rather than replacing it.

## Trigger conditions

Use for miniapp/tests, browser flows, screenshots, visual regressions, or e2e CI failures.

## Best practices

Read the official `playwright` skill first. Prefer stable user-visible selectors, isolate test data, test Telegram runtime fallbacks, and cover mobile viewport behavior.

## Workflow

1. Inspect the page, route, and nearest test.
2. Run `npm run test:e2e:list --prefix miniapp` before editing.
3. Add deterministic user-flow assertions and needed fixtures.
4. Run the focused test, then the relevant suite.
5. Review screenshots and report browser prerequisites.

## Validation checklist

- Selectors do not depend on incidental layout or timing.
- Tests assert visible behavior and error recovery.
- Snapshots are updated only for intended visual changes.

## Expected outputs

Stable e2e coverage, browser verification output, and snapshot rationale when applicable.
