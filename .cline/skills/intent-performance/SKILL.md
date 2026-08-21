---
name: intent-performance
description: Diagnose and improve Transferly API, database, worker, bot, and Mini App performance. Use for slow requests, heavy queries, queue latency, bundle size, memory use, or scalability work.
---

# Purpose

Improve measured bottlenecks without trading away correctness or observability.

## Trigger conditions

Use for latency, throughput, CPU, memory, database, queue, render, or bundle-size concerns.

## Best practices

Measure before changing. Preserve idempotency and transactional behavior, avoid speculative caching, bound concurrency, and keep performance telemetry free of sensitive data.

## Workflow

1. Define the user-visible metric and capture a baseline.
2. Trace the hot path across application, queue, and database layers.
3. Apply the smallest evidence-backed optimization.
4. Add regression guardrails or budget checks.
5. Re-measure and run correctness tests.

## Validation checklist

- Improvement is demonstrated against the baseline.
- No new races, unbounded work, cache-invalidation risk, or data inconsistency.
- Build budget and relevant integration checks pass.

## Expected outputs

Baseline, bottleneck analysis, measured improvement, and trade-off notes.
