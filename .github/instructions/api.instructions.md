---
applyTo: "api/**"
---

# Transferly API ownership and workflow

- Keep transport logic in routes/controllers, business logic in services, persistence in repositories, and side effects in jobs/webhooks.
- Trace the affected route, controller, service, repository, schema, job, webhook, and test path before editing.
- For payment, payout, invoice, ledger, provider, or auth work, inspect the provider adapter and the nearest local analog before changing behavior.
- Use Zod validation, idempotency keys, SQLite transactions, and audit logging for wallet and provider transitions.
- Prefer evidence over guesswork. Run the fastest relevant API verification command first and widen checks when payment, ledger, auth, or provider boundaries are involved.

## Shared skill routing
- API endpoints, validator layers, and provider adapters → `intent-api`
- Security review, auth, secret handling, threat analysis → `intent-security`
- Ledger, payouts, points, invoices, reconciliation → `intent-ledger`
- Provider and Telegram webhook processing → `intent-webhooks`
- Queue workers and recovery → `intent-queue-recovery`
- Observability and logs → `intent-observability`
- Tests and regressions → `intent-test`
