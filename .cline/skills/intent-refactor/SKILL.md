---
name: intent-refactor
description: Safely restructure Transferly code without changing its observable behavior. Use for extracting modules, reducing duplication, clarifying boundaries, or modernizing implementation details.
---

# Purpose

Improve maintainability while preserving contracts, data integrity, and user behavior.

## Trigger conditions

Use when code is duplicated, oversized, unclear, or violates the repository’s layer boundaries.

## Best practices

Make behavior-preserving, incremental moves. Keep public contracts stable, separate mechanical edits from semantic changes, and do not combine unrelated cleanup.

## Workflow

1. Establish current behavior with tests and call-site inspection.
2. Identify one boundary or duplication target.
3. Move or simplify in small compilable steps.
4. Run focused and shared-behavior checks.
5. Compare behavior and explain the structural improvement.

## Validation checklist

- Public API, DB schema, and event behavior remain compatible.
- Tests cover the preserved behavior.
- No new cyclic imports, duplicated logic, or dead code.

## Expected outputs

A narrow refactor diff, passing checks, and compatibility notes.
