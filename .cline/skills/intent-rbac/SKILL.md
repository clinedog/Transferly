---
name: intent-rbac
description: Design and enforce Transferly role-based access control for owners, administrators, finance managers, operations, accountants, viewers, admins, and service identities.
---

# Purpose

Make authorization explicit, least-privilege, server-side, and auditable.

## Workflow

1. Define the protected action and permission.
2. Resolve the actor role from trusted server claims and organization membership.
3. Enforce permission before reading sensitive data or mutating state.
4. Prevent role escalation, unsafe self-demotion, and approval bypass.
5. Add unauthorized, cross-role, and audit-log tests.

## Validation checklist

- Frontend role checks are never the security boundary.
- Financial approval and administrative actions require explicit permissions.
- API-key scopes cannot grant permissions the organization membership lacks.
- Sensitive role changes require reason, confirmation, and audit evidence.

