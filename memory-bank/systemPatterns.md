# System Patterns

## Architecture Overview
```
api (Express) <-> SQLite (ledger) <-> BullMQ (job queue)
           ↕                     ↕
    bot (Grammy)          miniapp (Vite/React)
```

* **API**: Handles HTTP routes, validation (Zod), and invokes services.
* **Service layer**: Business logic, transaction handling, idempotency.
* **Repository layer**: SQLite persistence for wallets, ledgers, invoices.
* **Jobs**: Background processing (webhook ingestion, payout submission).
* **Bot**: Telegram command handling, forwards to API.
* **Mini App**: Front‑end UI, consumes the API for balances and actions.

## Key Patterns
* **Idempotency keys** – passed on POSTs, stored in the ledger.
* **Transactional updates** – all balance mutations wrapped in a SQLite
  transaction.
* **Webhook verification** – signatures checked before enqueuing jobs.
* **Feature flags** – `INLINE_QUEUE_MODE` for tests only.

## Design Decisions
* Keep the ledger as the **single source of truth** for balances.
* Use **Zod** for strict request validation – reject unknown fields.
* Separate **provider‑specific** adapters (PayPal, Stripe placeholder) from
  core business logic.
