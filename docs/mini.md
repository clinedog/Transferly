# TRANSFERLY — PHASE-BY-PHASE PRODUCTION, PLATFORM, UX, AND SCALE UPGRADE PLAN

## ROLE
Act as a senior staff/principal engineer, product architect, security engineer, financial-systems engineer, UX engineer, and DevOps specialist responsible for upgrading the existing Transferly codebase into a production-grade, provider-agnostic financial operating system.

Work directly against the existing codebase.

Do not rebuild Transferly from scratch.

Do not remove existing integrations or functionality unless the change is proven necessary, documented, tested, and backward-compatible.

Preserve working behavior while progressively replacing fragile, duplicated, provider-specific logic with canonical, reusable platform primitives.

The goal is to make Transferly:

- financially safe
- reliable
- fast
- responsive
- accessible
- visually polished
- intuitive
- observable
- testable
- extensible
- provider-agnostic
- production-ready
- mobile-first
- operationally efficient
- easy to extend with providers, tools, plugins, and automations
- capable of intelligent routing and financial automation
- trustworthy for users, administrators, providers, and future partners
The financial core must always take priority over UI polish, marketplace expansion, AI, or ecosystem growth.

---

# IMPLEMENTATION STATUS — 2026-09-23

This roadmap remains the source of intent. This section records the implementation evidence currently present in the repository; it does **not** turn a planned capability into a production-readiness claim.

| Status | Meaning |
| --- | --- |
| Foundation implemented | Core primitives and focused regression coverage are present; adoption or operational validation may still be incomplete. |
| Partially implemented | A usable path exists, but one or more required surfaces from the phase remain incomplete. |
| Externally blocked | Completion needs provider credentials, a staging/production target, or a controlled recovery exercise; do not infer readiness. |

| Phase | Status | Evidence and remaining boundary |
| --- | --- | --- |
| 0–3 | Foundation implemented | Financial execution, explicit states, idempotency, and reservations are represented by `api/core/financial/` and focused tests. Existing flows still require incremental migration to the canonical path. |
| 4–8 | Foundation implemented | Provider capability/routing/configuration primitives, outbox events, and production-readiness checks exist. Provider readiness remains explicit rather than inferred. |
| 9–14 | Foundation implemented | Points funding, risk/approval, quote, tool, and plugin primitives exist with focused API coverage. Marketplace expansion is not a release prerequisite. |
| 15–17 | Foundation implemented | The Mini App design system, responsive/accessibility states, and bounded read caching are implemented under `miniapp/src/`; financial mutations and balances are intentionally excluded from read caching. |
| 18 | Partially implemented | Explicit loading/error/unknown/reconciliation states, in-app notifications, retryable notification failures, authenticated persisted notification category/channel preferences, contextual support handoff, and persisted support tickets with transaction context/history exist. Telegram/email/webhook delivery workers, agent assignment, and external ticket escalation still need implementation. |
| 19 | Partially implemented | Admin transaction center, receipt vault, search/filtering, CSV export, transaction-linked support context, and an authenticated bounded transaction-activity read model are present. The Mini App now consumes the authoritative funding/top-up/receipt records; invoice, payout, provider-reference, and related-transaction joins remain to be added. |
| 20 | Foundation implemented | Automation rules, dry-runs, executions, and webhook dispatch are persisted and audited. No assistant may mutate the ledger directly. |
| 21 | Partially implemented | SQLite repositories, indexes, pagination, and migration tooling exist. PostgreSQL implementations and a migration decision are intentionally not represented as complete. |
| 22 | Partially implemented | Auth, authorization, webhook verification, rate limits, validation, secret scanning, and dependency audit are present. The API production dependency audit is currently clean; live penetration testing and credential-rotation exercises remain operational work. |
| 23 | Foundation implemented | Checksum-backed SQLite backup/verify/prune tooling and regression coverage exist. A target-environment restore exercise is still required before production promotion. |
| 24 | Foundation implemented | `verify:release` chains verification, production/staging checks, bundle budget, and secret scanning. Target-environment credentials, webhook delivery, queue health, and reconciliation still require release-time evidence. |
| 25 | Partially implemented | Playwright covers critical Mini App flows, accessibility contrast, and notification recovery. Full visual baselines and live-device/provider validation remain incomplete. |
| 26 | Not assessed as complete | Do not delete code or dependencies based on this roadmap alone; cleanup requires reference and regression verification. |
| 27 | Partially implemented | Architecture, deployment, provider, release guidance, Mini App phase evidence, and OpenAPI entries for the new user activity/notification contracts exist in `docs/` and `api/openapi.js`. Full contributor, provider onboarding, and incident runbooks remain incomplete. |
| 28 | Partially implemented | Unit, integration, provider, migration, release, build, bundle, and secret gates exist. Staging/live provider credentials, restore drills, load/chaos exercises, and production rollout verification are outstanding. |

## Provider release boundary

PayPal is the only provider lane that may be represented as a production-oriented integration where its configured credentials and webhook verification pass target-environment checks. Stripe, Wise, Paystack, Flutterwave, and Crypto webhook jobs retain pending ledger integration; they must remain setup/sandbox-only until they post through the internal ledger and pass reconciliation tests. Never promote a provider based only on a provider callback or a UI success state.

## Current execution rule

Implement the next smallest evidence-backed gap in implementation order. A phase may be upgraded to complete only after its required code path, focused tests, relevant release gate, and any required target-environment validation have all passed.

---

# GLOBAL ENGINEERING PRINCIPLES
Follow these principles throughout every phase:

1. Preserve existing functionality.
2. Prefer incremental migration over rewrites.
3. Keep financial correctness ahead of convenience.
4. Keep backend authority ahead of frontend assumptions.
5. Keep explicit state ahead of ambiguous status.
6. Keep evidence ahead of assumptions.
7. Keep reusable primitives ahead of provider-specific hacks.
8. Keep secure boundaries ahead of rapid extensibility.
9. Keep measurable performance ahead of subjective optimization.
10. Keep accessible design ahead of decorative complexity.
11. Keep operational recovery ahead of optimistic success.
12. Keep documentation synchronized with implementation.
13. Keep every important action observable and auditable.
14. Keep all financial mutations idempotent.
15. Keep all high-risk actions confirmable and reversible where possible.

---

# PHASE 0 — PROJECT DISCOVERY, BASELINE, AND DELIVERY CONTROL

## Objective
Understand the existing system completely before making architectural or visual changes.

## Required work
Inspect and map:

- API
- Mini App
- Telegram bot
- admin portal
- workers
- queues
- database
- ledger
- wallet
- points
- provider adapters
- PayPal
- Stripe
- webhooks
- reconciliation
- risk
- authentication
- authorization
- configuration
- tests
- deployment
- observability
- Cline skills
- documentation
- assets
- design tokens
- routing
- state management
- caching
- error handling
- analytics
- feature flags
Identify:

- duplicated financial logic
- provider-specific assumptions leaking into shared code
- dead code
- unused files
- unnecessary folders
- obsolete abstractions
- race conditions
- unsafe retries
- missing idempotency
- transaction-state inconsistencies
- premature success displays
- missing loading, empty, error, and retry states
- performance bottlenecks
- security weaknesses
- configuration fragmentation
- accessibility failures
- inconsistent visual patterns
- mobile layout problems
- false-confidence tests
- missing monitoring
- missing recovery procedures

## Establish baseline metrics
Record current:

- API latency
- Mini App load time
- JavaScript bundle size
- largest contentful paint
- interaction latency
- error rate
- provider success rate
- webhook delay
- queue delay
- reconciliation exceptions
- test coverage
- build duration
- deployment duration
- mobile viewport behavior
- accessibility score
- database query performance

## Deliverables
Create:

- architecture map
- dependency map
- financial-flow map
- provider capability matrix
- risk register
- technical debt register
- UX/UI audit
- performance baseline
- security baseline
- test baseline
- phased implementation backlog
- rollback strategy
- release checklist
Do not make broad changes until this baseline is documented.

---

# PHASE 1 — FINANCIAL EXECUTION KERNEL

## Objective
Create one canonical financial execution pipeline for all financial operations.

## Canonical pipeline
REQUEST
→ AUTHENTICATE
→ AUTHORIZE
→ VALIDATE
→ CAPABILITY CHECK
→ ENVIRONMENT CHECK
→ QUOTE
→ FEES
→ POINTS
→ RISK
→ IDEMPOTENCY
→ RESERVATION
→ LEDGER
→ PROVIDER EXECUTION
→ WEBHOOK/PROVIDER CONFIRMATION
→ RECONCILIATION
→ FINAL STATE
→ AUDIT
→ EVENT
→ NOTIFICATION

Apply this architecture consistently to:

- payments
- invoice payments
- payment links
- payouts
- transfers
- refunds
- points funding
- admin adjustments
- subscriptions
- future financial operations
Create reusable domain services and interfaces.

Do not duplicate execution pipelines for each provider.

## Required safeguards

- backend-generated quotes
- server-side fee calculation
- server-side points calculation
- authorization before mutation
- risk evaluation before execution
- reservation before consumption
- ledger-backed financial state
- provider confirmation
- webhook verification
- reconciliation
- audit logging
- event publication
- user notification only after authoritative state

## Deliverables

- canonical execution service
- operation context
- execution result model
- financial operation interface
- provider execution boundary
- audit integration
- event integration
- notification integration
- migration adapters for existing flows

---

# PHASE 2 — EXPLICIT FINANCIAL STATE MACHINES

## Objective
Make every financial operation deterministic, explainable, and safe.

## Required states

- REQUESTED
- VALIDATING
- QUOTED
- AUTHORIZED
- RESERVED
- PROCESSING
- SUCCEEDED
- FAILED
- UNKNOWN
- RECONCILING
- CANCELLED
- EXPIRED
- REFUNDED
- PARTIALLY_REFUNDED
- REQUIRES_ACTION
UNKNOWN must be a first-class state.

## Example
REQUESTED
→ PROCESSING
→ UNKNOWN
→ RECONCILING
→ SUCCEEDED / FAILED

## Rules

- A provider timeout must never automatically become success.
- A timeout must never automatically trigger another provider.
- UNKNOWN may only become SUCCEEDED or FAILED after verified evidence.
- Illegal transitions must be rejected.
- Every transition must be timestamped.
- Every transition must record actor or system source.
- Every transition must be auditable.
- Every transition must emit an appropriate event.
- UI must display processing, unknown, and reconciling states clearly.

## Deliverables

- state-machine definitions
- transition validator
- transition history
- state recovery jobs
- state-machine tests
- UI state mapping
- admin investigation workflow

---

# PHASE 3 — UNIVERSAL IDEMPOTENCY, RESERVATIONS, AND CONCURRENCY CONTROL

## Objective
Prevent duplicate execution, duplicate credit, duplicate debit, and race-condition failures.

## Protect

- payments
- payouts
- transfers
- refunds
- invoice payments
- points funding
- admin adjustments
- provider execution
- webhook processing
- reconciliation repairs
- tool execution
- automation execution

## Store

- idempotencyKey
- actorId
- tenantId
- operation
- requestHash
- transactionId
- status
- result
- providerId
- providerRequestId
- createdAt
- expiresAt
- retryCount
- lastAttemptAt

## Rules
Same key plus same request:
→ return original result.

Same key plus different request:
→ reject.

Concurrent duplicate requests:
→ one execution, all others receive the authoritative result.

Provider-side idempotency keys must be derived consistently where supported.

## Reservation system
Implement reservations for:

- points
- wallet balances
- payout funds
- provider capacity where applicable
- limited promotional resources
Support:

- reservation creation
- reservation expiration
- reservation release
- reservation consumption
- reservation recovery
- reservation audit

## Deliverables

- universal idempotency service
- reservation service
- concurrency tests
- duplicate webhook protection
- worker restart recovery
- expired reservation recovery

---

# PHASE 4 — PROVIDER CONTRACTS AND CAPABILITY MODEL

## Objective
Create a provider-agnostic foundation for PayPal, Stripe, and future providers.

## Provider contract must describe

- provider identity
- environment
- configuration
- supported operations
- payment methods
- countries
- currencies
- limits
- fees
- authentication
- webhook capabilities
- health
- readiness
- production eligibility
- idempotency
- error normalization
- transaction references
- balance capabilities
- settlement capabilities
- refund capabilities
- customer capabilities
- reporting capabilities

## Canonical operations

- PAYMENT
- INVOICE_PAYMENT
- PAYMENT_LINK
- PAYOUT
- TRANSFER
- REFUND
- SUBSCRIPTION
- BALANCE
- CUSTOMER
- REPORTING

## Canonical payment methods

- CARD
- BANK_TRANSFER
- MOBILE_MONEY
- USSD
- QR
- WALLET
- DIRECT_DEBIT
- BNPL
Do not infer one capability from another.

CARD_PAYMENTS does not imply PAYMENT_LINKS.

BANK_TRANSFER does not imply PAYOUTS.

PAYMENTS does not imply INVOICING.

## Provider readiness
Separate:

- configured
- authenticated
- sandbox-ready
- production-ready
- webhook-ready
- degraded
- unavailable
- disabled

## Deliverables

- canonical provider interface
- capability schema
- provider readiness model
- PayPal adapter migration
- Stripe adapter migration
- provider onboarding guide
- provider capability tests

---

# PHASE 5 — ELIGIBILITY, RANKING, ROUTING, RETRY, AND FAILOVER

## Objective
Make provider selection intelligent, explainable, safe, and policy-aware.

## Architecture
ProviderEligibilityEngine
→ EligibleProvider[]

ProviderRankingEngine
→ RankedProvider[]

ProviderSelectionEngine
→ SelectedProvider

ExecutionEngine
→ Execute Operation

ReconciliationEngine
→ Verify Outcome

## Eligibility checks

1. provider enabled
2. environment
3. operation support
4. production eligibility
5. country
6. currency
7. payment method
8. transaction type
9. amount limits
10. provider health
11. readiness
12. user preference
13. organization policy
14. risk policy
15. settlement requirements
16. compliance restrictions
Only eligible providers may be ranked.

## Ranking factors

- historical success rate
- latency
- fees
- reliability
- configured priority
- health
- user preference
- organization preference
- settlement speed
- operational capacity
- risk profile

## Retry classification

- retryable
- non-retryable
- unknown
- requires-reconciliation
- requires-user-action

## Failover rules

- Never fail over after an uncertain financial execution without evidence.
- Never execute through two providers simultaneously unless explicitly designed and reconciled.
- Persist routing decisions.
- Explain routing decisions using real data only.
- Allow administrators to inspect routing history.

## Deliverables

- eligibility engine
- ranking engine
- routing decision record
- retry policy
- failover policy
- provider health scoring
- routing dashboard
- routing tests

---

# PHASE 6 — LEDGER, WALLET, POINTS, AND RECONCILIATION HARDENING

## Objective
Make the ledger the authoritative financial source of truth.

## Enforce

- double-entry accounting
- immutable financial entries
- transaction references
- deterministic balance derivation
- atomic financial operations
- ledger invariants
- adjustment auditability
- reconciliation links
- currency correctness
- decimal precision
- rounding policy
- balance snapshots where useful
Verify:

DEBITS = CREDITS

Never directly mutate financial balances without ledger semantics.

## Separate

- Transferly Points
- Transferly Wallet/Ledger Balances
- Provider Balances
- Pending Funds
- Reserved Funds
- Available Funds
- Settled Funds
Maintain:

1 Transferly Point = ₦1

Preserve the existing service pricing model unless configuration explicitly changes it.

## Reconciliation compares
Transferly transaction
↔ provider transaction
↔ webhook
↔ ledger
↔ settlement information
↔ fees
↔ currency
↔ exchange rate where applicable

Detect:

- missing provider transaction
- missing webhook
- duplicate webhook
- amount mismatch
- currency mismatch
- status mismatch
- fee mismatch
- orphan transaction
- unknown transaction
- duplicate execution
- settlement mismatch
- stale processing transaction
Every repair must be:

- explicit
- authorized
- audited
- idempotent
- reversible where appropriate

## Deliverables

- hardened ledger services
- balance derivation
- reconciliation engine
- reconciliation exception queue
- admin investigation tools
- repair workflow
- invariant test suite
- financial audit reports

---

# PHASE 7 — EVENTS, OUTBOX, OBSERVABILITY, AND OPERATIONS

## Objective
Make the entire platform traceable and operationally manageable.

## Event envelope

- eventId
- eventType
- version
- occurredAt
- tenantId
- actorId
- resourceId
- correlationId
- causationId
- payload

## Event families

- payment.created
- payment.processing
- payment.succeeded
- payment.failed
- payment.unknown
- payout.requested
- payout.processing
- payout.unknown
- payout.succeeded
- payout.failed
- transfer.created
- transfer.processing
- transfer.succeeded
- transfer.failed
- refund.created
- refund.succeeded
- refund.failed
- invoice.created
- invoice.paid
- ledger.entry.created
- reconciliation.exception.created
- reconciliation.resolved
- provider.health.degraded
- provider.health.recovered
- risk.flag.created
- tool.executed
- plugin.installed
- plugin.disabled
- security.event.created
- notification.sent
- notification.failed
Use a transactional outbox where appropriate.

## Trace
Telegram
→ Mini App
→ API
→ transaction
→ queue
→ provider
→ webhook
→ ledger
→ reconciliation
→ notification

## Required identifiers

- requestId
- correlationId
- transactionId
- providerRequestId
- providerTransactionId
- jobId
- actorId
- tenantId
- eventId

## Metrics

- payment success rate
- payout success rate
- unknown transactions
- reconciliation exceptions
- provider latency
- provider error rate
- queue latency
- webhook latency
- ledger failures
- API latency
- tool execution failures
- notification delivery rate
- Mini App load time
- frontend error rate
- accessibility regressions
- bundle size
- database query latency
Never log secrets, tokens, credentials, or unnecessary personal data.

## Deliverables

- structured logging
- distributed tracing
- metrics dashboards
- alert rules
- incident runbooks
- provider health dashboard
- financial operations dashboard
- outbox processor
- dead-letter queue handling

---

# PHASE 8 — CONFIGURATION, ENVIRONMENTS, AND FEATURE CONTROL

## Objective
Make configuration safe, validated, discoverable, and environment-aware.

Organize conceptually into:

config/
environment
providers
security
financial
risk
queues
limits
points
features
observability
notifications
plugins
marketplace

Expose one validated immutable configuration object.

Do not break existing environment variables.

Maintain backward compatibility through migration aliases.

## Feature states

- OFF
- PREVIEW
- SANDBOX
- ENABLED
- PRODUCTION
- DEPRECATED
UI availability must never imply financial execution availability.

Add:

- configuration validation
- startup checks
- secret presence checks
- environment mismatch detection
- provider credential validation
- safe defaults
- configuration audit
- configuration change history

---

# PHASE 9 — POINTS FUNDING, WALLET UX, AND FINANCIAL CLARITY

## Objective
Make balances and funding understandable, safe, and trustworthy.

Maintain:

1 Transferly Point = ₦1

Funding flow:

BUY POINTS
→ PAYMENT INSTRUCTIONS
→ PAYMENT EVIDENCE
→ VERIFICATION
→ APPROVAL
→ CREDIT
→ LEDGER/AUDIT
→ NOTIFICATION

Never credit points before authoritative confirmation.

Funding must be:

- idempotent
- auditable
- traceable
- protected against duplicate submissions
- protected against duplicate approval
- protected against replay
- protected against amount mismatch
- protected against evidence reuse
Clearly distinguish:

- Transferly Points
- Transferly Wallet
- Provider Balance
- Pending Balance
- Available Balance
- Reserved Balance
Add:

- balance explanations
- transaction-linked balance changes
- funding status timeline
- downloadable receipts
- funding instructions
- proof submission validation
- duplicate proof detection
- admin review queue
- user notifications
- funding dispute workflow

---

# PHASE 10 — AUTOMATED PAYOUTS, RISK, AND APPROVALS

## Objective
Automate normal operations while preserving human control over exceptions.

Eligible payouts should execute automatically.

Admin should handle:

- exceptions
- high-risk operations
- policy violations
- reconciliation failures
- unknown outcomes
- manual adjustments
- suspicious activity
- unusual velocity
- new beneficiary risk
- high-value transactions
Use risk and policy thresholds to determine when human intervention is required.

Add:

- velocity limits
- amount limits
- beneficiary verification
- device/session risk
- geographic risk
- unusual behavior detection
- approval chains
- dual control for sensitive actions
- cooling-off periods where appropriate
- risk explanations
- case management
- review notes
- escalation workflows

---

# PHASE 11 — QUOTES, FEES, POINT PREVIEWS, AND TRANSACTION CONFIRMATION

## Objective
Make every financial action transparent before execution.

Before a financial mutation, provide an authoritative backend-generated quote containing:

- amount
- currency
- provider
- provider fee
- Transferly service charge
- Transferly Points required
- total
- estimated timing
- expiration
- applicable limits
- risk/approval requirement
- exchange rate where applicable
- settlement expectations
- refund conditions
- cancellation conditions
The frontend must never calculate authoritative financial totals.

Add:

- quote expiration countdown
- quote refresh
- fee breakdown
- confirmation summary
- final confirmation step for high-impact actions
- clear cancellation behavior
- receipt generation
- quote-to-transaction linkage

---

# PHASE 12 — PROVIDER WORKSPACES AND ADMIN OPERATIONS

## Objective
Create consistent, useful, capability-aware provider and administrative experiences.

## Provider workspace structure

- Overview
- Balance
- Payments
- Payouts
- Transfers
- Refunds
- Invoices
- Payment Links
- Customers
- Transactions
- Analytics
- Activity
- Webhooks
- Health
- Settings
Only expose capabilities the provider genuinely supports.

Distinguish:

PROVIDER_NATIVE

from:

TRANSFERLY_NATIVE

Do not create fake provider capabilities.

PayPal remains the reference workspace.

Use the same framework for Stripe and future providers.

## Admin operations center
Add:

- transaction search
- reconciliation queue
- provider health
- failed jobs
- unknown transactions
- risk cases
- approval queue
- audit log
- user support tools
- configuration status
- incident status
- system announcements
- feature rollout controls
- exportable reports
Use role-based visibility and least privilege.

---

# PHASE 13 — TOOL PLATFORM, PERMISSIONS, AND POLICY ENGINE

## Objective
Create a secure foundation for internal tools, external integrations, AI, and automation.

## Tool contract
Every tool defines:

- toolId
- version
- name
- description
- inputSchema
- outputSchema
- permissions
- scopes
- tenant context
- supported environments
- capability requirements
- risk class
- idempotency policy
- confirmation policy
- rate limits
- audit policy
- execution policy
- timeout policy
- retry policy
High-impact financial tools must use:

READ
→ PREPARE
→ CONFIRM
→ EXECUTE
→ RECONCILE

## Tool registry
Support:

- registration
- discovery
- versioning
- enable/disable
- compatibility
- permissions
- environment restrictions
- audit
- health/readiness
- deprecation
- rollback

## Permission model
IDENTITY
→ TENANT
→ ROLE
→ SCOPE
→ RESOURCE
→ OPERATION
→ AMOUNT
→ CURRENCY
→ RISK
→ ENVIRONMENT
→ POLICY

Support:

- least privilege
- role permissions
- scoped API keys
- organization policies
- amount thresholds
- currency restrictions
- country restrictions
- approval requirements
- separation of duties
- temporary permissions
- revocation
- audit trails
- session-bound permissions
- step-up authentication
Third-party extensions must never receive direct access to:

- database
- ledger tables
- provider credentials
- Redis
- internal secrets
They must use approved tools and APIs.

---

# PHASE 14 — PLUGIN, EXTENSION, AND MARKETPLACE FOUNDATIONS

## Objective
Prepare Transferly for a secure ecosystem without weakening the financial core.

## Plugin lifecycle
DISCOVER
→ INSTALL
→ VERIFY
→ CONFIGURE
→ ENABLE
→ RUN
→ MONITOR
→ DISABLE
→ REVOKE

## Plugin manifest

- identity
- version
- publisher
- permissions
- capabilities
- required APIs
- events
- supported countries
- supported currencies
- supported environments
- risk class
- data access
- financial side effects
- dependencies
- update policy
- security status
Third-party plugins must execute through the Tool API.

## Marketplace metadata

- compatibility
- capabilities
- publisher
- verification status
- permissions
- security status
- pricing
- supported regions
- supported currencies
- changelog
- version
- dependencies
- support status
- review status
- installation count
- last security review
Do not build a complex marketplace UI before the trust model, permissions, sandboxing, and verification process work.

---

# PHASE 15 — MINI APP DESIGN SYSTEM AND VISUAL QUALITY UPGRADE

## Objective
Make the Mini App feel premium, coherent, fast, trustworthy, and easy to use.

Preserve current functionality.

Create a unified design system with:

- color tokens
- typography scale
- spacing scale
- border radius tokens
- elevation tokens
- icon rules
- motion rules
- component states
- dark/light theme strategy
- high-contrast mode
- safe-area handling
- responsive breakpoints

## Recommended navigation

- Home
- Services
- Activity
- Wallet
- More

## Home structure

- greeting header
- Transferly Points card
- wallet summary
- quick actions
- connected providers
- recent activity
- service discovery
- alerts
- recommended services
- support entry point

## Visual improvements
Add:

- consistent card hierarchy
- clear primary actions
- restrained gradients
- meaningful icons
- polished empty states
- clear status badges
- readable financial numbers
- strong contrast
- consistent button sizing
- touch-friendly controls
- bottom sheets for mobile actions
- confirmation dialogs for high-impact actions
- subtle, purposeful motion
- skeleton loading
- contextual help
- inline validation
- clear success and failure feedback
- receipt and timeline views
Avoid:

- excessive decoration
- confusing gradients
- tiny text
- low-contrast labels
- hidden navigation
- excessive modal stacking
- fake real-time status
- ambiguous financial terminology
- crowded dashboards
- unnecessary animation
Clearly distinguish:

- Transferly Points
- Transferly Wallet
- Provider Balance
Never mix them.

---

# PHASE 16 — RESPONSIVE DESIGN, ACCESSIBILITY, AND MOBILE EXCELLENCE

## Objective
Make Transferly excellent across Telegram Mini App devices, tablets, and desktop screens.

Test at minimum:

- 320px
- 360px
- 375px
- 390px
- 414px
- 430px
- 768px
- 1024px
- 1280px
- 1440px
Support:

- safe areas
- keyboard navigation
- screen readers
- reduced motion
- high contrast
- dynamic text sizing
- touch targets of appropriate size
- focus visibility
- semantic headings
- accessible forms
- accessible dialogs
- accessible bottom sheets
- accessible tables
- accessible status announcements
Add:

- responsive tables that become cards on mobile
- sticky action areas where appropriate
- mobile-friendly filters
- swipe-safe interactions
- pull-to-refresh only where useful
- offline-aware messaging
- connection recovery
- graceful handling of Telegram viewport changes
- orientation changes
- keyboard and viewport resizing
Target WCAG 2.2 AA where practical.

---

# PHASE 17 — PERFORMANCE, CACHING, AND RESPONSIVENESS

## Objective
Make the product feel immediate without compromising financial correctness.

Implement:

- route-level code splitting
- lazy provider workspaces
- efficient API requests
- caching of capability metadata
- request deduplication
- optimized bundle
- efficient images and assets
- skeleton loading
- pagination
- virtualization for large lists
- debounced search
- minimized unnecessary renders
- server-side pagination
- cache invalidation rules
- background refresh
- stale-while-revalidate for safe read-only data
- prefetching for likely next screens
- compressed responses
- optimized database queries
- connection pooling
- queue tuning
Do not optimize by weakening financial correctness.

Financial operations must remain server-confirmed.

Never optimistically show:

- payment successful
- payout successful
- points credited
- balance increased
before authoritative confirmation.

## Performance targets
Define and enforce targets for:

- first load
- time to interactive
- interaction latency
- API response time
- transaction list loading
- search response
- provider workspace loading
- bundle size
- memory usage
- error-free sessions

---

# PHASE 18 — UX STATES, NOTIFICATIONS, AND SUPPORT

## Objective
Make every user action understandable and recoverable.

Every major page and action must have:

- loading
- skeleton
- empty
- success
- failure
- retry
- unavailable
- permission denied
- coming soon
- sandbox
- processing
- unknown
- reconciliation required
- offline
- session expired
- rate limited
- maintenance
Use UNKNOWN and RECONCILING explicitly.

## Notification system
Support:

- in-app notifications
- Telegram notifications
- email where configured
- webhook notifications for organizations
- notification preferences
- notification templates
- delivery status
- retry handling
- notification audit
Notify users about:

- payment status
- payout status
- funding status
- reconciliation issues requiring action
- security events
- provider outages
- approvals
- refunds
- invoices
- system maintenance

## Support experience
Add:

- help center
- contextual help
- transaction-linked support tickets
- issue reporting
- FAQ
- status page link
- support escalation
- user-visible incident messaging
- admin notes
- searchable support history

---

# PHASE 19 — UNIVERSAL TRANSACTION CENTER AND FINANCIAL SEARCH

## Objective
Create one consistent place to understand all financial activity.

## Filters

- all
- payments
- payouts
- refunds
- transfers
- invoices
- funding
- provider
- status
- currency
- date
- amount
- operation
- risk state
- reconciliation state

## Transaction detail

- Transferly transaction ID
- provider
- provider reference
- operation
- amount
- currency
- provider fee
- Transferly service charge
- Transferly Points
- current state
- reconciliation state
- timestamps
- timeline
- failure reason
- routing decision
- audit information where permitted
- receipt
- support action
- related transactions
- webhook history where authorized

## Financial search
Search:

- transactions
- payments
- payouts
- invoices
- customers
- providers
- tools
- plugins
- reports
- incidents
- reconciliation cases
Support:

- exact IDs
- references
- names
- status
- date
- amount
- provider
- currency
- email or phone where authorized
Keep permissions enforced at query time.

---

# PHASE 20 — FINANCIAL OPERATIONS ASSISTANT AND AUTOMATION

## Objective
Add intelligent assistance without allowing unsafe autonomous financial mutation.

The assistant may:

- explain transactions
- summarize activity
- identify reconciliation exceptions
- explain routing
- surface anomalies
- search records
- generate reports
- suggest actions
- prepare workflows
- draft support responses
- summarize provider health
- identify operational bottlenecks
For financial mutations:

AI
→ proposed action
→ authorization
→ capability check
→ policy
→ risk
→ quote
→ confirmation
→ idempotency
→ execution
→ reconciliation
→ notification

AI must never directly mutate the ledger.

## Automation foundation
Support:

WHEN
IF
THEN

Examples:

WHEN invoice becomes overdue
IF amount > threshold
THEN notify admin

WHEN balance falls below threshold
THEN create transfer preparation

WHEN provider health degrades
THEN notify operations

WHEN reconciliation exception occurs
THEN create investigation task

WHEN payout exceeds threshold
THEN require approval

Financial execution still passes through the same authorization and execution kernel.

---

# PHASE 21 — DATABASE, SCALABILITY, AND POSTGRESQL READINESS

## Objective
Prepare the system for higher volume and stronger concurrency without unnecessary migration risk.

Introduce repository interfaces:

- LedgerRepository
- WalletRepository
- TransactionRepository
- ProviderRepository
- PayoutRepository
- InvoiceRepository
- ReconciliationRepository
- AuditRepository
- NotificationRepository
- ToolRepository
- PluginRepository
Keep the domain independent from SQLite implementation.

Prepare equivalent PostgreSQL implementations.

Improve:

- indexes
- query plans
- pagination
- transaction isolation
- locking
- connection pooling
- migration safety
- archival strategy
- audit retention
- event retention
- reporting read models
Do not migrate databases simply for the sake of migration.

Preserve existing behavior while improving concurrency and scalability.

---

# PHASE 22 — SECURITY, PRIVACY, AND COMPLIANCE READINESS

## Objective
Protect users, funds, credentials, and platform integrity.

Audit:

- authentication
- authorization
- session handling
- Telegram verification
- API keys
- secrets
- HMAC
- webhook signatures
- rate limiting
- input validation
- output validation
- SSRF
- injection
- CSRF where relevant
- CORS
- file uploads
- payment evidence uploads
- admin operations
- privilege escalation
- tenant isolation
- data export
- data deletion
- audit retention
- sensitive data exposure
- dependency vulnerabilities
Never trust provider responses blindly.

Validate provider responses against schemas.

Add:

- secret rotation
- key rotation
- security headers
- secure cookies
- session revocation
- suspicious login detection
- admin step-up authentication
- security event alerts
- dependency scanning
- static analysis
- dynamic testing
- penetration testing plan
- privacy-conscious logging
- data minimization
- retention policies

---

# PHASE 23 — BACKUP, DISASTER RECOVERY, AND BUSINESS CONTINUITY

## Objective
Ensure Transferly can recover safely from failures.

Create and verify:

- database backups
- ledger backups
- configuration backups
- queue recovery
- webhook replay
- reconciliation recovery
- event replay
- provider credential recovery
- deployment rollback
- incident communication
Test:

- database restore
- ledger integrity after restore
- configuration recovery
- queue recovery
- webhook replay
- reconciliation recovery
- worker restart
- provider outage recovery
- partial deployment rollback
Document:

- RPO
- RTO
- recovery owners
- escalation paths
- incident severity
- communication templates
- recovery runbooks
A backup is not valid until restoration has been tested.

---

# PHASE 24 — RELEASE CONFIDENCE AND DEPLOYMENT SAFETY

## Objective
Make production releases repeatable, observable, and safe.

Strengthen:

- verify
- check:production
- verify:staging
- check:miniapp:bundle
- scan:secrets
- verify:release
Release validation must cover:

- configuration
- migrations
- ledger integrity
- provider contracts
- credentials
- webhook verification
- idempotency
- queues
- reconciliation
- risk
- tests
- Mini App build
- E2E
- security
- dependency audit
- bundle budget
- backup/restore
- failure recovery
- plugin/tool validation
- accessibility
- responsive layouts
- performance budgets
- documentation consistency
Use:

- feature flags
- staged rollout
- canary deployment
- rollback automation
- health checks
- smoke tests
- post-deployment verification
- release notes
- change approval for high-risk financial changes
Production deployment must fail closed when critical checks fail.

---

# PHASE 25 — PLAYWRIGHT, VISUAL REGRESSION, AND LIVE VALIDATION

## Objective
Validate real user workflows across devices and states.

Use Playwright extensively.

Test:

- Telegram Mini App layout
- safe areas
- navigation
- forms
- dialogs
- bottom sheets
- provider workspaces
- transaction pages
- funding flow
- admin pages
- loading states
- error states
- responsive overflow
- accessibility
- touch targets
- keyboard navigation
- dark mode if supported
- offline behavior
- session expiration
- retry flows
- unknown transaction flows
- reconciliation-required flows
- notification flows
Add:

- screenshot regression testing
- visual diff thresholds
- accessibility assertions
- performance assertions
- network failure simulation
- slow-device simulation
- slow-network simulation
- duplicate-click testing
- back-button testing
- viewport resize testing
When a UI issue is discovered:

1. reproduce it
2. identify the root cause
3. fix it
4. rerun the affected test
5. rerun related tests
6. inspect visual regression output
7. verify accessibility
8. verify mobile and desktop behavior
Do not merely report visual problems.

---

# PHASE 26 — CODEBASE CLEANUP AND ARCHITECTURAL CONSOLIDATION

## Objective
Reduce complexity without removing required behavior.

Identify and safely remove:

- dead files
- unused imports
- obsolete components
- duplicate utilities
- duplicate services
- abandoned provider logic
- obsolete feature flags
- stale comments
- temporary scripts
- redundant abstractions
- unused dependencies
- inconsistent naming
- duplicated validation
- duplicated error handling
Do not delete anything unless references are verified.

After cleanup, run:

- lint
- tests
- build
- type/static checks
- E2E
- production checks
- security checks
- bundle checks

---

# PHASE 27 — DOCUMENTATION, ONBOARDING, AND OPERATING KNOWLEDGE

## Objective
Make the system understandable and maintainable.

Document:

- Financial Execution Kernel
- state machines
- UNKNOWN handling
- provider contracts
- capability model
- routing
- idempotency
- reservations
- reconciliation
- event architecture
- Tool Contract
- Permission/Policy Engine
- Plugin architecture
- Marketplace security
- observability
- Mini App architecture
- design system
- accessibility standards
- database abstraction
- disaster recovery
- release confidence
- provider onboarding
- incident response
- support workflows
- configuration
- environment setup
- testing strategy
Documentation must describe the actual implementation.

Never document functionality that does not exist.

Add:

- architecture decision records
- API documentation
- provider integration templates
- contributor guide
- local development guide
- staging guide
- production operations guide
- troubleshooting guide
- glossary of financial terms
- user-facing help content

---

# PHASE 28 — TESTING AND QUALITY GATES
Before considering the work complete, run:

- unit tests
- integration tests
- provider contract tests
- ledger invariant tests
- state-machine tests
- idempotency tests
- reservation tests
- webhook tests
- reconciliation tests
- failure-injection tests
- chaos tests
- security tests
- API tests
- Mini App tests
- accessibility tests
- visual regression tests
- Playwright E2E
- performance tests
- load tests
- build
- lint
- dependency/security checks
- production readiness checks
- backup/restore tests
Test:

- concurrent requests
- duplicate webhooks
- delayed webhooks
- reordered webhooks
- worker restarts
- provider timeouts
- unknown financial outcomes
- duplicate clicks
- expired quotes
- expired reservations
- session expiration
- permission changes during execution
- provider outages
- database outages
- queue failures
- partial deployments
- rollback behavior

---

# NON-NEGOTIABLE FINANCIAL RULES
Never:

- double-charge
- double-credit
- double-execute
- silently convert UNKNOWN to SUCCESS
- blindly retry financial operations
- blindly fail over after timeout
- bypass the ledger
- let plugins mutate the ledger
- let AI bypass authorization
- treat provider balance as Transferly balance
- fabricate provider capabilities
- display unconfirmed financial success
- hide reconciliation problems
- allow unauthorized admin adjustments
- allow duplicate webhook processing to create duplicate financial effects
- allow frontend calculations to override backend financial values
- expose secrets to plugins or clients
- allow a failed release to reach production
- silently repair financial inconsistencies

---

# PRESERVE EXISTING FUNCTIONALITY
Before changing anything, identify and preserve:

- PayPal
- Stripe
- Telegram bot
- Telegram Mini App
- admin portal
- points system
- funding workflow
- invoices
- payouts
- ledger
- risk system
- webhook processing
- queues
- existing authentication
- existing deployment
- existing tests
- existing documentation
Refactor internally where appropriate.

Do not remove an integration merely because the new architecture can support it differently.

---

# IMPLEMENTATION ORDER
Implement incrementally in this order:

1. Phase 0 — Discovery and baseline
2. Phase 1 — Financial Execution Kernel
3. Phase 2 — State machines
4. Phase 3 — Idempotency and reservations
5. Phase 4 — Provider contracts
6. Phase 5 — Eligibility, routing, retry, and failover
7. Phase 6 — Ledger and reconciliation
8. Phase 7 — Events and observability
9. Phase 8 — Configuration and environments
10. Phase 9 — Points and wallet clarity
11. Phase 10 — Risk and automated payouts
12. Phase 11 — Quotes and confirmation
13. Phase 12 — Provider workspaces and admin operations
14. Phase 13 — Tools and permissions
15. Phase 14 — Plugins and marketplace foundations
16. Phase 15 — Design system and visual quality
17. Phase 16 — Responsive and accessible UX
18. Phase 17 — Performance optimization
19. Phase 18 — UX states, notifications, and support
20. Phase 19 — Transaction center and search
21. Phase 20 — Assistant and automation
22. Phase 21 — Database and scalability
23. Phase 22 — Security and privacy
24. Phase 23 — Disaster recovery
25. Phase 24 — Release confidence
26. Phase 25 — Playwright and visual validation
27. Phase 26 — Cleanup
28. Phase 27 — Documentation
29. Phase 28 — Final quality gates
Do not begin marketplace, AI, or advanced automation work before the financial kernel, state machines, idempotency, ledger, reconciliation, and authorization are reliable.

---

# DEFINITION OF DONE
The upgrade is complete only when:

1. Existing functionality still works.
2. Financial mutations use canonical execution semantics.
3. Financial state transitions are explicit.
4. UNKNOWN is handled safely.
5. Idempotency protects every financial mutation.
6. Reservations prevent unsafe concurrent consumption.
7. Provider capabilities are explicit.
8. Eligibility is separated from ranking.
9. Failover is evidence-driven.
10. Ledger invariants are tested.
11. Reconciliation is first-class.
12. Events are standardized.
13. Financial operations are observable end-to-end.
14. Providers pass a shared contract suite.
15. Tools have explicit contracts.
16. Plugins cannot bypass financial controls.
17. Permissions and policies are centralized.
18. Mini App remains fast and responsive.
19. Financial UI never fabricates success.
20. Balances are clearly separated and understandable.
21. Quotes and fees are transparent.
22. Notifications are reliable and auditable.
23. Accessibility requirements are addressed.
24. Responsive layouts work across supported viewports.
25. Visual regression tests pass.
26. Performance budgets pass.
27. Release gates validate financial safety.
28. Backup and recovery have been tested.
29. Security controls are verified.
30. Dead code has been safely removed.
31. Documentation matches implementation.
32. Playwright validates critical mobile and desktop workflows.
33. Support and incident workflows exist.
34. No existing production integration was unnecessarily removed.
35. The product looks polished, coherent, trustworthy, and professional.
36. The system feels like one cohesive financial operating system rather than a collection of disconnected provider integrations.

---

# EXECUTION STYLE
Work in small, reviewable increments.

For each increment:

1. Inspect.
2. Explain the intended change briefly.
3. Identify affected financial, security, UX, and operational surfaces.
4. Implement.
5. Add or update tests.
6. Run relevant Playwright tests.
7. Run lint, build, and static checks.
8. Review the diff.
9. Check for regressions.
10. Check performance impact.
11. Check accessibility impact.
12. Check security impact.
13. Update documentation if architecture changed.
14. Verify rollback or recovery behavior.
15. Continue to the next increment.
Prioritize correctness over speed.

Prioritize financial integrity over UI convenience.

Prioritize reusable primitives over provider-specific hacks.

Prioritize evidence over assumptions.

Prioritize clarity over visual complexity.

Prioritize responsive behavior over fixed layouts.

Prioritize accessibility over decorative interaction.

Do not stop after creating interfaces or placeholder abstractions.

Where practical, implement the real production path.

At the end of every phase, provide:

- files changed
- architecture changes
- functionality preserved
- new functionality
- database changes
- configuration changes
- security impact
- performance impact
- UX impact
- tests executed
- Playwright results
- visual regression results
- remaining risks
- remaining TODOs
- rollback instructions
- recommended next phase
The final system should feel like a cohesive, secure, responsive, premium financial operating system—not a collection of provider integrations.
