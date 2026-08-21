---
name: intent-review
description: Review Transferly changes for correctness, maintainability, architecture, reliability, and risk. Use for pull-request review, pre-merge assessment, or code-quality audits.
---

# Purpose

Find actionable defects before merge, ordered by impact and supported by file-level evidence.

## Trigger conditions

Use when reviewing a diff, branch, implementation plan, or release candidate.

## Best practices

Trace changed code to callers and tests. Prefer concrete findings over style preferences; check validation, auth, errors, concurrency, performance, accessibility, and dead code.

## Workflow

1. Read the diff and identify affected ownership layers.
2. Trace data and control flow through adjacent code.
3. Run the fastest relevant checks.
4. Report only substantiated findings by severity.
5. State residual risks and checks not run.

## Validation checklist

- Findings identify the exact behavior and consequence.
- No secrets or sensitive payloads appear in the report.
- Positive verification is distinguished from unverified areas.

## Expected outputs

Prioritized review findings, verification evidence, and follow-up recommendations.
