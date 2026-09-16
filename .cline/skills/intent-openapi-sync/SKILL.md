---
name: intent-openapi-sync
description: Keep Transferly OpenAPI documentation synchronized with Express routes, Zod schemas, authentication, idempotency, errors, pagination, and webhook contracts.
---

# Purpose

Prevent misleading API documentation and detect route-contract drift in CI.

## Workflow

1. Inventory mounted routes and route methods.
2. Locate validators, authentication middleware, and idempotency requirements.
3. Represent request, response, error, and security schemas.
4. Add contract assertions for every critical route.
5. Fail verification when documented routes are missing or undocumented critical routes appear.

## Validation checklist

- No fake placeholder-only paths for critical financial endpoints.
- Authentication and scopes are documented.
- Idempotency headers and status codes are documented.
- Webhook verification and replay semantics are documented.

