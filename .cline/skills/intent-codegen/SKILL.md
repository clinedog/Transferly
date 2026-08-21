---
name: intent-codegen
description: Implement focused Transferly features, modules, and scaffolding. Use for new API, bot, Mini App, job, repository, or shared-contract code that must follow existing architecture.
---

# Purpose

Create small, composable production-ready additions without duplicating existing behavior.

## Trigger conditions

Use for a new feature, module, route, command, component, job, or contract.

## Best practices

Preserve ownership: routes/controllers transport, services logic, repositories persistence, and jobs/webhooks side effects. Reuse local patterns and validate boundaries.

## Workflow

1. Inspect the owning package and one close analog.
2. Trace callers, contracts, persistence, and tests.
3. Implement the narrowest additive change.
4. Add focused tests and run affected checks.
5. Report behavior, validation, and risks.

## Validation checklist

- No duplicate helper or bypassed layer.
- External input has schema validation and errors are handled.
- Relevant lint, test, and build checks pass.

## Expected outputs

A reviewable implementation, targeted tests, and an evidence-based summary.
