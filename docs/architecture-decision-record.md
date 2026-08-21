# Architecture Decision Record: Backend Strategy

Date: 2026-07-23

Decision
--------
Retain the existing Express/CommonJS backend and reorganize it into a modular, Laravel/Adonis-inspired structure (routes, middleware, controllers, schemas/validators, policies, services, repositories, presenters, events/listeners, jobs, adapters, webhooks, migrations, tests).

Context
-------
- The repository already contains a working CommonJS Express API.
- Miniapp uses ESM/React; bot and API use CommonJS.
- Minimizing migration risk and preserving API contracts is essential.

Chosen Approach
---------------
- Keep Express + CommonJS as the canonical backend implementation.
- Reorganize code into the modular layout described in docs/transferly.md (api/{routes,middleware,controllers,services,repositories,...}).
- Add compatibility repositories/adapters where needed to avoid breaking consumers.

Migration Plan
--------------
1. Baseline review (completed).
2. Create this ADR and decision record.
3. Add incremental database migrations and compatibility repositories.
4. Stabilize Telegram authentication and owner/admin reconciliation.
5. Implement workspace bootstrap, wallet/ledger, reservations, service catalogue, order state machine, and background pipeline incrementally.
6. Add tests and Playwright validations before removing legacy code.
7. Deploy behind feature flags and enable modules gradually.

Consequences
------------
- Lowers immediate rewrite risk and keeps existing integrations working.
- Requires disciplined refactoring and compatibility layers; more incremental work but safer.
- Maintains simpler local developer experience (CommonJS) while Mini App stays ESM.

Risks & Mitigations
-------------------
- Risk: accidental API contract changes. Mitigation: contract tests and integration tests.
- Risk: cross-module coupling. Mitigation: enforce layered boundaries (controllers → services → repositories).

Next Steps
----------
- Begin add-database-migrations (next todo in sequence) and create migration checklist.

Authors
-------
- Drafted by: Copilot CLI automation

(End of ADR)