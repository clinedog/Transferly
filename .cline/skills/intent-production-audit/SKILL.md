---
name: intent-production-audit
description: Audit Transferly for production readiness across security, reliability, payments, observability, deployment, testing, and operations. Use for launch gates, periodic audits, or post-incident follow-up.
---

# Purpose

Expose release-blocking gaps with prioritized, evidence-backed remediation.

## Trigger conditions

Use before launch, after a material architecture change, during compliance review, or following an incident.

## Best practices

Audit end-to-end paths rather than isolated files. Prioritize money movement, auth, secrets, webhooks, migrations, queues, monitoring, recovery, and runbooks; do not claim a control exists without evidence.

## Workflow

1. Define scope, critical flows, and production assumptions.
2. Inspect code, config examples, workflows, tests, and deployment docs.
3. Run release gates and targeted safety checks.
4. Rank findings by likelihood, impact, and fixability.
5. Produce an owner-ready remediation plan and recheck criteria.

## Validation checklist

- Payment and ledger transitions are transactional, idempotent, and audited.
- Auth, webhook verification, secret handling, and operational recovery are assessed.
- Every finding cites evidence; unverified areas are explicitly marked.

## Expected outputs

Production-readiness report, prioritized findings, remediation plan, and release recommendation.
