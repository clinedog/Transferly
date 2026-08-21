# Transferly Next-Generation Enhancement Strategy

Last reviewed: 2026-08-20

## Executive recommendation

Transferly already has strong foundations: verified Telegram Mini App authentication, an internal transactional ledger, idempotent payment operations, verified and replayable provider webhooks, BullMQ recovery, risk controls, audit records, release gates, browser coverage, and native Telegram UI integration.

The next step is not adding more screens or partially supported providers. It is turning the existing breadth into a focused and trustworthy platform through:

1. A first-class user journey.
2. Verifiable financial correctness.
3. Durable cross-system workflows.
4. Production-grade observability and disaster recovery.
5. Modular Mini App and bot architecture.
6. Carefully selected Telegram-native capabilities.
7. A defensible provider strategy.

> **Product position:** Transferly should become a Telegram-native financial operations assistant: one place to request, collect, track, reconcile, and safely move money, with proactive bot automation and evidence-backed transaction status.

Every major feature should support this position rather than merely adding another provider dashboard.

## How to use this strategy

This document defines direction and sequencing, not implementation status. Track completion in the [V2 implementation checklist](codex/transferly-v2-implementation-checklist.md), and require code, automated tests, operational evidence, or an approved decision record before marking a gate complete. The current working implementation is authoritative when it differs from this strategy.

Sequence work by dependency rather than by calendar alone:

1. Prove durable financial recovery and reconciliation.
2. Establish telemetry, backup, restore, and operator controls around those workflows.
3. Build user-facing status and support experiences from the proven state model.
4. Improve architecture and delivery controls without changing financial semantics.
5. Expand providers and products only after the preceding gates hold under failure.

## P0 — Production and financial safety

### 1. Complete and prove the transactional outbox and provider-operation inbox

The current implementation includes outbox and provider-inbox migrations, repositories, payout integration, operator outbox replay, and focused persistence tests. Treat these as foundations rather than a completed recovery guarantee. Close the remaining SQLite/Redis and provider/local-effect crash windows recorded in the [V2 implementation checklist](codex/transferly-v2-implementation-checklist.md):

- Persist `outbox_events` in the same SQLite transaction as ledger, payout, invoice, funding, and order state changes.
- Dispatch outbox records to BullMQ using lease-based claiming, fencing tokens, bounded retries, terminal states, and operator replay.
- Persist provider callback and polling results in an operation inbox.
- Add reconciliation-aware recovery for unconsumed provider observations; recording and consuming an observation alone is not replay safety.
- Validate semantic idempotency, not only duplicate key acceptance.
- Correlate the request, transaction, outbox event, queue job, provider request, webhook, and ledger entry.

For every unconsumed provider observation, a recovery coordinator must independently verify provider acceptance, payout projection, reservation disposition, ledger effects, wallet projection, payment-issue state, audit evidence, and related outbox state. It must classify the observation as one of:

- **Already applied:** all required local effects exist; mark the observation consumed.
- **Safe to complete:** provider acceptance is established and only deterministic local effects are missing; apply those effects transactionally.
- **Provider refresh required:** evidence is incomplete or nonterminal; refresh without resubmitting the money movement.
- **Finance review required:** evidence is ambiguous or an automated correction would mutate authoritative financial history.
- **Conflict:** contradictory amount, currency, resource, status, or ledger evidence; freeze automated action and alert.

Never recover by generically calling provider submission again. A terminal local payout status is also insufficient evidence that all ledger, reservation, audit, and inbox effects completed.

Acceptance criteria:

- Crashes at every state boundary still lead to eventual completion.
- Redis outages delay dispatch but do not lose operations.
- Reprocessing never duplicates a payout or credit.
- Every money movement has one end-to-end correlation timeline.
- Repeated recovery converges to one settled result or one explicit finance-review case.
- Failure-injection tests cover provider success followed by payout, reservation, ledger, audit, and inbox-consumption failure, plus concurrent recovery of the same observation.

### 2. Ledger invariants and continuous reconciliation

Continuously prove that the internal ledger is authoritative:

The current payment reconciliation service refreshes eligible invoice and payout provider state. Retain that capability, but do not treat provider refresh counts as proof of financial consistency. The next reconciliation layer must compare independently persisted evidence across the provider inbox, domain records, reservations, ledger, wallet projections, audits, issues, and outbox.

- Check non-negative integral buckets and available/pending/frozen consistency.
- Ensure each payout reservation has exactly one terminal settlement or release.
- Map each funding credit to one verified payment and each provider settlement to a local disposition.
- Detect orphan reservations, unmatched webhooks, missing audit records, and inconsistent idempotency reuse.
- Run incremental reconciliation on a schedule and a full reconciliation daily.
- Classify drift severity; auto-repair derived projections only, and require approval for ledger corrections.
- Produce signed finance summaries and alerts for unresolved drift and stale funds.

Expose a sanitized user timeline:

> Requested → Funds reserved → Provider submitted → Provider processing → Completed → Reconciled

### 3. Hardened financial control plane

Add explicit controls for:

- User, provider, currency, corridor, amount, and time-window limits.
- First-payout cooldown, velocity checks, duplicate destinations, and session/device risk.
- Destination allowlists and provider/corridor kill switches.
- Four-eyes approval and step-up confirmation for high-risk actions.
- Hold, release, reverse, and reject workflows with reason codes.
- Separate support, finance, risk-reviewer, and owner roles.
- Per-item authorization for bulk operations and tamper-evident audit retention.

Every payout confirmation must show the amount, currency, fees, exchange rate, recipient, provider, delivery expectation, source balance bucket, cancellation policy, and stable reference. A toast alone is not confirmation of money movement.

### 4. Distributed observability

Evolve beyond process-local metrics such as `api/core/observability/operationalMetrics.js`:

- Correlate traces across API requests, transactions, outbox dispatch, jobs, provider calls, webhooks, settlement, and bot notifications.
- Export metrics and structured logs to durable telemetry storage.
- Measure queue depth and age, provider latency and errors, circuit state, webhook settlement latency, reconciliation drift, and reservation age.
- Capture sanitized Mini App errors and Web Vitals.
- Add burn-rate alerts, provider outage detection, synthetic flows, runbook links, and sanitized incident status.

Initial service-level objectives:

| Flow | Target |
| --- | ---: |
| API availability | 99.9% |
| Read API p95 | <300 ms |
| Financial command acknowledgement p95 | <750 ms |
| Webhook durable acknowledgement | <2 seconds |
| Webhook settlement p95 | <60 seconds |
| Telegram callback acknowledgement | <1 second |
| Critical queue oldest-job age | <60 seconds |
| Unreconciled completed transactions | 0 beyond the defined window |

Adopt OpenTelemetry or an equivalent maintained pipeline deliberately; verify the maturity of each signal before relying on it.

### 5. Proven backup, restore, and rollback

Implement encrypted automated SQLite backups, off-host copies, retention tiers, integrity checks, WAL-aware restore drills, expand/contract migrations, forward-fix procedures, and post-restore asset and ledger reconciliation.

Initial targets:

- Financial-state RPO: no more than 5 minutes.
- RTO: no more than 30 minutes.
- Restore test: monthly.
- Disaster-recovery exercise: quarterly.
- Reconciliation: mandatory before reopening writes after restore.

## P1 — Exceptional user experience

### 6. Organize the Mini App around user jobs

Use primary navigation for **Home**, **Pay / Collect**, **Activity**, **Wallet**, and **More**. Reveal provider concepts only when needed.

- Home: available and pending balances, one primary action, attention queue, recent activity, pending status, incidents, and support.
- Pay / Collect: request payment, create invoice, pay, add funds, withdraw, share a link, or scan a reference before selecting a provider.
- Activity: one searchable timeline for funding, points, invoices, payouts, refunds, reservations, and provider events, with evidence and safe recovery actions.

### 7. Pending and failure experience

Model explicit states: awaiting action/payment, verification, provider processing, delayed but safe, review required, failed before movement, failed with reserved funds, refunded, reversed, and reconciled.

Each state must explain whether funds are safe, whether the user was charged, whether retry is safe, when status may change, the support reference, and what Transferly will do automatically. Standardize stable error codes, plain-language messages, retryability, next actions, retry-after values, and request IDs.

### 8. Support and dispute center

Allow transaction-linked cases with sanitized context, status timelines, bot updates, secure evidence, assignment, escalation, SLA tracking, refund/dispute/chargeback workflows, internal notes, and resolution feedback. Never ask users to paste tokens, webhook data, or provider payloads.

### 9. Deterministic bot automation

Send actionable notifications for paid invoices, delayed payouts, required funding references, provider setup, ready receipts, support updates, expiring actions, and reconciliation summaries.

Users should control categories, quiet hours, thresholds, digest frequency, language, and amount visibility. Deep links must use short-lived server-resolved context rather than sensitive URL data. Callbacks must be promptly acknowledged, idempotent, expiry-aware, duplicate-safe, and protected from stale actions.

## P1 — Telegram-native improvements

### 10. Capability compatibility layer

Extend the existing Telegram adapter with feature detection and browser fallbacks:

- `SecureStorage`: store only an opaque session bootstrap handle; keep tokens short-lived, rotated, server-bound, and revocable.
- `DeviceStorage`: store non-sensitive preferences only.
- `BiometricManager`: optional local step-up for sensitive views and confirmations, never sole server authorization.
- Home-screen prompts: show only after demonstrated value.
- `shareMessage`: use previewed, server-prepared, non-sensitive payment and invoice content.
- `downloadFile`: use short-lived owner-scoped authorization for receipts, invoices, evidence, and reports.
- QR scanning: validate every scanned identifier as untrusted input.

The `localStorage` token handling in `miniapp/src/lib/api.js` requires a dedicated threat-modelled migration.

### 11. Rich bot interactions

Use rich and user-specific responses for private operational acknowledgements, transaction summaries, onboarding, and operator results where supported. Critical financial controls must retain conventional message and Mini App fallbacks.

## P1 — Architecture and maintainability

### 12. Decompose oversized modules incrementally

Refactor the Mini App and bot by vertical feature while preserving contracts:

```text
miniapp/src/features/
  activity/ auth/ funding/ invoices/ payouts/ providers/ support/ wallet/

bot/
  commands/ callbacks/ conversations/ notifications/ screens/ middleware/
```

Each feature should own its hooks, views, state machine, input schema, error presentation, tests, and deep-link contract. Extract one domain at a time; do not perform a wide rewrite.

### 13. Generated, versioned API contract

Add OpenAPI 3.1, a stable error envelope, versioned schemas, a generated or contract-validated Mini App client, bot contract tests, a deprecation policy, an auth-scoped API inventory, undocumented-route detection, and compatibility tests for older clients.

### 14. Standardize frontend data management

Split `miniapp/src/context/AppContext.jsx` into domain hooks with centralized cancellation/deadlines, deduplicated reads, bounded jittered retries, safe stale-while-revalidate behavior, idempotent mutations, explicit session expiry, feature error boundaries, and consistent loading/empty/offline states. Never optimistically update financial balances.

## P1/P2 — Testing and quality engineering

### 15. Browser and device matrix

Expand Playwright beyond Chromium to mobile Chromium, mobile WebKit, Firefox desktop, 320 px, tablet, Telegram-like desktop, both themes, reduced motion, text scaling, slow/offline networks, delayed Telegram injection, and unsupported feature versions.

Automate keyboard, focus, touch-target, semantics, contrast, screen-reader announcement, and non-color status checks. Keep real Telegram iOS, Android, Desktop, and Web smoke tests as release evidence.

### 16. Deterministic failure-path tests

Inject failures for DB-commit/queue-publication crashes, provider-success/local-settlement crashes, duplicate and out-of-order webhooks, Redis outages, provider 429/500/timeouts, SQLite locks or full disks, repeated jobs, user retries, double approvals, token-refresh races, duplicate callbacks, and clock skew. Use controlled adapters, never production debug endpoints.

### 17. Capacity evidence

Measure wallet write contention, webhook and approval bursts, bot spikes, queue recovery storms, large histories, reconciliation scans, and low-end mobile startup. Define PostgreSQL migration triggers based on lock wait, throughput, database size, restore duration, read scaling, and region requirements; do not add a second financial database casually.

## P2 — Product expansion

### 18. Complete strategic provider corridors

Choose one or two providers from demonstrated demand. A provider is live only after its signed client, webhook verification and deduplication, state mapping, refunds/disputes, reconciliation, ledger rules, idempotency, sandbox tests, runbook, kill switch, and user failure handling are complete. Optimize for reconciled volume, not provider count.

### 19. Flagship invoice and payment-request workflow

Add saved customers, templates, recurring and partial invoices, reminders, tax/discounts, multi-currency quotes, hosted pages, Telegram previews, status subscriptions, receipts, refunds/disputes, bookkeeping exports, link expiry/revocation, and fraud-resistant public lookup.

### 20. Team and business workspaces

After single-user flows are stable, add organizations, role-based access, approval policies, shared customers, maker/checker payouts, team activity, limits, scheduled exports, workspace-scoped credentials, audited support-view mode, and privacy-safe group notifications.

### 21. Localization and regional readiness

Add internationalization, locale-aware currency/date formatting, demand-led languages, RTL readiness, regional terminology, timezone-aware due dates and quiet hours, accessible financial copy, and reviewed regional legal content. Translation alone does not satisfy regulation.

## P2 — Privacy, security, and compliance

### 22. Privacy lifecycle controls

Create a data classification registry, retention schedule, export/deletion workflows with legal exceptions, device/session management, consent history, restricted audit retention, file expiry evidence, payload minimization, targeted field encryption, secret rotation, and processing inventory. Obtain jurisdiction-specific legal review for licensing, KYC, AML, sanctions, safeguarding, and disclosures.

### 23. Systematic OWASP API protection

Enforce resource ownership, property allowlists, function authorization, user and business-flow rate limits, provider cost limits, anti-automation, egress controls, strict provider response validation, route/version inventory, debug-surface isolation, bounded payload/upload/query/pagination limits, and auth-matrix tests. Authentication must happen before expensive provider or database work.

## Long-term scalability progression

1. **Harden the modular monolith:** retain Express, SQLite, Redis/BullMQ, worker, Vite Mini App, and bot while adding the outbox, durable telemetry, modular boundaries, recovery evidence, and load limits.
2. **Move authoritative persistence only when evidence requires it:** adopt PostgreSQL transactions, constraints, row locks, pooling, and an online reconciliation strategy. Use dual reads for cutover verification, not unsafe long-term dual writes.
3. **Extract services only at proven scaling or security boundaries:** notifications, generated assets, provider connectors, and reporting are candidates. Keep ledger mutation centralized.

## Delivery sequence

### First 30 days — Trust foundation

1. Define the product north star and primary journeys.
2. Complete reconciliation-aware provider-inbox recovery and crash-boundary tests.
3. Prove outbox dispatch, terminal failure, operator replay, and Redis-outage recovery.
4. Add independent ledger, reservation, wallet-projection, audit, inbox, and outbox invariant reports.
5. Establish SLOs and exported telemetry.
6. Automate encrypted backup creation and isolated restore drills.
7. Add kill switches and limit policies.
8. Inventory routes and provider lifecycle states.

Exit gate: failure injection at every payout boundary converges without duplicate provider submission or ledger effects; reconciliation reports no unexplained drift; telemetry survives process restart; and a restored database passes integrity, migration, asset, and ledger checks within the RPO/RTO targets.

### Days 31–60 — User experience

1. Launch task-oriented navigation.
2. Build the unified transaction timeline.
3. Standardize pending, failure, and retry states.
4. Add transaction-linked support cases.
5. Add configurable bot notifications and deep links.
6. Add session/device management and plan the `SecureStorage` transition.

Exit gate: every advertised financial state answers whether funds moved, whether retry is safe, what Transferly will do next, and which stable reference support should use; critical journeys pass real-device Telegram validation on iOS and Android.

### Days 61–90 — Quality and maintainability

1. Split `MiniAppPage.jsx` incrementally by domain.
2. Split `bot.js` into owned modules.
3. Generate and validate the OpenAPI contract.
4. Expand Playwright to WebKit and mobile profiles.
5. Add queue and payment chaos tests.
6. Record a production-like load and recovery exercise.
7. Move CI and deployment to a supported Node.js LTS through a compatibility matrix, and pin third-party workflow actions to reviewed releases or immutable commits.

Exit gate: external routes have contract and authorization coverage; critical failure and concurrency cases are automated; bundle, load, queue-recovery, and provider-outage limits are recorded; and the release gate runs on the supported production runtime.

### Quarter 2

1. Finish one strategic provider corridor.
2. Deliver the flagship invoice lifecycle.
3. Add refund and dispute operations.
4. Introduce business workspaces and approvals.
5. Add privacy lifecycle capabilities.
6. Make an evidence-based SQLite/PostgreSQL decision.

Exit gate: the selected provider corridor has complete ledger, webhook, idempotency, reconciliation, refund/dispute, kill-switch, sandbox, runbook, and user-failure coverage. Workspace and invoice expansion must not bypass the P0 financial controls.

## Success metrics

| Area | Metric |
| --- | --- |
| User value | Auth success >99.5%; first task <90 seconds; status lookup >99.9%; CSAT >4.5/5 |
| Financial safety | Zero duplicate effects, negative buckets, overdue orphan reservations, or overdue unreconciled completions |
| Reliability | API ≥99.9%; restore drills 100%; callback p95 <1 second; mobile LCP p75 <2.5 seconds |
| Engineering | Full external-route contract coverage; tested critical transitions; MTTD <5 minutes; provider-outage MTTR <30 minutes |

Set an agreed size threshold, such as 800–1,000 lines, for feature-owned source files and require an explicit exception when exceeding it.

## Do not prioritize yet

- Cosmetic polish before pending and failure UX.
- More setup-only provider screens.
- AI that authorizes payments, determines balances, or claims provider status.
- Optimistic balance updates.
- Microservices without capacity evidence.
- Demand-free blockchain features or risky financial gamification.
- Offline financial mutations.
- A broad Mini App or bot rewrite.

## Release blockers for high-value money movement

1. Transactional database-to-queue delivery and reconciliation-aware provider-inbox recovery, proven at crash boundaries.
2. Restorable backups with measured RPO/RTO.
3. Durable exported telemetry and alerting.
4. Live Redis failure and recovery evidence.
5. Continuous reconciliation across provider evidence, domain state, reservations, ledger, wallet projections, audits, inbox, and outbox.
6. Load and concurrency evidence.
7. Complete provider refund/dispute handling for advertised flows.
8. Real-device Telegram iOS and Android validation.
9. Documented regulatory and privacy posture.

## Supporting references

Internal sources:

- [V2 implementation checklist](codex/transferly-v2-implementation-checklist.md)
- [Project architecture](codex/references/project-architecture.md)
- [Payment provider adapters](codex/references/payment-provider-adapters.md)
- [Deployment operations guide](deployment-operations-guide.md)
- [Mini App real-device QA](miniapp-real-device-qa.md)

External standards to consult during implementation:

- [Telegram Mini Apps official documentation](https://core.telegram.org/bots/webapps) for version-gated capabilities, initialization-data validation, storage, biometrics, sharing, downloads, and device behavior.
- [Telegram Bot API documentation](https://core.telegram.org/bots/api) for webhook, callback, deep-link, and message contracts.
- [OWASP API Security Top 10](https://owasp.org/API-Security/) for resource authorization, property exposure, business-flow abuse, inventory, and unsafe third-party API risks.
- [OpenTelemetry JavaScript documentation](https://opentelemetry.io/docs/languages/js/) for supported instrumentation and durable trace, metric, and log export.
- [SQLite backup documentation](https://sqlite.org/backup.html) for online backup behavior and restore design; Transferly must additionally encrypt, replicate off-host, verify integrity, and exercise application-level reconciliation.

## Known documentation mismatch

The current [deployment operations guide](deployment-operations-guide.md) includes rollback guidance that suggests running a down migration. That conflicts with the repository's additive SQLite migration practice and is not a proven live-data recovery procedure. Until the guide is corrected and an isolated restore drill is evidenced, recover by stopping writes, preserving the affected database and logs, restoring a verified backup into isolation, running integrity and migration checks, reconciling financial state, and promoting only through an approved operator runbook. Never improvise schema rollback against the only production copy.

This strategy is directional. Completion status belongs in the V2 implementation checklist and must be backed by code, tests, operational evidence, or an approved decision record.