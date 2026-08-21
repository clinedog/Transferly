---
name: intent-release
description: Prepare and assess Transferly release candidates, go/no-go decisions, release notes, and rollback readiness. Use for release verification or production handoff.
---

# Purpose

Turn a candidate into an evidence-backed release decision.

## Trigger conditions

Use for release candidates, version changes, go/no-go reviews, release notes, or rollback planning.

## Best practices

Do not infer readiness from passing unit tests alone. Check migrations, secrets, deployment configuration, external-provider dependencies, monitoring, and rollback paths.

## Workflow

1. Identify changed surfaces and production risks.
2. Run the repository release gate commands.
3. Verify migration, config, provider, and observability readiness.
4. Produce a go/no-go decision with blockers.
5. Record rollout and rollback steps.

## Validation checklist

- Production checks, staging checks, bundle budget, and secret scan are run or explicitly blocked.
- Migration and rollback effects are understood.
- No unverified external integration is represented as ready.

## Expected outputs

Release checklist, go/no-go decision, release notes, and rollback plan.
