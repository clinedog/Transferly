# Transferly Project Instructions

## Intent
- Build and maintain Transferly across the API, Telegram bot, and Telegram Mini App.
- Keep payment, ledger, webhook, and user-facing flows modular, auditable, and operationally safe.

## Senior Engineering Operating Mode
- Act as a senior engineering partner for this repository: inspect first, make the smallest correct change, and verify with evidence before claiming success.
- Favor a focused diff, preserve established module ownership, and reuse existing patterns in the touched package before adding new abstraction.
- Work effectively and accurately by tracing the relevant route, controller, service, repository, schema, job, webhook, and test path before editing.
- When a task crosses payment, security, auth, or provider boundaries, widen verification to the next relevant guardrail instead of stopping at a single local check.
- Prefer crisp, readable, maintainable code and explain tradeoffs briefly when a better design choice or risk is involved.

## Compact Mode + Memory Discipline
- Use compact mode deliberately when context grows: keep the working plan short, restate the current state in a few bullets, and rely on `/compact` when needed.
- Remember the repository’s durable context and write useful notes into session or repository memory when they are likely to help future tasks, especially for workflow patterns, cross-package impacts, and verification evidence.
- Treat memory as an operating aid, not a substitute for fresh verification: store lessons and plans, but rerun the proving command before reporting a result.

## Stack Constraints
- `api/`: Node.js, CommonJS, Express, SQLite, Redis/BullMQ, Zod, Pino.
- `bot/`: Node.js Telegram operations bot using grammY-style command/callback modules.
- `miniapp/`: Vite, React, Tailwind CSS, Supabase client, Playwright e2e tests.

## Repository Workflow
- Start with a focused, reviewable diff that moves the requested package or workflow forward.
- Match the existing module boundaries for the touched package before introducing new structure.
- Run package-manager commands with `--prefix api`, `--prefix bot`, or `--prefix miniapp`.
- Keep transport logic in controllers/routes, business logic in services, persistence in repositories, and side effects in jobs/webhooks.
- Prefer additive changes over premature abstraction.
- Do not expose PayPal secrets, bearer tokens, webhook headers, or raw event payloads in logs.
- Do not commit real `.env` files, production SQLite data, tokens, or service-role keys.

## Public Reference Research
- For a request to match, recreate, or improve a feature based on a public product, repository, SDK, or design system, first inspect relevant public reference repositories and official documentation before implementing.
- For every enhancement request, proactively suggest a small set of relevant public reference codebases or official implementations when they would materially improve the design, reliability, accessibility, test coverage, or delivery plan. Explain the adaptation rationale, and research the selected reference before implementation unless the request is a local bug fix or the user asks not to browse.
- Use references to understand user flows, component composition, responsive behavior, and test patterns; do not copy source code, proprietary assets, credentials, or branding wholesale.
- Prefer official documentation and maintained upstream repositories. Record the concrete reference and the adaptation rationale in the final report when it materially shaped the change.
- Keep Transferly's domain model, accessibility standards, security defaults, and internal ledger/provider boundaries authoritative when a reference conflicts with them.
- Skip external reference research only when the request is a local bug fix or the user explicitly asks not to browse; state that choice when it is material.

## Skill Selection Guide

Use the task-specific skill from `.cline/skills/` (also available through the `.codex/skills` compatibility bridge) when it matches the work:

| Task | Skill |
|------|-------|
| HTTP endpoints, webhooks, Zod schemas, provider adapters | `intent-api` |
| Security review, auth changes, secret handling, threat analysis | `intent-security` |
| Production readiness, launch gates, post-incident review | `intent-production-audit` |
| Wallet, ledger, points, payouts, invoices, financial reconciliation | `intent-ledger` |
| Provider/Telegram webhooks, signature verification, replay/deduplication | `intent-webhooks` |
| Queue workers, retries, dead letters, recovery/replay, job deduplication | `intent-queue-recovery` |
| Logs, metrics, health/readiness, incident diagnostics | `intent-observability` |
| Exceptions, flaky tests, regressions, unexpected behavior | `intent-debug` |
| Schema changes, backfills, constraints, migration failures | `intent-migrations` |
| New modules, code generation, scaffolding | `intent-codegen` |
| Code review, maintainability, refactoring | `intent-review` / `intent-refactor` |
| Release candidates, go/no-go decisions, release notes | `intent-release` |
| EC2/PM2 deployment, environment config, rollout plans | `intent-deploy` |
| Playwright e2e tests, visual regression, browser automation | `intent-playwright` |
| Mini App React/Tailwind/Supabase work | `intent-miniapp` |
| Telegram bot commands, callbacks, session state | `intent-bot` |
| Frontend components, accessibility, responsive layouts | `intent-frontend` / `intent-uiux` |
| Build pipeline, bundle checks, CI configuration | `intent-build` |
| Performance profiling, query optimization, bundle size | `intent-performance` |
| Research synthesis, provider docs, external API behavior | `intent-research` |
| Unit/integration test coverage | `intent-test` |
| Documentation artifacts | `intent-docs` |

Invoke explicitly when useful: `Use $intent-api to add this endpoint.`

## Deep Work Defaults
- Inspect the owning package plus at least one local analog before editing.
- Trace impacted routes, services, repositories, tests, and UI entry points when a change crosses package or payment boundaries.
- Prefer `rg`, package scripts, and existing helper scripts for broad checks before adding new tooling.
- When a first verification check passes, run the next most relevant check if the change affects shared behavior, payment state, auth, deployment, or user-facing flows.
- Capture follow-up risks explicitly instead of silently narrowing scope.

## Security Defaults (from `security-best-practices` + `intent-security`)

Apply these at all times — not only during explicit security reviews:

### Input & Validation
- Validate all external input with Zod at API boundaries; reject unknown fields.
- Treat webhook payloads, Telegram updates, and provider callbacks as untrusted until verified.
- Sanitize request URLs before logging (`api/utils/sanitizeRequestUrl.js`).

### Authentication & Authorization
- Enforce bearer auth on all `/api/admin/*` routes via `ADMIN_API_TOKEN`.
- Enforce user-scoped bearer auth via `USER_API_TOKENS` on user routes.
- Verify Telegram Mini App `initData` HMAC before trusting session identity.
- Never trust `x-admin-actor-id` without prior admin auth middleware.

### Secrets & Logging
- Never log PayPal client secrets, bearer tokens, webhook headers, or raw sensitive payloads.
- Never commit `.env` files, production SQLite databases, or service-role keys.
- Run `npm run scan:secrets` before any release-bound commit.

### Payment & Ledger Safety
- The internal ledger is the balance source of truth — never trust provider status alone.
- Wrap all wallet/ledger mutations in SQLite transactions.
- Use deterministic idempotency keys for payout submission and webhook ingestion.
- Persist externally meaningful state transitions before acknowledging completion.
- Record audit logs for: invoice creation, payout requests, approvals/rejections, webhook processing, ledger mutations.

### Webhook Security
- Verify PayPal webhook signatures using the raw request body before processing.
- Verify Telegram webhook secret header before processing bot updates.
- Persist webhook receipts before enqueuing async processing.

### Dependency & Configuration
- Run `npm audit --omit=dev --prefix <package>` when adding or updating dependencies.
- Validate required environment variables at startup; fail fast with a clear error.
- Keep `INLINE_QUEUE_MODE=true` only for tests — never in production.

## Backend Conventions
- Use idempotency for payout submission and webhook ingestion.
- Persist every externally meaningful state transition in the database before acknowledging it as complete.
- Trust the internal ledger for balances, not PayPal resource status alone.
- Wrap balance-changing operations in database transactions.
- Record audit logs for invoice creation, payout requests, approval/rejection actions, webhook processing, and ledger mutations.
- Prefer enum-backed state machines over free-form status strings when data is persisted.

## Shared Agent Toolkit
- Use the repository-local skills in `.cline/skills/` for reusable workflows. The `.codex/skills` path is a compatibility bridge to the same files for Codex; keep one canonical copy.
- Use `docs/codex/` for project workflow and reference material; it is the repository source of truth for these documents.
- Run `npm run validate:skills` after changing shared skills or their compatibility bridge.
- For browser-assisted research and testing, prefer isolated sessions and never store passwords, tokens, cookies, private browser state, or personal data.

## Targeted Docs Policy For This Repo
- Load the relevant repository-local skill from `.cline/skills/` when available.
- For PayPal invoice, payout, OAuth, webhook, or provider adapter contract changes, consult the nearest local reference and official provider docs when endpoint behavior, payload shape, auth, idempotency, or webhook verification is relevant.
- For new modules or cross-package infrastructure, consult `docs/codex/references/project-architecture.md` when the existing package layout does not make ownership clear.
- If docs and local code disagree on an externally meaningful behavior, call out the mismatch before patching.

## Verification
- Use the fastest relevant checks first.
- Codex setup checks:
  - `rg --version`
  - `npm run validate:skills`
- API checks:
  - `npm run lint --prefix api`
  - `npm run db:migrate --prefix api`
  - `npm test --prefix api`
- Bot checks:
  - `npm test --prefix bot`
- Miniapp checks:
  - `npm run build --prefix miniapp`
  - `npm run test:e2e:list --prefix miniapp`
  - `npm run test:e2e --prefix miniapp`
- Release gate checks:
  - `npm run check:production`
  - `npm run verify:staging`
  - `npm run check:miniapp:bundle`
  - `npm run scan:secrets`
  - `npm run verify:release`
- If a check cannot run, state the exact missing prerequisite.

## Workflow: Inspect → Plan → Implement → Test → Verify → Refine → Report

### Inspect
- Read `AGENTS.md`, the owning package, and a local analog before editing.
- For API work, trace routes → controllers → services → repositories → schemas → jobs → tests.
- For payment, webhook, OAuth, or provider behavior, consult the nearest local provider reference.

### Plan & Implement
- Keep the diff focused; preserve module ownership.
- Reuse shared helpers; avoid duplicate logic.
- HTTP transport in routes/controllers, business logic in services, persistence in repositories, side effects in adapters/jobs/webhooks.

### Test & Verify
- Run the fastest affected check first, then widen for shared/payment/auth/deployment changes.
- Never represent unrun checks as passing.

### Report
- State the change, validation actually run, blocked checks with prerequisites, and remaining risks.
- Never include secrets, tokens, webhook headers, or raw sensitive payloads in reports or logs.

<!-- BUS:START -->
## 🔴 LIVE BOARD — read this before you touch anything

_Generated 2026-09-20T12:55Z. Do not edit by hand — it is overwritten by the extension / `agent-bus.mjs sync`._

**⚠️ 2 WARNING(S) — your next run may be affected:**
- `emu37qfu6iap8` **copilot**: User operations now prompts for reason and confirmation before points adjustments and loads authoritative finance profiles; no general audit-log API exists, so no synthetic audit UI was added.
- `emu3ej6oljlud` **copilot**: Failure-injection test exposed and fixed classification ordering bug: PROVIDER_TIMEOUT now maps to timeout instead of generic provider failure, preserving retry semantics.

**📌 CLAIMED RIGHT NOW (1) — do NOT edit these paths:**
- **Transferly**: miniapp/**, api/**, docs/mini.md, path:docs/codex — expires 14:55Z — Starting execution of all remaining phases in mini.md (Phases 15-28): design system, responsive UX, performance, observability, security, operations, testing, documentation. Will proceed incrementally with evidence-driven verification at each phase.

Full board: use the `trc_team_read` tool, or run `agent-bus.mjs read --agent <you>`.
<!-- BUS:END -->
