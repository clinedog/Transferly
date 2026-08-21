# Transferly Codex development environment

This repository is optimized for the workflow: **Inspect → Plan → Implement → Test → Verify → Refine → Report**. Read `AGENTS.md` before making changes; it contains the architecture, security invariants, package ownership, and required verification commands.

## Runtime and setup

The committed `.nvmrc` and devcontainer pin Node.js 20. Use the package-scoped, lockfile-clean installation command:

```bash
npm ci --prefix api
npm ci --prefix bot
npm ci --prefix miniapp
npx --prefix miniapp playwright install --with-deps chromium
```

The devcontainer installs those dependencies, enables Redis, and forwards ports 3000 (API), 5173 (Mini App), and 6379 (Redis). Run services with `npm run api:dev`, `npm run api:worker`, `npm run bot:dev`, and `npm run miniapp:dev`.

## Codex skills

Shared agent skills live in the repository-local `.cline/skills/` directory so Cline and Codex use the same canonical files. The `.codex/skills` path is a compatibility bridge to that directory. The skills cover code generation, refactoring, review, debugging, testing, security, API, Mini App, bot, frontend, UI/UX, performance, Playwright, build, release, deploy, docs, research, migrations, and production audits.

The official OpenAI `playwright` skill is available under the project-mounted `.codex/skills/playwright`; use `intent-playwright` for Transferly-specific test conventions and that official skill for browser automation guidance.

## Verification ladder

Run the fastest affected command first, then widen checks for shared, payment, auth, deployment, or user-facing changes.

```bash
npm run lint --prefix api
npm run db:migrate --prefix api
npm test --prefix api
npm test --prefix bot
npm run build --prefix miniapp
npm run test:e2e:list --prefix miniapp
npm run test:e2e --prefix miniapp
```

For release-bound work, run `npm run verify:release`. It executes the standard quality checks plus production readiness, staging, Mini App bundle, and secret-scan gates.

## Contributor safeguards

- Keep routes/controllers, services, repositories, and jobs/webhooks in their assigned layers.
- Use Zod validation at untrusted boundaries; use transactions, idempotency, and audit logs for wallet and provider transitions.
- Do not commit `.env` files, production SQLite data, service-role keys, bearer tokens, or raw webhook payloads.
- Prefer small, reviewable changes and document any prerequisite that prevents a check from running.
