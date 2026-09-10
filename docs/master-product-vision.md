# Transferly Master Product Vision & Architecture

**Status:** Active | **Last Updated:** 2026-09-09
**For:** Cline/Codex implementation guidance, Mintlify documentation, future reference

> **Transferly — an intelligent, provider-agnostic financial infrastructure platform for payments, payouts, wallets, invoices, reconciliation, and business financial operations.**

---

## 1. Product North Star

Transferly should become a **Telegram-native financial operating layer** for modern businesses:

> **One place to request, collect, track, reconcile, and safely move money, with proactive bot automation and evidence-backed transaction status.**

Every feature must support this position rather than merely adding another provider dashboard.

---

## 2. The Three-Layer Capability Model

### Layer 1 — Provider-Native Capabilities

What the provider genuinely supports. Examples:

- PayPal: invoices, payouts, payments, webhooks, disputes, subscriptions
- Stripe Connect: payments, billing, connected accounts, refunds, webhooks
- Wise: receive, send, balances, compliance
- Paystack: collections, transfers, customers, virtual accounts, subscriptions, refunds, webhooks
- Flutterwave: collections, transfers, settlements, refunds, webhooks

**Transferly never claims native support for what a provider lacks.** Instead, we expose only what exists.

---

### Layer 2 — Transferly-Enhanced Capabilities

Intelligence built around providers:

- **Smart Routing** – automatically selects the optimal provider based on country, currency, payment method, capability, health, fees, latency, limits, and risk.
- **Provider Health** – real-time monitoring and status indicators.
- **Automatic Failover** – routes to alternate providers when the primary is unavailable *before* execution.
- **Unified Transaction History** – cross-provider aggregation with provider tagging.
- **Reconciliation Engine** – matches provider observations with internal ledger entries.
- **Risk Engine** – scores transactions 0–100; blocks high-risk items automatically.
- **Analytics & Reporting** – per-provider and global dashboards with settlement data.
- **Audit Trails** – immutable records for every financial mutation.
- **Notification Automation** – Telegram, email, webhook, and push notifications with customizable rules.

---

### Layer 3 — Transferly-Universal Capabilities

Capabilities independent of any single provider:

- **Global Wallet** – aggregates balances across all connected providers.
- **Transaction Center** – unified timeline showing request → provider → webhook → ledger.
- **Payment Links** – reusable URLs for collecting payments across any supported method.
- **Universal Checkout** – card, bank, mobile-money, wallet, PayPal, Stripe options (shown dynamically).
- **Business Management** – organizations, RBAC, team members, provider preferences.
- **SDKs & APIs** – RESTful JSON with OpenAPI contract; TypeScript definitions for frontend.
- **Developer Sandbox** – test wallets, simulated providers, webhook testing, test fixtures.

---

## 3. Provider-First Workspaces

Each connected provider becomes a first-class financial workspace. Navigation is generated from the provider capability manifest, ensuring:

- only supported features appear as navigable tabs;
- actions are enabled or disabled based on actual provider state (`live`, `preview`, `setup`);
- unsupported lanes remain visible only as **Coming Soon** and never call provider APIs, create orders, or charge points.

### Provider Workspace Manifest (Schema)

```json
{
  "id": "paypal",
  "slug": "paypal",
  "displayName": "PayPal",
  "shortDescription": "Transferly-owned PayPal operations workspace.",
  "icon": "paypal",
  "accentColor": "#0070BA",
  "docsUrl": "https://developer.paypal.com/docs/",
  "supportUrl": "https://www.paypal.com/us/cshelp/",
  "environments": ["sandbox", "live"],
  "capabilities": [
    "invoices", "payouts", "payments", "orders", "transactions",
    "webhooks", "disputes", "subscriptions", "tokens", "fx"
  ],
  "status": "live",
  "lanes": [
    { "id": "overview", "label": "Overview", "intent": "overview", "status": "live" },
    { "id": "invoices", "label": "Invoices", "intent": "collect", "status": "live" },
    { "id": "payouts", "label": "Payouts", "intent": "send", "status": "live" },
    { "id": "payments", "label": "Payments", "intent": "payments", "status": "preview" },
    { "id": "transactions", "label": "Transactions", "intent": "reconciliation", "status": "preview" },
    { "id": "webhooks", "label": "Webhooks", "intent": "webhooks", "status": "live" }
  ]
}
```

### Lane Status Semantics

| Status | Meaning |
|--------|---------|
| `live` | Fully functional; money movement is enabled after policy checks. |
| `preview` | UI or partial backend support exists; do not present as production-ready. |
| `setup` | Placeholder with setup guidance; no provider API call or financial mutation. |


---

## 4. Provider Capabilities by Platform

### PayPal

| Capability | Status | Notes |
|------------|--------|-------|
| Invoices | ✅ Live | Create, send, refresh, cancel, release funds |
| Payouts | ✅ Live | Mass payouts with deterministic batch IDs |
| Payments | ⚠ Preview | Captures, refunds, voids, payment timelines |
| Webhooks | ✅ Live | Signature verification, receipt persistence, replay readiness |
| Disputes | ⚠ Preview | Evidence submission and status tracking |
| Subscriptions | ⚠ Preview | Lifecycle management |
| FX | ⚠ Preview | Currency conversion rates |

**Official reference:** https://developer.paypal.com/docs/

### Stripe Connect

| Capability | Status | Notes |
|------------|--------|-------|
| Payments | ✅ Live | Customer → invoice item → invoice → finalize flow |
| Billing | ⚠ Preview | Subscriptions, invoices, customer portal |
| Connected Accounts | ✅ Live | Onboard, refresh, and gated transfer submission |
| Webhooks | ✅ Live | Event verification and idempotency |
| Refunds | ⚠ Setup | Refund operations remain adapter work; do not present refunds as production-ready |

**Official reference:** https://docs.stripe.com/connect

### Wise

| Capability | Status | Notes |
|------------|--------|-------|
| Receive | ⚠ Setup | Account details and balance checks |
| Send | ⚠ Setup | Quotes, recipients, transfers |
| Balances | ⚠ Setup | Multi-currency balances |
| Compliance | ⚠ Setup | Verification and transfer readiness |

**Official reference:** https://docs.wise.com/

### Paystack

| Capability | Status | Notes |
|------------|--------|-------|
| Collections | ⚠ Setup | Card, bank, mobile-money collection |
| Customers | ⚠ Setup | Customer lookup and profile readiness |
| Virtual Accounts | ⚠ Setup | Dedicated collection destinations |
| Subscriptions | ⚠ Setup | Recurring billing |
| Webhooks | ⚠ Setup | Event ingestion and signature verification |

**Official reference:** https://paystack.com/docs/

### Flutterwave

| Capability | Status | Notes |
|------------|--------|-------|
| Collections | ⚠ Setup | Card, bank, mobile-money collection |
| Transfers | ⚠ Setup | Payouts and recipient management |
| Settlements | ⚠ Setup | Settlement tracking and reconciliation |
| Refunds | ⚠ Setup | Refund lifecycle |
| Webhooks | ⚠ Setup | Event verification |

**Official reference:** https://developer.flutterwave.com/docs

### Crypto Commerce

| Capability | Status | Notes |
|------------|--------|-------|
| Charges | ✅ Live | Invoice-like collection, refresh, signed webhook settlement |
| Payouts | ❌ Unsupported | Outgoing crypto payouts remain unsupported until custody and payout controls are approved |
| Webhooks | ✅ Live | Signed event ingestion and settlement review flags |

**Official reference:** https://docs.cdp.coinbase.com/commerce/docs

---

## 5. Automatic Payout Lifecycle

Normal payouts execute **without admin approval** when all checks pass:

```
User requests payout
        ↓
Validate request (amount, beneficiary)
        ↓
Calculate service points (fees)
        ↓
Check available balance & reserve
        ↓
Risk/policy evaluation (score < 30 → auto)
        ↓
Provider capability check (eligible provider)
        ↓
Provider selection (Smart Routing or user preference)
        ↓
Execute payout → provider API
        ↓
Provider confirmation → webhook
        ↓
Ledger settlement (transaction entry)
        ↓
Notification (success/failure)
```

### Service Pricing Engine

The points economy is currently `1 Transferly Point = ₦1`, with an ordinary default service charge of `250 points`. An explicit service configuration override wins when present; the implementation resolves that fallback in `api/services/pointPricingService.js`. The following are target operating examples, not fixed global constants:

| Workflow | Target example | Current pricing source |
|----------|----------------|------------------------|
| Create invoice | 250 points | Service override, otherwise default |
| Receive payment | 250 points | Service override, otherwise default |
| Payout | 250 points | Service override, otherwise default |
| Refund | 150 points | Service override, otherwise default |
| Webhook replay | 0 points | Internal recovery path; no service quotation |
| Provider balance check | 0 points | Internal readiness check; no service quotation |

**Pre-transaction quote target:**

```text
Confirm Payout

Amount:         ₦100,000
Provider:       Paystack
Provider fee:   ₦1,500
Transferly fee: 250 points

Estimated completion: provider-dependent; display only when supported by the provider contract

[Confirm payout] [Cancel]
```

Use a provider-qualified example when Paystack payout money movement has passed the provider enablement gate. The existing Stripe payout preview already returns fee, total debit, internal wallet impact, risk path, and admin-only Stripe balance context, but Stripe submission remains gated.

---

## 6. Risk-Based Admin Intervention

A policy engine routes transactions based on configurable signals, risk levels, and decisions. The implementation currently uses `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL` levels with `ALLOW`, `ALLOW_WITH_MONITORING`, `REQUIRE_REVIEW`, `REQUIRE_VERIFICATION`, `TEMPORARILY_RESTRICT`, and `BLOCK` decisions; see `api/services/riskEngineService.js`. A future 0–100 numerical score may standardize these thresholds:

| Target score | Target action |
|--------------|---------------|
| 0–29 | ✅ Auto-execute |
| 30–59 | ⚠ Queue for review |
| 60–79 | 🛑 Request additional info |
| 80–100 | ❌ Block for investigation |

**Risk signals include:**
- Transaction velocity and amount
- Account history and age
- Destination country match
- Provider success anomalies
- Unusual behavior patterns
- Configurable rule violations

Every blocked or reviewed item includes an **explanation** visible to admins.

---

## 7. Financial Integrity and Ledger Architecture

The internal ledger is Transferly's financial source of truth. Provider balances, statuses, settlements, and callbacks are observations that must be reconciled to local records; they never independently authorize a balance mutation.

```text
Business transaction
        ↓
Balanced ledger entries
        ↓
Wallet and reporting projections
```

Every financial record should preserve:

- a globally unique Transferly transaction ID;
- deterministic idempotency and provider reference keys;
- source, destination, amount, and currency;
- provider fee and Transferly service-point charge as separate values;
- provider attempts and observed state;
- reservation, settlement, reversal, and reconciliation state;
- actor, timestamps, correlation IDs, and audit evidence.

Wallet and ledger mutations must remain transactional. Reservations prevent concurrent spending while provider work is unresolved. A terminal provider failure releases or reverses the relevant reservation according to policy; an unknown state remains reserved and enters reconciliation.

### Reconciliation

```text
Provider observations ←→ Transferly transactions ←→ Ledger entries
                                      ↓
                              Wallet projections
```

Reconciliation detects missing or duplicate transactions, amount or currency mismatches, fee discrepancies, incomplete local effects, stale reservations, and unknown provider states. Every mismatch must have a stable classification, owner, remediation path, and audit trail.

---

## 8. Universal Transaction Graph

Every financial workflow receives one global Transferly identifier. Opening it should reveal the full causality graph:

```text
Customer / organization
        ↓
Invoice, payment, payout, or refund
        ├── quote and service-point reservation
        ├── risk and policy decision
        ├── provider selection and attempts
        ├── provider callbacks and polling observations
        ├── ledger entries and wallet projection
        ├── notifications and outbound webhooks
        └── reconciliation and operator actions
```

Global search should resolve Transferly IDs, provider references, invoice and payout IDs, webhook event IDs, customers, and authorized user or organization identifiers without exposing secrets or private provider payloads.

---

## 9. Event and Recovery Architecture

Canonical domain events include:

```text
payment.created       payment.processing       payment.succeeded
payment.failed        payout.created            payout.processing
payout.succeeded      payout.failed             refund.created
refund.succeeded      invoice.created           invoice.paid
risk.flagged          risk.cleared              provider.degraded
provider.recovered    reconciliation.mismatch
```

Events feed ledger projections, analytics, notifications, customer webhooks, and audit records. An event name is not proof that all downstream effects completed.

Transferly should use a transactional outbox for durable local event publication and a provider-operation inbox for verified provider observations. Consumers must be idempotent, retry with bounded policies, persist terminal failure, and support authorized replay. Unknown financial outcomes go to reconciliation rather than blind retries or failover.

---

## 10. Platform Architecture

Transferly remains a modular monolith until evidence justifies extraction:

```text
Telegram Mini App      Telegram bot      External API clients
        └──────────────────┬──────────────────┘
                           ↓
                 Express routes/controllers
                           ↓
        Policies and services / workflow orchestration
             ├─────────────┼─────────────┐
             ↓             ↓             ↓
       Repositories   Provider adapters  Jobs/webhooks
             ↓             ↓             ↓
          SQLite       Provider APIs   Redis/BullMQ
             └─────────────┬─────────────┘
                           ↓
                    Ledger and audit
```

Ownership rules:

- `routes/` and `controllers/` own HTTP transport only;
- `schemas/` validate untrusted boundary data with strict Zod schemas;
- `services/` own policy-sensitive workflows and transactions;
- `repositories/` own SQL and record mapping;
- `adapters/`, `jobs/`, and `webhooks/` own external side effects;
- `api/providers/` owns provider modules and contracts;
- `miniapp/src/providers/` owns provider workspace UI composition;
- `api/constants/providerWorkspaceContract.js` owns the shared workspace manifest.

Move authoritative persistence to PostgreSQL only when measured concurrency, availability, or operational requirements demand it. Extract services only at proven scaling or security boundaries; ledger mutation remains centralized.

---

## 11. Product Surfaces

### Financial experience

- **Provider wallets:** normalized available, pending, reserved, incoming, and outgoing views without inventing provider-native wallet semantics.
- **Global wallet:** cross-provider portfolio and currency views; never collapse unlike currencies into one total without an explicit, timestamped FX valuation.
- **Invoices 2.0:** branded documents, private PDF generation, payment links, recurring schedules, partial payments, expiry, reminders, discounts, taxes, attachments, and a defined lifecycle.
- **Payment links and checkout:** dynamically expose eligible providers and payment methods after capability, jurisdiction, health, currency, and policy checks.
- **Transaction center:** explicit submitted, processing, confirmed, failed, reversed, and unknown states with safe next actions.
- **Scheduled payouts:** daily, weekly, monthly, or threshold-based initiation subject to balance, risk, compliance, and concurrency controls.

### Business platform

- Organizations with owner, finance, operations, developer, support, and viewer roles.
- Resource-scoped permissions for payments, payouts, refunds, providers, credentials, API keys, webhooks, reports, risk, and settings.
- Transferly-managed, user-connected, and business-connected provider accounts with explicit ownership and settlement rules.
- Provider preferences for primary, fallback, international, and automatic routing, applied only when technically and operationally eligible.
- Provider-specific and global analytics for volume, success rate, latency, fees, settlements, invoice conversion, and customer behavior.

### Developer platform

- Versioned API and OpenAPI contract, scoped API keys, OAuth where justified, SDKs, and a no-real-money sandbox.
- Payment simulator scenarios for success, decline, timeout, duplicate, delayed webhook, provider error, and unknown state.
- Webhook console with sanitized event metadata, delivery attempts, response status and latency, signature status, and authorized replay.
- Stable test fixtures and provider contract tests that do not require production credentials.

### Operations and intelligence

- Health center for database, Redis, workers, queues, providers, webhooks, ledger invariants, and reconciliation.
- Incident workflows that reduce routing traffic, preserve unresolved state, verify recovery, and restore traffic gradually.
- Explainable risk decisions and anomaly detection for provider success, payment velocity, ledger drift, and webhook latency.
- Authorized operations assistant that correlates existing evidence but never invents financial state or bypasses permissions.
- Exportable transaction, payout, invoice, fee, settlement, reconciliation, ledger, and accounting-consumer reports.

### Automations

Automations use a bounded `WHEN / IF / THEN` model. Financial actions must pass the same authorization, quote, risk, idempotency, reservation, and audit controls as manual actions. Automation rules cannot directly mutate balances or bypass provider eligibility.

---

## 12. Implementation Roadmap

Roadmap status must be backed by code, tests, operational evidence, or an approved decision record. The current implementation and the [V2 implementation checklist](codex/transferly-v2-implementation-checklist.md) remain authoritative for completion status.

### Phase 1 — Trustworthy financial core

Deliver provider contracts and registry, normalized transaction models, state machines, pricing and point reservations, deterministic idempotency, transactional ledger effects, audit evidence, correlation IDs, and reconciliation-aware recovery.

**Exit gate:** failure injection across payout and payment boundaries converges without duplicate provider submissions or ledger effects; no unexplained ledger, reservation, wallet, inbox, or outbox drift remains.

### Phase 2 — Capability-driven provider workspaces

Complete the shared manifest, dynamic routes and navigation, normalized overview/wallet/activity surfaces, explicit lane states, accessibility, and route-level tests across API, bot, and Mini App.

**Exit gate:** every advertised action maps to verified backend support; unavailable lanes are non-mutating; provider contract parity and Mini App route tests pass.

### Phase 3 — Automatic execution and exception handling

Implement pre-transaction quotes, automatic point reservation/finalization/reversal, policy evaluation, risk-based auto/review/block outcomes, automatic payout execution, and operator exception queues.

**Exit gate:** routine eligible payouts complete without approval; review and block paths cause no unauthorized provider or ledger mutation; duplicate requests are deterministic.

### Phase 4 — Multi-provider orchestration

Add provider eligibility, health and scoring, user preferences, limits and currencies, safe pre-execution failover, kill switches, and provider contract tests. Add providers one corridor at a time after legal and commercial review.

**Exit gate:** routing decisions are reproducible and explainable; unknown outcomes never fail over; provider degradation and recovery exercises preserve financial invariants.

### Phase 5 — Unified user financial experience

Deliver global and provider wallet views, transaction timelines, payment links, universal checkout, Invoices 2.0, refunds, transfers, and scheduled payouts.

**Exit gate:** every financial state explains whether funds moved, whether retry is safe, what happens next, and which stable reference support should use; critical journeys pass mobile Telegram validation.

### Phase 6 — Business platform

Add organizations, membership, RBAC, provider connections, business wallets, preferences, analytics, reporting, and approval policies for organization-specific controls.

**Exit gate:** authorization-matrix tests cover cross-organization access, privilege escalation, provider credentials, API keys, refunds, payouts, and reports.

### Phase 7 — Intelligence

Add explainable risk scoring, anomaly detection, provider intelligence, routing recommendations, transaction graphs, operational alerts, and evidence-grounded assistance.

**Exit gate:** decisions expose rule and signal explanations, false-positive review paths, versioned policy inputs, and immutable audit evidence.

### Phase 8 — Reconciliation and reliability

Complete automated reconciliation, settlement matching, discrepancy workflows, outbox/inbox recovery, dead-letter operations, incident management, backup automation, restore drills, and disaster recovery.

**Exit gate:** Redis outages, provider timeouts, duplicate callbacks, process crashes, delayed webhooks, and restore exercises converge within documented RPO/RTO and SLO targets.

### Phase 9 — Developer platform

Publish versioned APIs, OpenAPI, scoped keys, customer webhooks, webhook console, sandbox, simulation lab, SDKs, fixtures, and developer documentation.

**Exit gate:** API and webhook contracts have authentication, authorization, idempotency, replay, rate-limit, and compatibility tests; sandbox paths cannot reach live money movement.

### Phase 10 — Automations

Introduce bounded rules for notifications, invoices, routing, payout initiation, balance thresholds, risk, and reconciliation.

**Exit gate:** loop prevention, execution limits, authorization snapshots, deterministic deduplication, dry-run previews, and audit/replay evidence are verified.

### Phase 11 — Advanced financial services

After the core is proven, add multi-currency and FX, virtual accounts or payment destinations, subscriptions, marketplace and split payments, settlement automation, and accounting integrations.

**Exit gate:** each service has approved provider, legal, compliance, safeguarding, accounting, reconciliation, and failure-recovery models for its target jurisdictions.

### Phase 12 — Enterprise scale

Add high availability, horizontal scaling, object storage, advanced observability, privacy and compliance tooling, enterprise RBAC, SLA reporting, and evidence-backed production readiness.

**Exit gate:** capacity, security, failover, backup/restore, migration, provider, ledger, webhook, and smoke-test evidence passes the release gate in the target environment.

---

## 13. Provider Enablement Gate

Before enabling a provider operation for real money, require:

- [ ] approved commercial, jurisdictional, custody, settlement, and compliance model;
- [ ] strict capability and operation contract with supported countries, currencies, limits, and payment methods;
- [ ] authenticated client, secret handling, timeouts, egress restrictions, and response validation;
- [ ] deterministic provider idempotency and internal semantic idempotency;
- [ ] signature-verified webhooks persisted before asynchronous processing;
- [ ] provider-to-Transferly state and error classification;
- [ ] transactional reservation, ledger, reversal, and audit rules;
- [ ] unknown-state reconciliation and operator recovery path;
- [ ] bounded retry and rate-limit policy, kill switch, and health checks;
- [ ] unit, integration, contract, sandbox, duplicate, authorization, and non-mutation tests;
- [ ] operational runbook, dashboards, alerts, and credential rotation procedure.

Provider support is operation-specific. A provider can be live for invoices while setup-only for payouts; do not promote the provider as a whole when only one operation is proven.

---

## 14. Security, Compliance, and Financial Invariants

1. The internal ledger is the source of truth for balances.
2. All wallet and ledger mutations are transactional, balanced, idempotent, and audited.
3. External input is untrusted and validated at the boundary; unknown fields are rejected.
4. Resource ownership and authorization are enforced server-side.
5. Provider success remains an observation until required local effects are persisted.
6. Webhook signatures are verified against the raw body before processing.
7. Provider receipts are persisted before enqueueing deeper work.
8. Unknown financial state is reconciled, not blindly retried or failed over.
9. Provider fees, Transferly service-point charges, and FX costs remain distinct.
10. Secrets, bearer tokens, webhook headers, raw sensitive payloads, private storage keys, and production data never enter logs or documentation.
11. Sandbox and simulation environments cannot call live financial operations.
12. Regulated features ship only after jurisdiction-specific legal, licensing, KYC/KYB, AML, sanctions, safeguarding, privacy, consent, and reporting requirements are approved.

---

## 15. Production and Release Evidence

Production readiness must derive from executed checks, not an arbitrary score. Transferly currently exposes these repository commands:

```bash
npm run verify
npm run check:production
npm run verify:staging
npm run check:miniapp:bundle
npm run scan:secrets
npm run verify:release
```

A future `verify:production` alias or replacement may aggregate environment, database, migration, ledger, provider, webhook, Redis, worker, queue, security, dependency, test, OpenAPI, documentation, and smoke evidence. It must fail closed for required target-environment checks and distinguish static/local checks from sandbox or live verification.

Every release record should identify the commit and environment, list each executed check and result, surface skipped prerequisites, and retain migration, rollback, smoke, provider-contract, ledger-invariant, webhook, and security evidence.

---

## 16. Public References and Adaptation Rationale

Official provider documentation is used to validate capability boundaries and integration patterns, not to copy source code, branding, or assets:

| Reference | Transferly adaptation |
|-----------|-----------------------|
| [Stripe Connect](https://docs.stripe.com/connect) | Connected-account onboarding, capability readiness, account balances, platform pricing, and payout concepts inform Transferly's account and manifest models. |
| [PayPal Payouts](https://developer.paypal.com/docs/payouts/) and [Invoicing API](https://developer.paypal.com/docs/api/invoicing/v2/) | Batch payout identity, invoice lifecycle, hosted links, and webhook observations inform the current PayPal module. |
| [Paystack documentation](https://paystack.com/docs/) | Collections, transfers, payment requests, virtual accounts, and webhook concepts inform setup-only capability planning. |
| [Flutterwave developer documentation](https://developer.flutterwave.com/docs) | Collection methods, transfer orchestration, idempotency, settlements, refunds, testing, and webhooks inform future adapter boundaries. |
| [Wise Platform](https://docs.wise.com/) | Quotes, recipients, transfers, balances, and compliance readiness inform corridor-oriented payout planning. |

The strongest general public reference is Stripe Connect because its capability and connected-account models map well to provider readiness and business-connected accounts. Transferly intentionally does **not** adopt Stripe's balance, risk, or settlement semantics as universal truth; the Transferly ledger, policy engine, jurisdictional requirements, and provider-specific contracts remain authoritative.

---

## 17. Non-Goals and Guardrails

- Do not perform a destructive rewrite or split into microservices before measured need.
- Do not hard-code navigation independently in API, bot, and Mini App.
- Do not label setup or preview lanes as production-ready.
- Do not manufacture wallet semantics, currencies, balances, fees, completion estimates, or provider capabilities.
- Do not sum unlike currencies without an explicit valuation source, rate, and timestamp.
- Do not let automation, AI assistance, or client state authorize financial mutation.
- Do not expose provider credentials, storage paths, raw webhook payloads, or private financial evidence.
- Do not enable virtual accounts, FX, marketplace funds flow, or regulated services before provider and jurisdictional requirements are approved.
- Do not treat mocked provider tests as sandbox or live verification.

---

## 18. How to Use and Maintain This Document

This document is the canonical product vision and phase dependency map. It does not replace implementation-specific sources:

- [Provider module architecture](provider-module-architecture.md) defines provider lifecycle and extension points.
- [Provider-first workspaces](provider-first-workspaces.md) records the current workspace implementation and limitations.
- [Payment provider adapters](codex/references/payment-provider-adapters.md) records operation-level integration status.
- [Project architecture](codex/references/project-architecture.md) defines current backend layering.
- [Next-generation enhancement strategy](next-generation-enhancement-strategy.md) provides prioritized reliability and product recommendations.
- [V2 implementation checklist](codex/transferly-v2-implementation-checklist.md) records implementation evidence and remaining gates.
- [Release gates](deployment/release-gates.md) defines current verification commands.

When documentation and code disagree, package scripts, runtime contracts, migrations, and tests are authoritative. Update this document when the product north star, phase dependencies, capability model, or financial invariants change. Update the narrower owning reference when implementation status or operational procedure changes.

---

## 19. Locked Product Principles

1. **Automatic by default:** routine eligible operations execute without admin intervention.
2. **User-controlled when desired:** users can choose a provider when it is eligible, or use Smart Routing.
3. **Provider-agnostic underneath:** core transaction, policy, ledger, event, and reconciliation contracts do not depend on one provider.
4. **Provider-specific on the surface:** each workspace exposes only capabilities genuinely supported and operationally enabled.
5. **Transferly adds intelligence:** routing, risk, reconciliation, automation, analytics, and operational evidence create the cross-provider value.

The destination is not merely a Telegram payment bot or a collection of provider dashboards. It is an intelligent, auditable financial operating layer that lets businesses connect providers, control execution, automate routine work, and understand every financial outcome.