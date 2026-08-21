---
name: intent-build
description: Maintain Transferly build, dependency, lint, CI, and local development tooling. Use for package scripts, devcontainer, GitHub Actions, bundling, or build failures.
---

# Purpose

Keep developer feedback fast, repeatable, and representative of production constraints.

## Trigger conditions

Use for package scripts, lockfiles, CI, devcontainer, lint, builds, dependency updates, or tooling failures.

## Best practices

Use package-scoped commands, preserve lockfile determinism, avoid unnecessary tooling, and align local checks with CI/release gates.

## Workflow

1. Inspect package scripts, lockfiles, CI workflow, and devcontainer.
2. Reproduce the build or tooling need with the narrowest command.
3. Make a minimal configuration change.
4. Reinstall only affected dependencies and run the changed command.
5. Run a broader verification when shared tooling changed.

## Validation checklist

- Node/package-manager versions match project configuration.
- CI and local commands use the same package scope and dependencies.
- No credentials or environment-specific paths are embedded.

## Expected outputs

Reproducible tooling change, commands run, and any required setup notes.
