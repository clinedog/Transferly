# Tech Context

This repository is a **monorepo** with three primary packages:

| Package | Language / Runtime | Key Frameworks | Main Responsibilities |
|---------|-------------------|----------------|-----------------------|
| **api** | Node.js (CommonJS) v18 | Express, Zod, SQLite, BullMQ, Pino | HTTP API, ledger persistence, webhook processing |
| **bot** | Node.js (CommonJS) v18 | grammY, Axios, SQLite | Telegram operations bot, command/menu handling |
| **miniapp** | Node.js (ESM) v18 | Vite, React, Tailwind, Supabase client | Front‑end Mini App UI, API client wrapper, Playwright e2e tests |

### Build / Test commands (used by Cline)
* `npm run lint --prefix api`
* `npm test --prefix api`
* `npm test --prefix bot`
* `npm run test:icons`
* `npm run build --prefix miniapp`
* `npm run test:e2e:list --prefix miniapp`

### Skills available (Cline can invoke automatically)
The `.cline/skills/` directory contains **intent‑based skills** that map to the
core responsibilities of each package. When a task mentions API routes,
bot‑commands, or Mini App UI, Cline should select the matching skill:

* `intent-api` – for any changes to Express routes, Zod schemas, services,
  repositories, provider adapters, or webhooks.
* `intent-bot` – for Telegram bot command modules, callback handling, session
  state, or bot‑side utilities.
* `intent-miniapp` – for React components, pages, contexts, API client usage,
  Tailwind UI, or Playwright e2e tests.
* Additional supporting skills exist (e.g., `intent-ledger`, `intent-test`,
  `intent-security`, `intent-observability`, `intent-build`, etc.) and can be
  invoked automatically based on the domain of the requested change.

### Recommended use
Whenever a user asks for a change, Cline should:
1. **Identify the package** affected.
2. **Select the corresponding intent skill** (or a combination if cross‑package).
3. **Execute the skill** before planning edits – this gives Cline built‑in
   awareness of best‑practice checklists and validation steps.

Keeping this awareness up‑to‑date ensures that any future work automatically
benefits from the structured guidance in each skill's `SKILL.md`.
