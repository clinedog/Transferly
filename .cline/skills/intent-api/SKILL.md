---
name: intent-api
description: Build or change Transferly Express APIs, Zod schemas, provider adapters, webhooks, and persistence flows. Use for endpoints, contracts, middleware, payments, or integrations.
---

# Purpose

Deliver API changes that are validated, layered, idempotent, and operationally safe.

## Trigger conditions

Use for routes, controllers, schemas, services, repositories, adapters, and webhook handlers.

## Best practices

Keep transport in routes/controllers, business rules in services, persistence in repositories, and effects in jobs/webhooks. Persist meaningful transitions before acknowledgement.

## Workflow

1. Trace route → controller → service → repository → schema → tests.
2. Confirm contract, auth, idempotency, and error semantics.
3. Implement the smallest aligned change.
4. Add integration and service coverage as appropriate.
5. Run lint, migration checks, and API tests.

## Validation checklist

- Zod validates all external input and unknown fields are rejected.
- Balance-changing work is transactional and audited.
- Webhooks verify signatures and persist receipts before asynchronous work.

## Expected outputs

Documented contract change, layered implementation, tests, and validation evidence.
