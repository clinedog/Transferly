---
name: intent-tenancy
description: Protect Transferly organization boundaries, memberships, tenant-owned resources, organization context, and IDOR resistance. Use for multi-tenancy, organization switching, resource ownership, or cross-tenant authorization work.
---

# Purpose

Keep every tenant-owned resource scoped to an authenticated organization and prevent cross-organization access.

## Workflow

1. Identify the authenticated user, selected organization, membership, and required permission.
2. Trace route, middleware, controller, service, repository, and tests.
3. Enforce organization scope in the repository query, not only in the UI.
4. Reject missing, suspended, removed, or unauthorized memberships.
5. Add positive, negative, IDOR, switching, and suspended-membership tests.

## Validation checklist

- Organization context is server-derived.
- Every tenant query has an organization boundary.
- API keys and sessions cannot cross organization boundaries.
- Error responses do not reveal whether another tenant resource exists.
- Existing personal workspaces remain compatible.

