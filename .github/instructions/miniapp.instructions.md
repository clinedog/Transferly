---
applyTo: "miniapp/**"
---

# Transferly Mini App ownership and workflow

- Keep app flows map to page → component → shared service/context → tests.
- Reuse the current library, component, and style patterns in the Mini App before introducing new UI primitives.
- Keep frontend work aligned with the current Tailwind/theme configuration and existing Telegram Mini App integration conventions.
- Prefer Playwright e2e checks for user-facing flows and add or update the smallest affected test for changed behavior.
- When a Mini App change affects API payloads or provider states, trace the corresponding API contract before editing.

## Shared skill routing
- Mini App architecture, pages, and components → `intent-miniapp`
- Frontend components and responsive UI → `intent-frontend` or `intent-uiux`
- Playwright/e2e coverage → `intent-playwright`
- API contracts consumed by the Mini App → `intent-api`
- Security/observability or release checks → `intent-security` / `intent-observability` / `intent-release`
