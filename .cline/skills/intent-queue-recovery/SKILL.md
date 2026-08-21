---
name: intent-queue-recovery
description: Improve Transferly BullMQ workers, retry policies, dead-letter persistence, job deduplication, stale-job recovery, and safe replay. Use for queue reliability, worker failures, background jobs, and recovery tooling.
---

# Purpose

Make background processing deterministic, bounded, observable, and recoverable without duplicate side effects.

## Trigger conditions

Use when touching `api/jobs/`, BullMQ queues/workers, dispatchers, dead-letter services, job IDs, recovery endpoints, worker shutdown, or async payment/order/webhook processing.

## Best practices

- Prefer deterministic job IDs and idempotent processors.
- Use bounded retries with exponential backoff and clear terminal/retryable classification.
- Persist exhausted jobs before recovery/replay.
- Prevent duplicate processing with locks, idempotency keys, and state-machine checks.
- Include request/job/correlation IDs in logs and persisted recovery records.

## Workflow

1. Trace producer → queue → worker → service side effects → dead-letter/recovery.
2. Classify failures as retryable or terminal with evidence.
3. Add dedupe, lock, or state-transition guards before side effects.
4. Add tests for retries, exhaustion, stale locks, recovery claims, and duplicate jobs.
5. Run worker/dead-letter tests and affected API checks.

## Validation checklist

- A job cannot perform the same financial/provider side effect twice accidentally.
- Exhausted jobs become visible and recoverable.
- Recovery is idempotent and auditable.
- Worker shutdown/bootstrap failures are handled safely.

## Expected outputs

Queue/worker hardening, recovery tests, operational notes, and remaining failure-mode risks.