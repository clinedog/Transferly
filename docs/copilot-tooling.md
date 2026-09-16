# Transferly Copilot tooling

Transferly uses repository-local skills in `.cline/skills/`. The `.codex/skills`
compatibility bridge points to the same canonical directory.

## Skill groups

- Financial safety: `intent-ledger`, `intent-financial-state-machine`,
  `intent-provider-contract`, `intent-chaos-failure-injection`
- Security and tenancy: `intent-security`, `intent-tenancy`, `intent-rbac`,
  `intent-privacy-compliance`
- API platform: `intent-api`, `intent-api-platform`, `intent-openapi-sync`
- Reliability: `intent-queue-recovery`, `intent-backup-restore`,
  `intent-observability`, `intent-production-audit`
- Mini App quality: `intent-miniapp`, `intent-frontend`, `intent-uiux`,
  `intent-accessibility`, `intent-visual-regression`, `intent-playwright`
- Delivery: `intent-build`, `intent-test`, `intent-review`, `intent-refactor`,
  `intent-deploy`, `intent-release`, `intent-docs`

Invoke a skill explicitly when the work crosses a high-risk boundary:

```text
Use $intent-ledger and $intent-security to change payout state handling.
```

## Recommended VS Code extensions

Recommended extensions are listed in `.vscode/extensions.json`. They provide
editor capabilities only; they do not replace CI or server-side authorization.

## Safety rules

- Use staging or scrubbed fixtures with browser, database, Redis, and cloud tools.
- Do not provide production secrets, raw webhook payloads, bearer tokens, or
  payment credentials to an AI tool.
- Prefer read-only database and Redis access for diagnostics.
- Require explicit confirmation for financial mutations and destructive actions.
- Run `npm run validate:skills` after changing shared skills.
