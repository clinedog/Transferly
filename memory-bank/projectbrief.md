# Project Brief

**Purpose**: Provide a concise, high‑level overview of the Transferly project.

- **Goal**: Enable users to send, receive, and manage payments across multiple
  providers (PayPal, Stripe, etc.) via a unified API, a Telegram bot, and a
  Vite‑based Mini App.
- **Key Value**: Ledger‑driven balance management, idempotent operations, and a
  secure, auditable workflow.
- **Stakeholders**: End‑users, developers, ops team, compliance auditors.

## Active Program: Production Readiness

Transferly is being driven toward production by an explicit, phased plan
(`docs/transferly.md`). The core operating principle: **providers are
replaceable, the ledger is not**. Each capability carries an authoritative,
technically‑enforced readiness state (LIVE / SANDBOX / COMING_SOON / DISABLED),
and no service may be marked LIVE without evidence.

Execution order: 1 → 2 → 4 → 3 → 5 → 6 → 10 → 7 → 8 → 9 → 11 → 12 → 13 → 14 → 15.
- Phase 1 — Production Readiness Registry (in working tree)
- Phase 2 — Provider Contract, Capability & Routing Hardening (in working tree)
- Phase 4 — Financial Core, Ledger & Points Safety (next)

*This file serves as the foundational source of truth for all other Memory Bank
documents.*
