---
name: intent-observability
description: Improve Transferly logs, metrics, health/readiness signals, operational dashboards, incident response, and release diagnostics. Use for structured logging, request/job correlation, provider/queue health, and monitoring work.
---

# Purpose

Make production behavior explainable without exposing secrets or sensitive payment/user data.

## Trigger conditions

Use when changing health endpoints, readiness checks, structured logs, request IDs, job/correlation IDs, provider health reports, admin ops views, incident runbooks, or release diagnostics.

## Best practices

- Preserve request IDs and actor/job/provider/resource IDs across boundaries.
- Redact tokens, secrets, raw Telegram init data, webhook signatures, and sensitive payloads.
- Separate live, ready, degraded, partial outage, and unavailable signals.
- Prefer actionable metrics and recovery hints over noisy generic logs.
- Keep monitoring endpoints safe for their intended audience.

## Workflow

1. Identify the operator question or incident scenario.
2. Trace where the signal should be emitted and consumed.
3. Add structured metadata with redaction and stable codes.
4. Add tests for safe output and no secret leakage.
5. Run lint, targeted tests, and secret scan if logs or payloads changed.

## Validation checklist

- Logs and health payloads expose useful state without credentials or raw sensitive data.
- Request/job/provider correlation is preserved.
- Degraded states are specific enough to guide recovery.
- New signals have tests or documented verification steps.

## Expected outputs

Operational visibility improvements, safe logging tests, and incident/recovery guidance.