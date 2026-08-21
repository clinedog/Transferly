# Transferly project conventions

## Package ownership

- `api/`: CommonJS Express API, SQLite persistence, Redis/BullMQ jobs, Zod validation, Pino logging.
- `bot/`: Telegram operations bot with command/callback modules and API integration.
- `miniapp/`: Vite React Telegram Mini App with Tailwind and Playwright end-to-end coverage.

## Code standards

- Prefer small, cohesive modules and local reuse over broad abstractions.
- Write JavaScript consistent with surrounding code; avoid type-like comments unless they clarify a public contract.
- Add comments only for non-obvious intent, safety invariants, or external constraints.
- Remove dead paths only when their callers and behavior have been checked.

## Safety invariants

- The internal ledger is the balance source of truth.
- Persist externally meaningful state before acknowledging completion.
- Use deterministic idempotency for payouts and webhook ingestion.
- Use SQLite transactions for wallet and ledger mutations.
- Record audit events for approvals, rejections, payout requests, invoice creation, webhooks, and ledger mutations.

## Frontend quality

- Build reusable components and preserve explicit loading, error, empty, success, and disabled states.
- Use semantic HTML, labels, keyboard support, visible focus, non-color status cues, and responsive layouts.
- Test critical journeys in Playwright without production credentials or private browser state.
