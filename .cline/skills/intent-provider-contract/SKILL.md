---
name: intent-provider-contract
description: Implement and review Transferly provider adapters, capabilities, readiness, routing, fees, health, timeouts, retries, webhooks, and reconciliation contracts.
---

# Purpose

Keep providers replaceable while ensuring only eligible providers receive financial operations.

## Workflow

1. Define capabilities, environments, currencies, countries, limits, and supported operations.
2. Validate readiness and execution eligibility before routing.
3. Normalize provider statuses into Transferly states.
4. Add timeout, retry, idempotency, provider-reference, and webhook behavior.
5. Add provider contract and reconciliation tests.

## Validation checklist

- Ineligible providers are never ranked or selected.
- Provider secrets never reach the frontend or logs.
- Timeouts do not create duplicate operations.
- Provider status cannot override internal ledger truth.
- Health and financial execution eligibility remain distinct.

