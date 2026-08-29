---
paths:
  - "miniapp/src/**"
  - "miniapp/tests/**"
---
# Telegram Mini App Rules

- Design for Telegram mobile widths first; keep primary actions reachable and touch targets at least 44px where practical.
- Use the API as authority for balances, prices, funding, provider state, and order status.
- Distinguish submitted, processing, confirmed, failed, and unknown financial states in both text and visuals.
- Keep unavailable services visible only as Coming Soon; they must not call provider APIs, create orders, or charge points.
- Prefer targeted loading/error states over blocking the full shell.
- Run changed-file ESLint, the production build, and the narrowest Playwright journey/list.