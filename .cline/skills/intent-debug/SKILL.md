---
name: intent-debug
description: Diagnose and fix Transferly failures, regressions, flaky tests, and unexpected behavior. Use for error reports, failing CI, runtime incidents, or inconsistent state.
---

# Purpose

Reach a verified root cause and minimal corrective change without masking symptoms.

## Trigger conditions

Use for an exception, failed test, regression, data inconsistency, or unreliable integration.

## Best practices

Reproduce first, narrow with evidence, protect sensitive logs, and favor deterministic tests. Treat payment, ledger, webhook, and auth symptoms as cross-layer investigations.

## Workflow

1. Capture the failure, inputs, environment, and expected behavior.
2. Reproduce or construct the smallest failing case.
3. Trace from boundary to state transition and side effect.
4. Fix the root cause and add a regression test.
5. Re-run focused checks, then affected integration checks.

## Validation checklist

- Failure is reproduced before and resolved after the patch.
- Error handling preserves useful, non-sensitive diagnostics.
- The fix does not introduce a state or retry hazard.

## Expected outputs

Root-cause explanation, minimal fix, regression coverage, and verification results.
