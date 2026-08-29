---
paths:
  - "**/*.test.js"
  - "**/*.spec.js"
  - ".github/workflows/**"
  - "scripts/**"
---
# Test and Release Rules

- Test authorization failures, duplicate requests, and financial non-mutation alongside success paths.
- Never mark an external provider workflow verified without a real sandbox/live check or clearly labeled mocks.
- Keep Playwright installation reproducible in CI with the package-local Playwright binary and required OS dependencies.
- Report environment-blocked browser runs separately from application failures.
- Before release, run the relevant package lint/tests/build plus secret scan and production readiness checks.