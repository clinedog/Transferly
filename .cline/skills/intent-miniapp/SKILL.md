---
name: intent-miniapp
description: Build and maintain the Transferly Telegram Mini App using Vite, React, Tailwind, Supabase, and Playwright. Use for Mini App UI, state, API integration, Telegram runtime, or e2e changes.
---

# Purpose

Deliver responsive Mini App features consistent with Transferly contracts and Telegram runtime constraints.

## Trigger conditions

Use for files under miniapp/, Mini App flows, provider workspaces, API clients, or Telegram integration.

## Best practices

Reuse components and contexts, keep API calls in lib/client layers, handle loading/error/empty states, and validate behavior on mobile dimensions as well as desktop.

## Workflow

1. Inspect the page, shared component, context, and API contract.
2. Find the closest UI and state-management analog.
3. Implement accessible, responsive behavior with explicit runtime states.
4. Add or update Playwright coverage.
5. Run lint, build, and affected browser tests.

## Validation checklist

- UI has loading, error, empty, and success states.
- Controls are keyboard-accessible and usable at mobile viewport sizes.
- API errors are safe and actionable without exposing secrets.

## Expected outputs

A reusable Mini App change, test coverage, build evidence, and UX notes.
