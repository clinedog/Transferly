---
paths:
  - "api/**"
---
# API and Finance Rules

- Trace route → controller → schema → service → repository → test before changing behavior.
- Validate boundary input with strict Zod schemas and enforce resource ownership server-side.
- Store uploaded evidence privately; never expose storage keys or filesystem paths.
- Keep ledger mutations transactional, idempotent, audited, and server-authoritative.
- Treat provider success as an observation until required local ledger/state effects are persisted.
- Run the narrow service/integration test first, then `npm run lint --prefix api`.