---
name: intent-chaos-failure-injection
description: Exercise Transferly financial, webhook, queue, Redis, worker, database, and provider failure modes without corrupting ledger state or creating duplicate operations.
---

# Purpose

Turn failure scenarios into repeatable evidence rather than assumptions.

## Workflow

1. Choose an isolated test database, queue, and provider fixture.
2. Inject one controlled failure at a time.
3. Assert ledger, state machine, idempotency, audit, reconciliation, and user messaging behavior.
4. Verify retry and dead-letter behavior.
5. Record residual risk and recovery evidence.

## Required scenarios

- Provider timeout and 5xx
- Duplicate and delayed webhook
- Out-of-order callback
- Redis/worker restart
- Database contention
- Network interruption

