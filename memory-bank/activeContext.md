# Active Context

**Current focus**: Phase 1 (Production Readiness Registry) + Phase 2 (Provider
Contract & Capability Routing Hardening) of the Transferly production-readiness
program. The goal is an authoritative, service-level readiness model where a
capability being visible in the UI is never, by itself, executable.

**Current state** (working tree, uncommitted):
- Phase 1 complete: canonical readiness model in
  `api/core/financial/providerContract.js` (`EXECUTION_STATUS`,
  `PROVIDER_OPERATION`, `PAYMENT_METHOD`, `TRANSACTION_TYPE`,
  `OPERATION_BY_TRANSACTION_TYPE`, `buildProviderReadinessDescriptor`).
  Descriptor keeps `operation_status` separate from `execution_eligible`; empty
  country/currency lists are UNSPECIFIED (never global).
- Phase 2 mostly complete: `providerRoutingService` (ELIGIBILITY → RANKING →
  EXECUTION), payment-method/transaction-type alias matching in
  `providerRegistry.js`, and readiness/status/manifest/dashboard services.

**Recent changes (this session)**:
- Added the canonical result + error contract to `providerContract.js`:
  `normalizeProviderOutcome`, `buildProviderResult`, `categorizeProviderError`,
  `screenSafeMetadata`, `normalizeWebhookEvent` + `RESULT_STATE`,
  `SETTLEMENT_STATE`, `PROVIDER_ERROR_CATEGORY`, `WEBHOOK_EVENT_CATEGORY`.
  Unknown/ambiguous outcomes are never normalized to success (reconciliation).
- Fixed a latent bug in `providerRegistry.selectBestProvider`: the payment
  method gate only matched canonical keys, not legacy adapter keys
  (`cardPayments`, `walletPayments`, ...). Added
  `PAYMENT_METHOD_CAPABILITY_KEYS` +
  `capabilityPassesForPaymentMethod`.
- Removed an unused `PAYMENT_METHOD` import (lint fix).
- Added 11 unit tests in `api/test/providerAbstraction.test.js` covering
  outcome normalization, error categorization, metadata redaction, webhook
  classification, coming-soon/disabled non-executability, and payment-method
  restrictions.
- Documented the normalized result/error contract in
  `docs/provider-module-architecture.md`.

**Next steps**:
1. Phase 4: financial-core + ledger + points safety hardening (recommended next
   per `docs/transferly.md` ordering 1 → 2 → 4).
2. Then Phases 3, 5–15 in order.
3. Commit the current Phase 1/2 work after final review.
