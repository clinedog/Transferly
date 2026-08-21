# Transferly V2 Architecture Implementation Checklist

Status: active implementation baseline, 2026-07-16

Source of truth: `docs/transferly.md`. This checklist records implementation evidence; it does not replace the product, safety, architecture, migration, or release requirements in that document.

## Architecture Decision

- [x] Retain the existing CommonJS Express API while foundational contracts are stabilized.
- [x] Apply the section 2 module boundaries incrementally: routes/controllers for transport, schemas for validation, policies/middleware for authorization, services for workflows, repositories for persistence, generators for bounded content generation, jobs/webhooks for side effects, and adapters for external systems.
- [x] Keep new business services and repositories framework-independent enough to move behind AdonisJS legacy v4.1 controllers later.
- [ ] Introduce an AdonisJS legacy backend only as a parallel, versioned compatibility target after authentication, ledger, order, worker, and release contracts are stable. Do not place a framework rewrite on the critical path or remove Express without contract parity.
- [ ] Split remaining oversized legacy modules only when a replacement module has focused regression coverage.

See `docs/codex/backend-strategy.md` for the recorded backend decision.

## Current-State Classification

### Implemented Foundations

- Telegram Mini App `initData` HMAC verification, bounded timestamps, timing-safe comparison, application sessions, and role reconciliation exist.
- Telegram login, refresh-token rotation, logout revocation, and persistent session replay rejection are implemented.
- Active-account enforcement and owner/admin middleware now fail closed across every private API route group.
- Compatibility-oriented SQLite migration logic preserves legacy databases and seeds the database-backed service catalogue.
- Point transactions and point reservations support idempotent reserve, commit, and release operations inside database transactions.
- Orders support preflight, idempotent creation, ownership checks, cancellation, retry, an enum-backed state machine, event history, audit events, and reservation settlement.
- BullMQ order dispatch uses stable queue-safe identifiers, dispatch generations, stale-job rejection, bounded retries, and operational recovery hooks.
- Service rows now carry first-class generator, schema, output, retention, version, execution-mode, permission, and feature-flag metadata.
- Generator contracts and the registry validate bounded input/output metadata and reject unknown, disabled, or version-mismatched implementations.
- Order processing can execute a registered generator, stage private output, and atomically persist the asset, complete the point reservation, and transition the order.
- Expired generated assets are deleted in bounded BullMQ batches through a stable recurring scheduler with retry-safe partial-failure handling.
- Service and template input schemas are enforced on order preflight and creation with bounded, value-free validation errors and fail-closed handling for malformed stored schemas.
- Generated assets are exposed through owner-scoped policy/service/controller/routes with audited, expiring signed downloads that do not expose storage paths.
- Order creation binds each idempotency key to a canonical request hash in the same transaction as order creation and point reservation; changed-request reuse and cross-owner collisions fail closed while matching legacy orders can be backfilled.
- Durable order-attempt records now act as processing leases with one active attempt per order, expiry recovery, lock-token fencing, correlation metadata, aggregate attempt counts, and transactional success/failure closure.
- Expiring point reservations are recovered in bounded BullMQ batches, refund points exactly once, and use atomic conditional balance updates to prevent concurrent overspend.
- API lint, clean and representative legacy compatibility migrations, the complete 42-test API suite, and the 11-test bot suite have passed through the authoritative-ledger phase.

### Partially Implemented

- The append-only point ledger is authoritative for point balances and `profiles.points` is maintained only as a compatibility projection. Administrator list APIs expose projection drift, and an idempotent audited workflow can reconcile that projection; broader financial wallet reconciliation remains separate.
- The service catalogue has first-class generation metadata and backend schema enforcement, but unsafe legacy entries still need quarantine review.
- Order processing executes registered generators, persists generated assets, and uses durable processing locks and attempt history, but no production concrete generator exists yet.
- Queue recovery, worker readiness, durable attempt history, persistent dead-letter storage, classified terminal failures, and fenced administrator replay exist; live Redis crash/recovery evidence and queue metrics remain incomplete.
- Generated assets have owner-scoped repository methods, private storage, HTTP routes, and signed downloads, but orphan-file cleanup and reconciliation are incomplete.
- General idempotency storage exists and protects order creation, but other externally meaningful mutations have not yet adopted request-hash binding or replayable response records.
- Mini App routes and components exist, but feature ownership, one-session authentication, schema-driven studios, asset downloads, marketplace, wallet linking, and broad Playwright coverage are incomplete.
- Bot commands and callbacks are partly modular, but the main bot runtime remains large and operational flows are not fully aligned with the V2 modules.
- Health, logging, request context, release scripts, and provider checks exist, but end-to-end observability and production readiness are not proven.

### Missing

- Safe concrete generators and their service-specific safety tests.
- Generated-asset orphan-file cleanup and reconciliation.
- Safe transaction-record, notification-template, support-page, and awareness-simulation studios.
- Marketplace listings, trades, escrow settlement, disputes, and moderation.
- TonConnect proof verification and wallet linking.
- Persistent notifications, support tickets, and a complete administrator console.
- Idempotency adoption outside order creation and dead-letter recovery beyond the currently supported order, invoice, and payout job types.
- Strict environment-backed release-gate, rollback, and staged feature-flag evidence.

### Conflicts And Risks

- The requested AdonisJS legacy preference conflicts with the current Express stack constraint and with a no-rewrite migration strategy. The safe decision is parallel compatibility later, not an in-place rewrite now.
- Several legacy catalogue names imply third-party replicas or ambiguous verification. They must not be connected to generators until renamed, classified, feature-gated, and reviewed against the safety boundaries.
- `profiles.points` remains a write-through compatibility projection for legacy code and schema compatibility. New user-facing reads use the append-only ledger, drift is visible to administrators, and adjustment/reconciliation operations are idempotent and audited; any future direct SQL or legacy mutation of the projection can still create drift and must remain prohibited.
- The Mini App currently stores API/admin tokens in browser local storage and has more than one token path. This conflicts with the target single Telegram session model and increases token exposure risk.
- The migration runner is compatibility-oriented but not yet a versioned up/down migration system. Every additive schema change needs clean-database and legacy-database tests.
- The database-only migration command still loads unrelated Redis and PayPal configuration, so isolated migration verification requires inert environment values until configuration is split by runtime concern.
- Legacy `orders.idempotency_key` remains globally unique. The current compatibility contract rejects cross-owner collisions even though new idempotency records are scoped by user and operation; changing that constraint requires a versioned table rebuild and explicit client-contract migration.
- SQLite write concurrency and BullMQ/Redis availability remain deployment constraints; production load and recovery evidence is missing.
- File storage introduces sensitive-data, traversal, MIME confusion, predictable-key, orphan cleanup, and retention risks. It must remain private and owner-scoped from its first implementation.

## Phased Checklist

### Phase 0: Baseline And Decisions

- [x] Read the complete architecture plan.
- [x] Inspect API, bot, Mini App, database, workers, tests, and deployment scripts.
- [x] Record the CommonJS Express and parallel AdonisJS legacy strategy.
- [x] Establish this phased gap checklist.
- [x] Keep the checklist current after every verified phase.

### Phase 1: Telegram Authentication And Authorization

- [x] Verify Telegram signatures with bounded timestamps and timing-safe comparison.
- [x] Derive API identity from authenticated session data rather than request user IDs.
- [x] Reconcile owner/admin/support/user roles from protected server configuration.
- [x] Enforce owner/admin gates on current privileged routes.
- [x] Add explicit refresh and logout/session invalidation contracts.
- [x] Persist replay protection or otherwise prove one-time exchange semantics.
- [x] Audit every private route for authentication, ownership, and role enforcement.
- [x] Add security regression tests for cross-user object IDs and role downgrade/invalidation.
- [x] Enforce active, suspended, restricted, and deleted account status on login, refresh, and authenticated requests.

### Phase 2: Database Migration Compatibility

- [x] Preserve clean and legacy SQLite initialization.
- [x] Add compatibility columns and indexes without destructive data replacement.
- [x] Cover legacy point-transaction migration behavior.
- [x] Introduce versioned migrations with an applied-migration ledger.
- [x] Add backup, rollback, and migration-lock guidance.
- [x] Test new migration behavior against clean and representative legacy schemas.

### Phase 3: Wallet Ledger And Point Reservations

- [x] Add idempotent point transaction keys and reference indexes.
- [x] Add transactional point reserve, commit, and release workflows.
- [x] Settle reservations atomically across completion, failure, cancellation, and retry.
- [x] Prevent negative available points during reservation.
- [x] Make an append-only point ledger the authoritative source of point balances.
- [x] Add point-balance reconciliation and audited administrator adjustment workflows.
- [x] Add reservation expiry and recovery jobs.
- [x] Prove duplicate-credit and concurrent-spend prevention.

### Phase 4: Service Catalogue And Order State Machine

- [x] Persist and seed services and templates.
- [x] Add catalogue list/detail/template APIs.
- [x] Add order preflight/create/list/detail/cancel/retry contracts.
- [x] Add order state transitions, event history, ownership checks, and audit logging.
- [x] Add dispatch generations and stale-job rejection.
- [x] Add first-class generator, input schema, output, retention, version, and feature-flag metadata.
- [x] Bind order-create idempotency keys to canonical request hashes and reject changed-request or cross-owner reuse.
- [x] Normalize catalogue status values and quarantine unsafe or ambiguous legacy services.
- [x] Validate order input against the selected service/template schema on the backend.

### Phase 5: Background Generation Pipeline

- [x] Add `api/generators/generatorContract.js` and `generatorRegistry.js`.
- [x] Reject unknown, disabled, or version-mismatched generators safely.
- [x] Normalize and validate generator input and output metadata.
- [x] Add durable processing locks and order attempt history.
- [x] Integrate registry execution with the order worker without allowing generator-owned wallet mutation.
- [x] Run generator cleanup and discard staged output after partial failures.
- [x] Add bounded retry classification, persistent dead-letter records, and admin replay.
- [x] Add generator, worker retry, stale dispatch, processing-lock, and cleanup regression tests.

### Phase 6: Generated Asset Storage

- [x] Add the `generated_assets` schema and compatibility migration.
- [x] Add owner-scoped asset repository, policy, service, controller, and routes following section 2.
- [x] Add a private local storage adapter for development with opaque keys and atomic writes.
- [x] Validate MIME type, size, checksum, classification, and expiry before persistence.
- [x] Add expiring signed-download authorization without exposing storage paths.
- [x] Add bounded expiry/deletion jobs with a stable recurring scheduler.
- [x] Add bounded, dry-run-first orphan-file reconciliation that never deletes database-referenced assets.
- [x] Add clean/legacy migration, traversal, cross-user access, checksum, and retention tests.

### Phase 7: Safe Service Studios

- [ ] Implement verified transaction records only from authoritative backend records.
- [ ] Implement clearly labeled notification templates without sending or spoofing provider communications.
- [ ] Implement support pages with neutral templates and abuse controls.
- [ ] Implement isolated, visibly labeled training simulations.
- [ ] Add generator-specific safety, classification, source ownership, and output tests.
- [ ] Do not implement credential collection, deceptive records, impersonation, fake balances, or unsafe third-party replicas.

### Phase 8: Marketplace, Escrow, And Disputes

- [ ] Add listings, trades, escrow reservations, disputes, and event history.
- [ ] Enforce buyer/seller roles, ownership, amount bounds, and idempotent state transitions.
- [ ] Settle points atomically through the internal ledger.
- [ ] Add expiry, cancellation, moderation, dispute, reconciliation, and concurrency tests.

### Phase 9: TonConnect Wallet Linking

- [ ] Add a separate wallet-link challenge and proof-verification trust boundary.
- [ ] Never treat wallet ownership as Telegram identity or application authorization.
- [ ] Add challenge expiry, replay prevention, unlinking, and proof tests.

### Phase 10: Mini App Architecture

- [ ] Organize routes, layouts, components, and feature modules using section 2.
- [ ] Replace split local-storage token paths with one bounded Telegram application session.
- [ ] Add workspace bootstrap, wallet, catalogue, schema-driven order studios, order timeline, and asset downloads.
- [ ] Add marketplace, support, wallet-link, notification, and authorized admin views only after their backend contracts exist.
- [ ] Preserve read-only guest preview outside Telegram and never show Guest Mode for a valid Telegram launch.
- [ ] Run required responsive, theme, Telegram runtime, network failure, navigation, and console/network Playwright checks.

### Phase 11: Bot And Administrator Operations

- [ ] Keep public bot commands minimal and route privileged operations through explicit authorization.
- [ ] Move remaining command/callback behavior out of the main bot runtime behind tested modules.
- [ ] Align bot links and status messages with authoritative API order states.
- [ ] Add admin users, wallets, ledger, catalogue, templates, orders, trades, disputes, assets, queue, and system operations.
- [ ] Audit every mutation and protect replay or destructive actions with confirmation/idempotency.

### Phase 12: Reliability, Security, And Release

- [ ] Complete request IDs, operation IDs, structured errors, timeout/cancellation, safe retries, rate-limit handling, and CORS validation.
- [ ] Complete queue readiness, graceful shutdown, locks, dead letters, reconciliation, metrics, and alerts.
- [ ] Complete private storage, webhook, secret, log-redaction, dependency, and abuse reviews.
- [ ] Run API lint/migration/tests, bot tests, Mini App build/e2e, production checks, staging verification, bundle checks, secret scan, and release verification.
- [ ] Capture rollback evidence and deploy new modules behind disabled-by-default feature flags.
- [ ] Remove legacy behavior only after replacement parity and regression evidence exist.
- [ ] Do not claim production readiness while any critical check is failed, skipped without justification, or blocked.

## Verification Record

Latest authorization, migration, authoritative point-ledger, catalogue-validation, generated-asset, request-bound idempotency, durable processing-lock, persistent dead-letter, point-reservation recovery, and release-gate evidence:

```text
npm run lint --prefix api                                      PASS
node --test api/test/pointLedgerService.test.js                PASS (1 file, 0 failed)
node --test api/test/api.integration.test.js                   PASS (1 file, 0 failed)
node --test --test-concurrency=1 \
  api/test/authAuthorization.test.js \
  api/test/telegramMiniAppAuth.test.js                         PASS (2 files, 0 failed)
node --test --test-concurrency=1 \
  api/test/dbMigration.test.js \
  api/test/dbMigrationLegacyUsers.test.js                      PASS (2 files, 0 failed)
NODE_ENV=test REDIS_URL=redis://127.0.0.1:6379 \
  PAYPAL_CLIENT_ID=test-client \
  PAYPAL_CLIENT_SECRET=paypal-client-secret \
  PAYPAL_WEBHOOK_ID=test-webhook \
  SQLITE_DATABASE_PATH=/tmp/transferly-reservation-verify.sqlite \
  npm run db:migrate --prefix api                              PASS (clean database)
node --test --test-concurrency=1 \
  api/test/dbMigrationLegacyPointReservations.test.js \
  api/test/expirePointReservationJob.test.js \
  api/test/pointReservationRecovery.test.js                    PASS (3 files, 0 failed)
npm test --prefix api                                          PASS (42 tests, 0 failed, 0 skipped)
npm test --prefix bot                                          PASS (11 tests, 0 failed)
npm run build --prefix miniapp                                 PASS
npm run test:e2e:list --prefix miniapp                         PASS (38 tests listed)
npm run test:e2e --prefix miniapp -- \
  --grep "route audit stays nonblank" --workers=1             PASS (1 focused route-audit test)
npm run test:e2e --prefix miniapp                              PASS (38 tests, 0 failed)
npm run check:production                                      PASS (static mode; production environment not validated)
npm run verify:staging                                        PASS (non-strict mode; staging environment checks skipped)
npm run check:miniapp:bundle                                  PASS
npm run scan:secrets                                          PASS
npm run verify:release                                        PASS (aggregate local/static gate; strict environment and live-service checks skipped)
npm audit --omit=dev --prefix api                              PASS (0 production vulnerabilities)
git diff --check                                               PASS
```

On 2026-07-23, the migration ledger and checksum verification were revalidated with a clean migration status check. The unsafe legacy-service quarantine migration, bounded generated-asset orphan reconciliation, focused API tests, full bot suite, and Mini App production build passed. Lockfile-only dependency remediation was installed for all packages; `npm audit --omit=dev --prefix api`, `bot`, and `miniapp` each report 0 production vulnerabilities. Orphan deletion remains disabled by default and requires explicit `GENERATED_ASSET_ORPHAN_DELETE_ENABLED=true` after a reviewed dry run.

The authoritative-ledger phase was reverified on 2026-07-16 with `npm run lint --prefix api`, a clean SQLite migration applying five migrations, and the complete API suite passing 42 tests with no failures or skips. Ledger reads now cover authentication/bootstrap, Telegram profile summaries, user profile/update responses, referrals, service command-center balances, and administrator user views. Strict production/staging validation, rollback evidence, live Redis failure/replay recovery, and deployment smoke tests remain required. Durable replay uses stable queue job IDs and downstream idempotency, but a transactional Redis/SQLite outbox is still a residual crash-window improvement. These results do not prove marketplace, wallet-linking, later Mini App, deployment, or production readiness.
