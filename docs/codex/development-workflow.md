# Transferly development workflow

Use this workflow for every task: **Inspect → Plan → Implement → Test → Verify → Refine → Report**.

## Inspect

- Read `AGENTS.md`, the owning package, and a local analog before editing.
- For API work, trace routes, controllers, services, repositories, schemas, jobs, and tests.
- For payment, webhook, OAuth, or provider behavior, consult the nearest local provider reference before changing behavior.

## Plan and implement

- Keep the diff focused and preserve module ownership.
- Reuse shared components/helpers and avoid duplicate logic.
- Keep HTTP transport in routes/controllers, business logic in services, persistence in repositories, and external side effects in adapters/jobs/webhooks.
- Use Zod validation at API boundaries. Wrap balance changes in SQLite transactions; preserve idempotency and audit trails.

## Test and verify

Run the fastest affected command first, then widen verification for shared, payment, auth, deployment, or user-facing behavior.

```bash
npm run lint --prefix api
npm run db:migrate --prefix api
npm test --prefix api
npm test --prefix bot
npm run build --prefix miniapp
npm run test:e2e:list --prefix miniapp
npm run test:e2e --prefix miniapp
```

Use these release gates for production-bound changes:

```bash
npm run check:production
npm run verify:staging
npm run check:miniapp:bundle
npm run scan:secrets
npm run verify:release
```

## Report

State the change, validation actually run, blocked checks and their prerequisites, and remaining risks. Never log or include secrets, bearer tokens, webhook headers, or raw sensitive payloads.
