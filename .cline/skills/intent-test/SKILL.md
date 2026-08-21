---
name: intent-test
description: Design and run Transferly unit, integration, contract, and regression tests. Use when adding coverage, diagnosing failures, or validating changed behavior.
---

# Purpose

Produce reliable tests that protect user-visible and stateful behavior.

## Trigger conditions

Use for new logic, bug fixes, test gaps, API contracts, jobs, payments, or boundary conditions.

## Best practices

Test behavior rather than implementation details. Use deterministic fixtures, isolated state, and existing test helpers; prioritize idempotency, authorization, and state transitions.

## Workflow

1. Identify the observable contract and failure modes.
2. Find the nearest existing test pattern.
3. Add focused happy-path and meaningful negative cases.
4. Run the narrow test, then package tests when shared behavior changes.
5. Record environment prerequisites for skipped suites.

## Validation checklist

- Tests fail for the prior defect or absent behavior.
- Tests do not depend on real credentials or external production services.
- Assertions cover output and persisted state where relevant.

## Expected outputs

Focused test coverage, executed commands, and any unmet test-environment prerequisites.
