Absolutely. I’d split this into **15 execution prompts**, rather than giving Cline one enormous task. That lets it inspect the current implementation, make smaller safe changes, test after each milestone, and avoid breaking your existing integrations.

These prompts are designed to work **on the existing Transferly codebase**, not replace it.

## 1. Production Readiness Registry

```text
TRANSFERLY — PHASE 1
PRODUCTION READINESS + SERVICE CAPABILITY REGISTRY

OBJECTIVE

Transform the existing Transferly codebase into a production-aware platform where every provider/service/capability has an authoritative readiness state.

Do NOT rewrite Transferly.
Do NOT remove existing integrations.
Do NOT replace working provider implementations.
Preserve all existing functionality unless a change is required for correctness, security, reliability, or production readiness.

FIRST: AUDIT

Before modifying anything:

1. Inspect the current repository structure.
2. Inspect git status and recent commits.
3. Inspect provider abstractions and adapters.
4. Inspect capability-related code.
5. Inspect service definitions.
6. Inspect payment/payout/refund/invoice/payment-link flows.
7. Inspect provider workspace code.
8. Inspect routing.
9. Inspect ledger and points.
10. Inspect webhooks and reconciliation.
11. Inspect admin portal.
12. Inspect Mini App.
13. Inspect configuration/environment handling.
14. Inspect migrations/schema.
15. Inspect tests.

Document the current implementation before changing it.

IMPLEMENT

Create one authoritative production readiness model.

Every provider capability/service should support concepts such as:

- provider
- operation
- capability
- operationStatus
- executionEligible
- environment
- enabled
- productionEnabled
- sandboxEnabled
- countries
- currencies
- paymentMethods
- transactionTypes
- limits
- requiredConfiguration
- requiredCredentials
- riskLevel
- reason
- lastVerifiedAt

Use explicit states where appropriate:

- UNSUPPORTED
- PLANNED
- COMING_SOON
- PREVIEW
- SANDBOX
- LIVE
- DISABLED
- DEGRADED
- MAINTENANCE

Do not treat an empty countries/currencies array as automatically meaning "all countries/currencies" unless the system explicitly defines that behavior.

IMPORTANT

Separate:

operationStatus

from:

executionEligible

Example:

SANDBOX + executionEligible=false

COMING_SOON + executionEligible=false

LIVE + executionEligible=true

DISABLED + executionEligible=false

A capability being visible in the UI must never automatically make it executable.

Create a canonical capability/service registry.

Avoid scattered:

if provider === "paypal"

logic throughout the application.

Provider-specific behavior must remain inside provider adapters/capability definitions where possible.

USER EXPERIENCE

Users should clearly see:

LIVE
SANDBOX
COMING SOON
UNAVAILABLE

Never show a production execution button for a capability where executionEligible=false.

COMING SOON services should still have useful information about what the service will eventually provide.

ADMIN

Admin should be able to see:

- provider
- capability
- current state
- environment
- execution eligibility
- reason
- configuration status
- credential status
- health
- last verification
- activation/deactivation state

Do not expose secrets.

TESTS

Add unit/integration tests covering:

- status normalization
- execution eligibility
- unsupported capability
- coming-soon capability
- sandbox capability
- live capability
- disabled capability
- country restrictions
- currency restrictions
- payment method restrictions
- missing configuration
- missing credentials
- provider disabled
- provider degraded

Run:

- tests
- typecheck
- lint
- migrations/schema validation
- build

Also inspect the final diff for unnecessary changes.

DOCUMENTATION

Update project documentation to explain the readiness model and how developers add a new service/provider.

FINAL REPORT

Report:

1. Files changed
2. Database changes
3. API changes
4. Registry changes
5. UI changes
6. Tests
7. Security findings
8. Remaining blockers
9. Which services are actually LIVE
10. Which services remain SANDBOX/COMING_SOON
11. Exact next recommended phase

Do not claim production readiness without evidence.
```

---

# 2. Harden Provider Abstraction, Capabilities & Routing

```text
TRANSFERLY — PHASE 2
PROVIDER CONTRACT + CAPABILITY + ROUTING HARDENING

OBJECTIVE

Harden the existing provider architecture so Transferly can safely support multiple providers without semantic errors or provider-specific logic leaking into the core.

DO NOT rewrite working integrations.
DO NOT remove existing providers.
Preserve compatibility wherever possible.

FIRST AUDIT

Inspect:

- PaymentProvider contract
- provider adapters
- capability service
- capability registry
- routing engine
- payment service
- payout service
- refund service
- transaction types
- payment methods
- countries
- currencies
- provider configuration
- provider health
- provider workspace

FIX TRANSACTION SEMANTICS

Do not map generic "payment" to "invoice".

Distinguish:

- PAYMENT
- INVOICE_PAYMENT
- PAYMENT_LINK
- TRANSFER
- PAYOUT
- REFUND
- SUBSCRIPTION

Use canonical operation enums.

PAYMENT METHODS

Normalize provider-specific terminology into canonical methods:

- CARD
- BANK_TRANSFER
- MOBILE_MONEY
- USSD
- QR
- WALLET
- DIRECT_DEBIT
- BNPL

Do not infer:

bankTransfer = payouts

Do not infer:

cardPayments = hosted payment links

Capability data must represent actual provider capabilities.

COUNTRY/CURRENCY LOGIC

Explicitly distinguish:

- unrestricted
- supported list
- unsupported
- unknown/not verified

An empty array must not accidentally mean unrestricted.

ROUTING

Implement clear stages:

1. ELIGIBILITY
2. RANKING
3. SELECTION
4. EXECUTION

Eligibility must verify:

- provider enabled
- environment
- operation supported
- production eligibility
- country
- currency
- payment method
- transaction type
- amount limits
- provider health
- readiness
- provider configuration
- user/provider preference
- risk requirements

Only after eligibility should ranking occur.

RANKING

Support configurable ranking factors such as:

- success rate
- latency
- provider fee
- configured priority
- availability
- reliability
- risk compatibility

Never select an ineligible provider.

RESULT NORMALIZATION

Create normalized result contracts for:

- PaymentResult
- PayoutResult
- RefundResult
- BalanceResult
- ProviderError
- ProviderWebhookEvent

Provider-specific responses must not leak into domain logic.

Preserve:

- provider transaction ID
- provider reference
- safe metadata
- error code
- error category
- retryability
- raw provider reference where safe

UNKNOWN STATE

Never automatically convert:

UNKNOWN

into:

SUCCESS

Unknown financial operations must enter reconciliation.

TESTS

Create exhaustive tests for:

- operation matching
- payment method matching
- country
- currency
- amount
- environment
- production eligibility
- provider health
- ranking
- unavailable provider
- malformed capability data
- unknown transaction
- provider error normalization

Run full test/build/typecheck/lint.

Use Playwright where UI behavior is affected.

FINAL REPORT

Show the old routing behavior, new routing behavior, important semantic fixes, tests, and remaining risks.
```

---

# 3. Gold-Standard PayPal Production Workspace

```text
TRANSFERLY — PHASE 3
GOLD-STANDARD PAYPAL PROVIDER WORKSPACE

OBJECTIVE

Turn the existing PayPal integration into the first complete production-grade Transferly provider workspace.

Do NOT remove existing PayPal functionality.
Do NOT rewrite working PayPal integrations unnecessarily.
Reuse existing code and progressively harden it.

FIRST AUDIT

Inspect every existing PayPal:

- service
- adapter
- API integration
- authentication
- configuration
- payment flow
- payout flow
- refund flow
- invoice flow
- payment-link flow
- balance flow
- webhook
- reconciliation
- transaction
- workspace
- UI
- tests

Then identify what genuinely works versus what is only UI/preview/sandbox.

WORKSPACE

Create a capability-driven PayPal workspace containing only supported functionality.

Possible sections:

- Overview
- Balance
- Payments
- Payouts
- Refunds
- Invoices
- Payment Links
- Transfers
- Customers
- Transactions
- Analytics
- Reports
- Activity
- Settings

Do NOT display unsupported capabilities as executable.

PROVIDER-NATIVE VS TRANSFERLY-NATIVE

Clearly distinguish:

PROVIDER_NATIVE

from:

TRANSFERLY_NATIVE

Example:

PayPal-native balance

Transferly transaction history

Transferly smart routing

PayPal-native payment

Transferly service charge

Do not claim Transferly functionality is provided by PayPal.

USER FLOW

For every executable operation:

1. Select service
2. Validate request
3. Show quote
4. Show provider
5. Show provider fee where available
6. Show Transferly points cost
7. Confirm
8. Execute
9. Track status
10. Show receipt
11. Update transaction history
12. Process webhook
13. Reconcile where required

POINTS

Preserve:

1 Transferly Point = ₦1

Existing service charges must remain configurable.

Points must be:

- atomic
- idempotent
- auditable
- visible before execution
- impossible to double-charge

BALANCE

Never confuse:

- PayPal provider balance
- Transferly ledger balance
- Transferly points

TRANSACTIONS

Every transaction should show:

- Transferly transaction ID
- provider
- provider reference
- operation
- amount
- currency
- fee
- Transferly points
- status
- timestamps
- failure reason where applicable

ADMIN

Admin should be able to inspect the complete lifecycle but routine successful transactions should not require manual intervention.

TESTING

Use sandbox credentials where available.

If production credentials are unavailable:

DO NOT claim live production verification.

Instead report:

"Architecture implemented. Live provider verification pending credentials/access."

Use Playwright to test the Mini App/mobile workspace.

FINAL REPORT

Identify exactly which PayPal capabilities are:

LIVE
SANDBOX
COMING_SOON
DISABLED

and why.
```

---

# 4. Financial Core + Points Safety

```text
TRANSFERLY — PHASE 4
FINANCIAL SAFETY + LEDGER + TRANSFERLY POINTS HARDENING

OBJECTIVE

Make Transferly financially safe enough to support real users and real transactions.

CORE PRINCIPLE:

Providers are replaceable.
The ledger is not.

Do not rewrite the financial architecture blindly.

FIRST AUDIT

Inspect:

- ledger
- wallets
- balances
- points
- transactions
- payouts
- payments
- refunds
- service charges
- funding
- database transactions
- idempotency
- audit logs

SEPARATE BALANCE DOMAINS

Explicitly distinguish:

1. Provider balance
2. Transferly ledger balance
3. Transferly Points balance

Do not use one database field/model ambiguously for multiple meanings.

POINTS

Maintain:

1 Transferly Point = ₦1

Service charges must be configurable.

A service operation must not:

- execute successfully
- then fail to charge points

or:

- charge points
- then execute twice

Use transactional/atomic semantics.

IDEMPOTENCY

Every financial mutation must support idempotency.

Repeated requests must not:

- duplicate payouts
- duplicate payments
- duplicate refunds
- double-charge points
- double-credit balances

LEDGER

Ledger mutations must be immutable/auditable.

Do not update historical financial entries in place to hide mistakes.

Corrections should use compensating entries where appropriate.

TRANSACTION STATE

Support explicit states including:

- REQUESTED
- VALIDATING
- PROCESSING
- SUBMITTED
- SUCCEEDED
- FAILED
- UNKNOWN
- RECONCILING
- CANCELLED

Never assume provider response equals final settlement.

DATABASE

Use transactions for multi-step financial mutations.

Add constraints where useful to prevent impossible financial states.

AUDIT

Record:

- actor
- action
- transaction
- timestamp
- before/after where appropriate
- request ID
- provider reference
- reason

SECURITY

Do not log:

- secrets
- tokens
- full credentials
- sensitive payment information

TESTS

Test:

- duplicate requests
- concurrent requests
- retry
- timeout
- provider success
- provider failure
- provider unknown
- webhook duplicate
- webhook out of order
- points insufficient
- points double charge
- ledger consistency
- rollback

Run full test suite.

FINAL REPORT

Provide a financial-safety assessment and list any unresolved accounting risks.
```

---

# 5. Automatic Payout Orchestration

```text id="a7c91"
TRANSFERLY — PHASE 5
AUTOMATIC PAYOUT ORCHESTRATION

OBJECTIVE

Make routine eligible payouts automatically execute while routing risky, unsupported, or exceptional payouts to manual review.

CORE BUSINESS RULE

Admin handles exceptions, not routine transactions.

NORMAL FLOW

REQUESTED
→ VALIDATION
→ RISK CHECK
→ AUTO_APPROVED
→ RESERVE
→ PROCESSING
→ SUBMITTED
→ SUCCEEDED

EXCEPTION FLOW

REQUESTED
→ RISK CHECK
→ MANUAL_REVIEW
→ APPROVED / REJECTED

Do not make PENDING_APPROVAL the default path for normal eligible payouts.

FIRST AUDIT

Inspect:

- payout state machine
- admin approval
- risk engine
- provider routing
- ledger reservation
- points charging
- payout execution
- retries
- reconciliation

RISK

Create deterministic risk outcomes such as:

- AUTO_APPROVE
- MANUAL_REVIEW
- BLOCK

Possible risk factors:

- amount
- velocity
- destination
- user/account status
- provider requirements
- transaction history
- suspicious patterns
- configuration

Do not invent regulatory requirements.

AUTOMATION

Eligible payouts should execute without admin interaction.

Admin intervention should occur for:

- high risk
- provider exception
- unknown transaction
- reconciliation mismatch
- policy restriction
- account restriction
- configuration failure

RESERVATION

Ensure funds are reserved exactly once.

If execution fails safely, release/adjust reservation correctly.

UNKNOWN

If provider response is ambiguous:

UNKNOWN
→ RECONCILING

Never automatically retry an unknown money movement unless the provider/idempotency semantics prove the retry is safe.

ADMIN

Create queues for:

- Manual Review
- Unknown Transactions
- Reconciliation Exceptions
- Failed Payouts

TEST

Test:

- normal automatic payout
- insufficient balance
- high-risk payout
- manual approval
- rejection
- provider timeout
- duplicate request
- webhook
- unknown result
- reconciliation

Use Playwright for affected admin and Mini App flows.

FINAL REPORT

Explain exactly which payout scenarios are automatic and which require intervention.
```

---

# 6. Webhooks + Reconciliation

```text
TRANSFERLY — PHASE 6
WEBHOOK RELIABILITY + FINANCIAL RECONCILIATION

OBJECTIVE

Make Transferly resilient to delayed, duplicated, reordered, missing, or ambiguous provider events.

FIRST AUDIT

Inspect:

- webhook endpoints
- signature verification
- webhook persistence
- queues
- idempotency
- event processing
- transaction state updates
- reconciliation
- provider references

WEBHOOK PIPELINE

Use:

RECEIVE
→ VERIFY
→ PERSIST
→ DEDUPLICATE
→ PROCESS
→ UPDATE DOMAIN
→ LEDGER
→ NOTIFY
→ RECONCILE

Never trust an unverified webhook.

Never process the same webhook twice.

RECONCILIATION CASES

Support explicit outcomes:

- MATCH
- MISSING_PROVIDER_TRANSACTION
- MISSING_LEDGER_ENTRY
- AMOUNT_MISMATCH
- CURRENCY_MISMATCH
- STATUS_MISMATCH
- DUPLICATE
- UNKNOWN

UNKNOWN must never silently settle as SUCCESS.

OUT-OF-ORDER EVENTS

Handle:

SUCCESS before PROCESSING

or:

REFUND before final payment state

without corrupting the state machine.

RECONCILIATION

Create jobs that compare:

provider records
vs
Transferly transactions
vs
ledger entries

Provide safe exception handling.

ADMIN

Create a reconciliation dashboard showing:

- unresolved cases
- amount mismatches
- status mismatches
- unknown transactions
- duplicate events
- missing records

Do not allow arbitrary manual editing of financial history.

Use compensating/corrective operations.

TESTS

Simulate:

- duplicate webhook
- delayed webhook
- missing webhook
- invalid signature
- wrong amount
- wrong currency
- wrong status
- duplicate provider transaction
- unknown transaction
- reconciliation recovery

FINAL REPORT

List all webhook/reconciliation failure scenarios now covered.
```

---

# 7. Universal Transaction Center

```text
TRANSFERLY — PHASE 7
UNIVERSAL TRANSACTION CENTER

OBJECTIVE

Create one user-facing transaction center that aggregates Transferly activity across providers while preserving provider-specific details.

Do not remove existing transaction pages.

UNIFY

Show:

- provider
- operation
- amount
- currency
- Transferly points
- status
- date
- reference

Support:

- search
- filters
- provider filter
- service filter
- status filter
- currency filter
- date filter
- transaction type filter

DETAIL PAGE

Show:

Transferly transaction ID
Provider
Provider reference
Operation
Amount
Currency
Provider fee
Transferly service charge
Points charged
Current state
Created time
Updated time
Timeline
Failure reason
Webhook/reconciliation status where appropriate

TIMELINE

Example:

REQUESTED
↓
VALIDATED
↓
ROUTED
↓
SUBMITTED
↓
PROCESSING
↓
SUCCEEDED

Do not display internal sensitive data.

RECEIPTS

Provide a clean receipt view.

Ensure transaction data is derived from authoritative domain/ledger sources rather than duplicated UI state.

PERFORMANCE

Use pagination.
Avoid loading thousands of transactions into the Mini App.

TEST

Use Playwright on mobile Telegram-style viewport.

Verify:

- scrolling
- filters
- transaction details
- empty state
- loading
- error state
- slow network
- mobile layout

FINAL REPORT

Explain how transactions from multiple providers are normalized and displayed.
```

---

# 8. Admin Operations Center

```text
TRANSFERLY — PHASE 8
ADMIN OPERATIONS CENTER

OBJECTIVE

Transform the existing admin portal into a professional financial operations console.

ADMIN SHOULD MANAGE EXCEPTIONS, NOT ROUTINE TRANSACTIONS.

DASHBOARD

Display:

- transaction volume
- successful transactions
- failed transactions
- pending transactions
- unknown transactions
- reconciliation exceptions
- manual reviews
- provider health
- webhook failures
- queue health
- system health

OPERATIONS QUEUES

Create:

1. Manual Reviews
2. Unknown Transactions
3. Reconciliation Exceptions
4. Failed Webhooks
5. Provider Incidents
6. Failed Payouts

TRANSACTION INSPECTION

Admin can inspect:

- transaction
- user
- provider
- routing decision
- state timeline
- ledger references
- provider reference
- webhook history
- reconciliation result
- risk result
- audit trail

PERMISSIONS

Implement least-privilege admin actions.

Separate:

- view
- review
- approve
- reject
- refund
- configuration
- provider management
- financial operations

Every privileged action must be audited.

DANGEROUS ACTIONS

Require confirmation for:

- refunds
- manual financial corrections
- payout intervention
- provider disabling
- production configuration changes

Do not expose secrets.

TEST

Use Playwright to test:

- admin login
- dashboard
- queues
- transaction detail
- review
- permissions
- mobile/tablet responsiveness

FINAL REPORT

List all admin actions and their permission/audit requirements.
```

---

# 9. Provider Health + Incident System

```text
TRANSFERLY — PHASE 9
PROVIDER HEALTH + INCIDENT MANAGEMENT

OBJECTIVE

Prevent provider outages from becoming Transferly-wide failures.

PROVIDER HEALTH

Track:

- API availability
- authentication
- latency
- error rate
- success rate
- webhook health
- configuration status
- provider status
- recent failures

Statuses:

- HEALTHY
- DEGRADED
- DOWN
- MAINTENANCE
- UNKNOWN

ROUTING

Routing must consider health after capability eligibility.

Do not route transactions to providers that are:

- disabled
- unavailable
- not production eligible
- unhealthy for the requested operation

Do not automatically disable a provider based on one failure.

Use sensible thresholds/windowing.

INCIDENT MODE

When a provider becomes unavailable:

- stop new eligible routing where appropriate
- preserve existing transactions
- show accurate UI status
- avoid duplicate submissions
- surface incident to admin

USER MESSAGE

Use professional messaging such as:

"Temporarily unavailable"

rather than exposing internal errors.

FAILURE RECOVERY

When provider recovers:

- re-test health
- gradually restore routing
- record incident
- maintain audit trail

TEST

Simulate:

- latency
- timeout
- authentication failure
- HTTP errors
- webhook outage
- recovery

FINAL REPORT

Show how routing reacts to each health state.
```

---

# 10. Quote + Fee + Points Engine

```text
TRANSFERLY — PHASE 10
PRE-TRANSACTION QUOTE + FEE TRANSPARENCY

OBJECTIVE

Before users execute a financial operation, show exactly what Transferly knows about cost.

QUOTE

Create a normalized quote containing where available:

- transaction amount
- currency
- provider
- provider fee
- Transferly service fee
- Transferly points charge
- estimated total
- quote expiry
- exchange rate where applicable
- warnings

POINTS

Display:

Transferly service charge: X points

Remember:

1 Transferly Point = ₦1

Do not silently deduct points before user confirmation.

ATOMIC EXECUTION

The confirmed quote must be bound to the transaction where appropriate.

Prevent:

quote says 250 points

but execution charges 500 points

unless the user is clearly shown a changed quote and reconfirms.

PROVIDER FEE

Never invent fees.

If the provider cannot provide an exact fee before execution, state that accurately.

Do not present estimates as guaranteed amounts.

TEST

Test:

- zero fee
- known fee
- estimated fee
- unavailable fee
- expired quote
- insufficient points
- changed quote
- duplicate confirmation

FINAL REPORT

Explain how quotes interact with routing and execution.
```

---

# 11. Sandbox / Simulation Lab

```text
TRANSFERLY — PHASE 11
SANDBOX + PAYMENT SIMULATION LAB

OBJECTIVE

Create a safe environment for testing Transferly's financial state machines, routing, webhooks, reconciliation and failure handling without real money.

DO NOT allow simulation endpoints to execute against production providers.

SIMULATION SCENARIOS

Support:

- success
- insufficient funds
- provider timeout
- provider error
- duplicate request
- duplicate webhook
- delayed webhook
- missing webhook
- unknown result
- amount mismatch
- currency mismatch
- refund failure
- payout failure
- provider outage

SIMULATED PROVIDER

Implement a provider adapter that conforms to the same provider contract as real providers.

It must expose:

- capabilities
- operations
- payments
- payouts
- refunds
- balances
- webhooks
- health
- errors

ENVIRONMENT SAFETY

Simulation must be impossible to route into production accidentally.

Explicitly separate:

SIMULATION
SANDBOX
PRODUCTION

TESTS

Use the simulator to exercise:

- routing
- state machines
- ledger
- points
- webhook processing
- reconciliation
- retries
- unknown states

Create repeatable automated tests.

FINAL REPORT

Show how developers can reproduce each financial failure scenario.
```

---

# 12. Security + Production Hardening

```text
TRANSFERLY — PHASE 12
PRODUCTION SECURITY HARDENING

OBJECTIVE

Perform a full security review before real users and financial activity are enabled.

AUDIT

Inspect:

- authentication
- authorization
- sessions
- Telegram authentication
- admin authentication
- API authentication
- API keys
- secrets
- environment variables
- database access
- webhook signatures
- rate limits
- CORS
- CSRF where relevant
- injection risks
- XSS
- SSRF
- path traversal
- logging
- error responses
- file uploads
- payment evidence
- access control

FINANCIAL SECURITY

Verify:

- idempotency
- transaction authorization
- points authorization
- ledger protection
- payout authorization
- refund authorization
- provider credential isolation
- audit logging

RATE LIMITING

Protect:

- authentication
- payments
- payouts
- refunds
- webhook endpoints
- admin operations
- public APIs

SECRETS

Ensure:

- secrets never committed
- secrets never displayed
- secrets never logged
- production credentials separated from sandbox
- configuration validation at startup

INPUT VALIDATION

Use existing schema validation where possible.

Do not trust client-side values for:

- user ID
- amount
- points
- provider
- transaction
- permissions

Server must derive authoritative values.

TEST

Run security-focused tests and dependency audit.

Do not automatically perform risky dependency upgrades without checking compatibility.

FINAL REPORT

Classify findings:

CRITICAL
HIGH
MEDIUM
LOW

Do not call the platform production-ready while critical/high financial security issues remain unresolved.
```

---

# 13. Playwright Production UX Gate

```text
TRANSFERLY — PHASE 13
END-TO-END USER + ADMIN UX PRODUCTION GATE

OBJECTIVE

Validate the actual Transferly application as a user would experience it.

Use Playwright/live browser testing where supported.

DO NOT rely only on unit tests.

USER FLOWS

Test:

1. Open app
2. Authenticate
3. View dashboard
4. View points balance
5. Open services
6. Open provider workspace
7. View capability
8. Select service
9. Receive quote
10. Confirm
11. Execute sandbox/live-approved operation
12. View transaction
13. View receipt
14. Navigate history
15. Handle failure
16. Handle unavailable service

ADMIN FLOWS

Test:

1. Admin authentication
2. Dashboard
3. Provider health
4. Transactions
5. Manual review
6. Unknown transaction
7. Reconciliation exception
8. Provider enable/disable
9. Service readiness
10. Audit trail

RESPONSIVE

Test at:

- iPhone-sized viewport
- Android-sized viewport
- tablet
- desktop

TELEGRAM MINI APP

Pay special attention to:

- viewport
- safe areas
- keyboard
- scrolling
- bottom navigation
- modal behavior
- touch targets
- loading
- back navigation

FAILURE STATES

Test:

- network unavailable
- slow API
- provider failure
- expired session
- insufficient points
- unavailable service
- duplicate submission

PERFORMANCE

Identify:

- unnecessary API calls
- duplicate requests
- slow rendering
- large payloads
- unnecessary dependencies
- blocking operations

FIX real problems discovered.

FINAL REPORT

Include screenshots/test evidence where available and list remaining UX problems.
```

---

# 14. Production Validation + Launch Gate

```text
TRANSFERLY — PHASE 14
PRODUCTION LAUNCH GATE

OBJECTIVE

Create a single authoritative production readiness process.

Create:

npm run production:check

or the project's equivalent.

THE CHECK MUST VALIDATE

APPLICATION

- build
- startup
- configuration
- environment
- database
- migrations

FINANCIAL

- ledger
- points
- idempotency
- transaction state machines
- reconciliation

PROVIDERS

For every provider:

- configured
- credentials present
- authentication verified
- capability verified
- environment verified
- production enabled
- health verified

SERVICES

For every service marked LIVE:

- implementation exists
- execution is enabled
- provider capability exists
- configuration is valid
- tests pass
- error handling exists
- webhook handling exists where applicable
- reconciliation exists where applicable
- points charging exists where applicable
- audit exists

USER EXPERIENCE

- Mini App build
- routes
- loading states
- error states
- mobile layout
- authentication

SECURITY

- secrets check
- dependency audit
- authorization checks
- webhook verification
- rate limits

TESTS

Run:

- unit tests
- integration tests
- end-to-end tests
- typecheck
- lint
- build
- migrations
- smoke tests

IMPORTANT

The launch gate must FAIL if a service is marked LIVE but lacks required production conditions.

It must be possible to launch Transferly with:

some services = LIVE

others = SANDBOX / COMING_SOON / DISABLED

This is intentional.

FINAL OUTPUT

Generate a machine-readable and human-readable production readiness report.

Example:

PAYPAL PAYMENTS
LIVE ✓

PAYPAL PAYOUTS
LIVE ✓

STRIPE PAYOUTS
COMING_SOON ○

PAYSTACK PAYMENTS
COMING_SOON ○

Never mark anything LIVE based solely on UI existence.

FINAL REPORT

Provide the exact remaining blockers before launch.
```

---

# 15. Final Cleanup, Performance & Launch Preparation

```text
TRANSFERLY — PHASE 15
FINAL PRODUCTION CLEANUP + PERFORMANCE + LAUNCH PREPARATION

OBJECTIVE

Prepare the existing Transferly codebase for real users without destabilizing working functionality.

FIRST

Perform a complete repository audit.

Find:

- dead code
- unused files
- unused folders
- duplicate implementations
- obsolete components
- unused dependencies
- unnecessary dependencies
- duplicated services
- duplicated types
- stale documentation
- old migrations
- abandoned experiments
- development-only code accidentally exposed to production
- debug logging
- console logging
- temporary feature flags
- unsafe TODOs
- incomplete production paths

DO NOT DELETE anything blindly.

For every candidate:

1. Determine whether it is referenced.
2. Determine whether it is required dynamically.
3. Determine whether it is used by tests/build/deployment.
4. Determine whether it is part of an active migration.
5. Determine whether it is required for future compatibility.

Only remove code when safe.

PERFORMANCE

Inspect:

- API latency
- database queries
- N+1 queries
- unnecessary API requests
- frontend rendering
- bundle size
- duplicate requests
- polling
- queues
- Redis usage
- cache behavior
- database indexes

Do not optimize by introducing unnecessary complexity.

CONFIGURATION

Centralize validated configuration.

Startup should fail clearly when critical production configuration is missing.

Do not expose secrets.

DEPENDENCIES

Review dependency vulnerabilities.

Do not blindly perform major-version upgrades.

For known React Router or other major dependency migrations:

- document
- plan
- test
- migrate separately when required

Do not introduce breaking upgrades simply to make a vulnerability report disappear.

DOCUMENTATION

Update:

- README
- setup
- environment configuration
- provider setup
- service readiness
- production deployment
- troubleshooting
- architecture
- financial safety
- provider integration guide

Ensure documentation describes actual implementation.

GIT

Inspect:

- git diff
- changed files
- accidental files
- generated files
- secrets
- environment files

Do not commit credentials.

FINAL TEST

Run everything available:

- lint
- typecheck
- unit
- integration
- E2E
- build
- migrations
- smoke
- production check
- dependency audit
- security checks

Run Playwright against the important user/admin flows.

FINAL REPORT

Produce:

1. Production readiness scorecard
2. LIVE services
3. SANDBOX services
4. COMING_SOON services
5. DISABLED services
6. Critical blockers
7. High-risk issues
8. Medium/low issues
9. Removed dead code
10. Performance improvements
11. Security improvements
12. Database changes
13. Provider changes
14. User UX changes
15. Admin UX changes
16. Test results
17. Deployment requirements
18. Credential requirements
19. Recommended post-launch roadmap

IMPORTANT

Do not claim Transferly is production-ready merely because tests pass.

Production readiness requires evidence for the actual services being enabled.
```

## The execution order I recommend

Don't paste all 15 at once.

Run them in this order:

**1 → 2 → 4 → 3 → 5 → 6 → 10 → 7 → 8 → 9 → 11 → 12 → 13 → 14 → 15**

That ordering is deliberate: **financial correctness comes before UI expansion**, and **real production verification comes before calling anything LIVE**.

The immediate target is not "every Transferly service works."

It is:

> **Transferly itself is production-ready, while every individual service has an honest, technically enforced readiness state.**

Then you can continuously turn:

**COMING_SOON → SANDBOX → LIVE**

without redesigning the platform each time.
