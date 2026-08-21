# Transferly API Backend Strategy

Status: selected for the current architecture implementation on 2026-07-16 and updated for the AdonisJS legacy preference.

## Selected Path

Transferly keeps the existing `api/` runtime as Node.js, CommonJS, Express, SQLite, Redis/BullMQ, Zod, and Pino while the current foundational architecture phases are implemented.

New backend work should follow the Laravel/Adonis-inspired module structure from `docs/transferly.md` and stay easy to migrate into AdonisJS legacy controllers, routes, middleware, services, repositories, and migrations:

- `routes/` own transport wiring.
- `controllers/` parse request data and return HTTP responses.
- `schemas/` validate payloads with Zod.
- `services/` own business workflows, authorization-sensitive transitions, and transactions.
- `repositories/` own SQL and record mapping.
- `middleware/` owns request authentication and policy gates.
- `jobs/`, `webhooks/`, and provider adapters own side effects.
- `db/schema.sql` and `db/migrate.js` own database compatibility.
- `test/` owns regression coverage for each phase.

## AdonisJS Legacy Target

The preferred target backend framework is AdonisJS legacy v4.1 CommonJS. The legacy framework uses CommonJS controller classes exported with `module.exports`, route-to-controller mappings such as `Route.get(url, 'UserController.index')`, and an API blueprint that can be introduced as a parallel backend.

Transferly should not rewrite the current API in one step. The AdonisJS legacy migration should be introduced as a parallel versioned backend after authentication, ledger reservations, service catalogue, order state, worker recovery, and release gates are stable enough to protect parity. That migration should preserve existing API contracts, migrate endpoints one at a time, run old and new backends in parallel during verification, and remove the Express runtime only after production checks pass.

Until the parallel backend exists, current modules should be written so their business logic can move behind Adonis controllers without changing behavior. Controllers must stay thin, services must own transactions and state transitions, repositories must own persistence, and tests must describe contracts rather than framework internals.
