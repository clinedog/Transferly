---
name: intent-deploy
description: Deploy and operate Transferly services using the repository deployment guidance. Use for EC2, PM2, Redis, environment configuration, rollout, rollback, or production troubleshooting.
---

# Purpose

Perform controlled deployments with minimal risk to payment and user-facing workflows.

## Trigger conditions

Use for deployment plans, host configuration, runtime operations, release rollout, or rollback.

## Best practices

Read local deployment docs first, use least-privilege secrets, validate health before traffic, and never expose environment values in output. Treat database migration and worker compatibility as a single rollout concern.

## Workflow

1. Inspect deployment docs, target environment, and release prerequisites.
2. Confirm configuration, migrations, queues, and provider credentials.
3. Deploy incrementally with health checks.
4. Monitor logs and key behavior without sensitive payloads.
5. Roll back safely if gates fail.

## Validation checklist

- Runtime configuration is validated and secrets remain redacted.
- API, worker, Redis, and Mini App compatibility are checked.
- Health checks and a rollback route are available.

## Expected outputs

Deployment runbook, executed checks, rollout status, and rollback criteria.
