# Transferly agent rules

These rules make the repository's existing instructions available to Cline without creating a second source of truth.

## Canonical project guidance

- Read `AGENTS.md` before making changes. It is the canonical project policy for architecture, security, workflow, and verification.
- Use the nearest applicable documentation under `docs/codex/` for detailed conventions and architecture. In particular, consult `docs/codex/references/project-architecture.md` for cross-package or backend structure questions.
- Treat package scripts and the current implementation as authoritative when documentation and code differ; call out externally meaningful mismatches before changing behavior.

## Package boundaries

- `api/`: CommonJS Node.js/Express API with SQLite, Redis/BullMQ, Zod, and Pino.
- `bot/`: Node.js Telegram operations bot with grammY-style command/callback modules and SQLite persistence.
- `miniapp/`: Vite/React/Tailwind Telegram Mini App with Supabase integration and Playwright coverage.
- Keep HTTP transport in routes/controllers, business logic in services, persistence in repositories, and external side effects in adapters/jobs/webhooks.

## Safety requirements

- Treat payment, ledger, webhook, Telegram update, and provider callback data as untrusted input.
- Validate API-boundary input with Zod and reject unknown fields.
- Use SQLite transactions for wallet and ledger mutations; the internal ledger is the balance source of truth.
- Preserve deterministic idempotency and audit logging for payout, invoice, webhook, and ledger transitions.
- Never log or commit PayPal secrets, bearer tokens, webhook headers, raw sensitive payloads, real `.env` files, production databases, or service-role keys.

## Working and verification rules

- Inspect the owning package and a local analog before editing; keep changes focused and reviewable.
- Run package commands with `npm --prefix api`, `npm --prefix bot`, or `npm --prefix miniapp` (or use the equivalent root scripts).
- Run the fastest affected check first. Relevant checks include:
  - `npm run lint --prefix api`
  - `npm test --prefix api`
  - `npm test --prefix bot`
  - `npm run build --prefix miniapp`
  - `npm run test:e2e:list --prefix miniapp`
- Verify edited files and report checks that could not run, including the missing prerequisite.
- Do not revert unrelated work already present in the working tree.

## Agent-tool compatibility

- Shared skills live in `.cline/skills/`; the `.codex/skills` path is a compatibility bridge to the same files. Do not create a second copy.
- Prefer repository-local instructions, skills, and docs so the same task remains reproducible across Cline, Codex, Copilot, and other agents.
- Use `npm run validate:skills` after changing shared skills or their bridge.
