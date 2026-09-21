# PayPal Sandbox Simulator Implementation Plan

**Status:** Active  
**Owner:** Transferly Mini App  
**Reference:** PayPal Sandbox merchant workspace reviewed page-by-page on 2026-09-20

## Product boundary

Transferly will reproduce the useful merchant-console workflows and information
architecture observed in PayPal Sandbox, but it will not impersonate PayPal or
copy protected marks, logos, fonts, source, authenticated HTML, or proprietary
assets. The product identity remains Transferly.

Every simulator page must show:

- `Transferly Sandbox Simulator`
- Synthetic/demo data status
- No live account, credentials, or funds access
- Transferly ledger authority for balances and release decisions

Provider terminology may describe compatibility (for example, “PayPal adapter”)
where it is accurate. It must not make a Transferly page appear to be the
PayPal website.

## Page-by-page review protocol

Before implementing or materially changing a page:

1. Review the corresponding Sandbox page in the shared browser.
2. Record its information architecture, primary actions, empty/loading/error
   states, responsive behavior, and data fields.
3. Map each observed capability to a Transferly route, API contract, and
   authoritative data source.
4. Classify it as `matched`, `partial`, `informational`, `unavailable`, or
   `intentionally different`.
5. Add or update a focused Playwright flow and API contract coverage.
6. Re-review the Sandbox page after implementation to confirm workflow parity
   without copying protected identity or assets.

## Execution phases

### Phase 1 — Simulator shell and overview

**Status:** In progress; initial shell labeling and business-tool navigation
implemented.

Deliver:

- Transferly merchant-console shell.
- Sandbox simulator banner and safety disclosure.
- Business-tool navigation.
- Overview metrics, recent activity, readiness, and next actions.
- Loading, empty, unavailable, and retry states.
- Responsive desktop/mobile layout.

Acceptance:

- Overview never implies live PayPal access.
- All visible actions navigate to an implemented lane or show an explicit
  unavailable state.
- Focused Playwright overview flow passes at mobile and desktop widths.

### Phase 2 — Collections: invoices and payment links

**Status:** In progress; the PayPal invoice lane now exposes a verified
Payment Links & Buttons simulator boundary and routes users into the existing
invoice builder. Full create/list/expiration lifecycle support remains gated
on the existing invoice/payment-link API contracts.

Review the Sandbox invoicing and Payment Links & Buttons pages.

Deliver:

- Invoice list, detail, create, send, reminder, refresh, QR, and cancellation
  workflows where existing Transferly contracts support them.
- Payment-link list, create, expiration, copy, and status workflows.
- Explicit distinction between provider-hosted links and Transferly-generated
  links.
- Idempotent mutations and confirmation dialogs.

Verified slice:

- `Payment Links & Buttons` is visible at
  `/miniapp/services/paypal/invoices`.
- The page explicitly states that it uses hosted links generated from
  Transferly invoice records and does not create an official PayPal-branded
  checkout page.
- The invoice-builder navigation and internal-ledger authority copy have
  focused Playwright coverage.

Acceptance:

- No mock success is shown for an unavailable backend operation.
- Invoice links come from persisted provider resources.
- Payment-link actions have API contract tests and focused browser coverage.

### Phase 3 — Money movement: payouts and request/send money

Review the Sandbox Request Money and Send Money pages.

Deliver:

- Payout preparation and status tracking.
- Recipient, amount, currency, limits, risk, and confirmation summaries.
- Pending, failed, cancelled, and reconciliation-required states.
- Internal-ledger reservation and audit evidence.

Acceptance:

- All balance changes go through the ledger service transaction boundary.
- Deterministic idempotency keys are required.
- Provider status never overrides an unresolved ledger state.

### Phase 4 — Activity and performance

Review Recent Activity, Transactions, and Business Performance pages.

Deliver:

- Unified activity timeline with filters, pagination, sorting, and safe export.
- Performance cards sourced only from authoritative Transferly/provider data.
- Customer/order/payment/invoice relationship summaries.
- Stale-data and provider-latency notices.

Acceptance:

- Export excludes secrets, raw payloads, bearer tokens, and webhook headers.
- Unknown and reconciliation states remain visible.
- Large lists remain responsive within existing bundle and interaction budgets.

### Phase 5 — Developer, webhooks, and operational diagnostics

Review developer tools, webhook configuration, delivery history, and replay
behavior.

Deliver:

- Webhook readiness and signature-verification posture.
- Sanitized delivery timeline and dead-letter/replay controls.
- Request IDs, idempotency posture, and provider latency diagnostics.
- Explicit action gates for unsupported provider operations.

Acceptance:

- Signature verification occurs before any state mutation.
- Replay is authenticated, auditable, and idempotent.
- Secrets and raw event payloads never render in the UI.

### Phase 6 — Disputes, subscriptions, FX, and settings

Review the Sandbox pages for disputes, subscriptions, currency tools, and
business settings.

Deliver:

- Read-only or setup-backed lanes for capabilities without a verified backend.
- Dispute evidence deadlines and amount-at-risk summaries.
- Subscription lifecycle readiness.
- Currency support, quote timing, fees, and settlement disclaimers.
- Provider settings limited to Transferly-owned configuration.

Acceptance:

- Unsupported actions are visibly disabled with a reason.
- Transferly identity, security, and account settings are never simulated as
  PayPal account settings.
- Currency and dispute values identify their source and freshness.

### Phase 7 — Support, accessibility, and visual parity

Deliver:

- Transaction-linked Support Desk handoff.
- Keyboard, screen-reader, focus, contrast, reduced-motion, and touch-target
  coverage.
- Visual regression baselines for each implemented lane.
- Consistent simulator badge and safety copy across routes.

Acceptance:

- Zero known automated accessibility violations in the covered flows.
- Every page has loading, empty, error, unavailable, and success/reconciliation
  states as applicable.

### Phase 8 — Release and environment verification

Deliver:

- Stable API/Redis-backed browser run.
- Full Mini App Playwright aggregate result.
- API, bot, lint, build, bundle, secret-scan, backup, and release checks.
- Updated parity matrix and deployment/runbook evidence.

Acceptance:

- Repository release gates are green.
- Environment-dependent checks are clearly recorded as verified or blocked.
- No live PayPal credentials or private Sandbox data are committed.

## Parity matrix template

| Sandbox capability | Transferly route/component | API contract | Status | Safety boundary | Test |
| --- | --- | --- | --- | --- | --- |
| Dashboard overview | `/miniapp/services/paypal/overview` | Provider dashboard | Partial | Transferly shell and synthetic simulator label | PayPal overview smoke |
| Invoicing | `/miniapp/services/paypal/invoices` | Invoice resource | Partial | Provider links must be persisted and sanitized | Invoice contract/e2e |
| Payment links | Collections lane | Payment-link contract | Planned | No unsupported provider action implied | Payment-link contract/e2e |
| Payouts | `/miniapp/services/paypal/payouts` | Payout service | Partial | Ledger and idempotency remain authoritative | Payout tests |
| Transactions | `/miniapp/services/paypal/transactions` | Transaction resource | Partial | Sanitized export only | Transaction smoke |
| Webhooks | `/miniapp/services/paypal/webhooks` | Webhook readiness/events | Partial | Verify signature before mutation | Webhook tests |
| Business products | Provider prepared lanes | None or setup contract | Unavailable | Do not simulate PayPal-owned financial products | State contract |

## Verification commands

```bash
npm run lint --prefix miniapp
npm run build --prefix miniapp
cd miniapp && npx playwright test tests/smoke.spec.js -g "PayPal" --workers=1
npm test --prefix api
npm test --prefix bot
npm run verify:release
```

The full browser command requires a stable API/Redis environment. A preview
run without the API must not be reported as a complete aggregate pass.
