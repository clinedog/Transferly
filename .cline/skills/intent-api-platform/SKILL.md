---
name: intent-api-platform
description: Build Transferly as a reliable API-first developer platform with versioning, authentication, scopes, pagination, idempotency, errors, webhooks, request logs, and compatibility guarantees.
---

# Purpose

Expose stable, secure, documented APIs without breaking existing Mini App and bot clients.

## Workflow

1. Inventory existing routes and compatibility aliases.
2. Define the resource contract, authentication, scopes, errors, pagination, and idempotency behavior.
3. Implement validation and authorization at the API boundary.
4. Synchronize OpenAPI with actual routes and schemas.
5. Add contract, authorization, replay, and backward-compatibility tests.

## Validation checklist

- `/api` compatibility remains explicit.
- `/api/v1` behavior is documented.
- Financial mutations enforce idempotency where required.
- Error envelopes are safe and consistent.
- API keys are hashed, scoped, revocable, and organization-bound.

