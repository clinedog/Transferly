---
name: intent-backup-restore
description: Verify Transferly database, Redis, queue, configuration, backup, restore, RPO, RTO, and recovery evidence without treating an untested backup as production readiness.
---

# Purpose

Make recovery claims measurable, repeatable, and safe.

## Workflow

1. Identify backup sources, retention, encryption, and ownership.
2. Create an isolated restore target.
3. Restore and verify schema, migrations, ledger invariants, queues, and configuration.
4. Measure RPO and RTO evidence.
5. Persist verification results and report blockers honestly.

## Validation checklist

- Backup existence is distinct from restore verification.
- Restores never overwrite production data during testing.
- Ledger and idempotency invariants are checked after restore.
- Redis and queue recovery behavior is documented.
- Missing recovery evidence produces WARN or FAIL, never PASS.

