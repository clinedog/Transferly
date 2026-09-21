# PayPal provider workspace

The page-by-page Sandbox simulator work is tracked in
[PayPal Sandbox Simulator Implementation Plan](./paypal-sandbox-simulator-implementation-plan.md).

## Scope and brand boundary

Transferly presents PayPal as a connected payment provider within a Transferly-owned Mini App workspace. The workspace may use approved PayPal assets, relevant provider terminology, and links to official PayPal resources, but it must not imitate a PayPal wallet, native app, dashboard, email, or account screen.

Transferly remains the primary product shell. Its internal ledger is the balance source of truth; provider data is used for reconciliation, support, and provider-operation state.

Official reference material:

- [PayPal media resources](https://newsroom.paypal-corp.com/media-resources)
- [PayPal Developer documentation](https://developer.paypal.com/docs/)
- [PayPal JavaScript SDK sample integrations](https://github.com/paypal-examples/v6-web-sdk-sample-integration)

## Completed implementation phases

### Phase 1 — Visual foundations

- The canonical PayPal route is `/miniapp/services/paypal/overview`.
- The legacy root route now resolves to that provider workspace instead of rendering a standalone wallet replica.
- The Transferly shell uses secondary PayPal provider identity, a provider-balance snapshot, responsive provider cards, and mobile quick navigation.
- The balance snapshot explicitly labels provider data as non-authoritative for Transferly balances.

### Phase 2 — Provider-backed operations

- Collection flows use the existing invoice lane and official hosted PayPal invoice links.
- Sending flows use the existing payout lane, with service-level validation, idempotency, audit records, and internal-ledger safety controls.
- The workspace does not create mock send, top-up, withdrawal, bank-linking, or account-balance flows. Those would bypass the ledger and misrepresent a PayPal account.

### Phase 3 — Transaction and settings improvements

- Transaction Search supports provider or Transferly-linked records, filters, and safe details.
- Transaction export is client-side and contains only the current sanitized fields; raw provider payloads, authorization data, and secrets are never exported.
- Settings surface supported currencies, environment, webhook readiness, and official resources. Identity, bank linking, and multi-factor authentication remain Transferly account features rather than a simulated PayPal profile.

### Phase 4 — Sandbox developer experience

- Sandbox and production state are provided by the backend readiness contract.
- The workspace exposes retry-safe reads, request IDs, idempotency posture, and existing operator tooling.
- Deliberate API error injection, random transactions, reset-wallet actions, and speed controls are not exposed in the product API because they would create unsafe production paths. Deterministic fixtures belong in the test suite.

### Phase 5 — Verification

- Playwright coverage verifies that the legacy root route lands in the provider workspace and that legacy replica subroutes fail closed.
- Provider workspace checks cover invoice, payout, transaction, webhook, settings, and responsive behavior.

## Implementation rules

- Use only approved PayPal assets. Do not recreate or alter PayPal marks.
- Keep all money movement within Transferly’s service, repository, transaction, audit, idempotency, and provider-adapter boundaries.
- Validate untrusted inputs at API boundaries and verify PayPal webhooks before processing them.
- Never render PayPal secrets, bearer tokens, webhook headers, raw payloads, or other sensitive provider data.
- When PayPal changes its public integration guidance, compare the relevant official source to the current provider adapter before updating this workspace.
