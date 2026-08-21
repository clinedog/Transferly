---
name: intent-migrations
description: Safely change Transferly SQLite schemas, data migrations, backfills, and constraints. Use for schema changes, migration failures, data repair, or persisted-state evolution.
---

# Purpose

Evolve persistent data without compromising ledger integrity, compatibility, or recoverability.

## Trigger conditions

Use for api/db/schema.sql, migrations, seeds, backfills, constraints, or migration status/failure work.

## Best practices

Use additive, ordered migrations; make data transforms deterministic and restart-safe; preserve audit history; and never reinterpret financial balances without an explicit migration and verification plan.

## Workflow

1. Inspect schema, migration runner, legacy migrations, and affected repositories.
2. Define forward change, compatibility, and rollback/repair behavior.
3. Implement an idempotent migration with tests.
4. Run migration status and a fresh-database migration.
5. Run affected API and data-integrity tests.

## Validation checklist

- Migration ordering and transaction behavior are explicit.
- Existing data, constraints, and defaults remain valid.
- Backfills are bounded, observable, and safe to retry.

## Expected outputs

Migration code, test evidence, operational rollout notes, and rollback/repair guidance.
