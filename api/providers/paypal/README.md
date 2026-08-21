# PayPal Provider Module

Transferly keeps PayPal as a provider-specific service module while preserving the shared provider registry, invoice, payout, webhook, and readiness services.

This folder owns PayPal-specific schemas, status mapping, webhook normalization, readiness rules, resource contracts, and sandbox-only fixtures. Do not store credentials, live webhook payloads, bearer tokens, payment tokens, card data, or production records here.

## Resource lanes

- `overview`, `invoices`, `payouts`, `webhooks`, `developer`, and `settings` are backed by existing Transferly provider, invoice, payout, health, and webhook records.
- `payments`, `orders`, `transactions`, `disputes`, `subscriptions`, `tokens`, and `currency-exchange` are prepared as explicit resource contracts until dedicated PayPal adapter calls, validation, audit logging, and tests are added.
- Transferly internal ledger records remain the source of truth for balances and release decisions; PayPal resource state is provider context for reconciliation and support.
- Sandbox fixtures must be labeled as sandbox/test/demo data and must never be used as real PayPal payment proof.
