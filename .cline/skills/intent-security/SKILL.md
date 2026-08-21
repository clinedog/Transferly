---
name: intent-security
description: Secure Transferly API, bot, Mini App, providers, secrets, and deployments. Use for authentication, authorization, input validation, webhook, dependency, payment, or threat-review work.
---

# Purpose

Reduce exploitability while retaining auditable, production-safe flows.

## Trigger conditions

Use for handling untrusted input, identity, money movement, webhooks, secrets, configuration, or security findings.

## Best practices

Validate at boundaries with Zod, reject unknown fields, verify Telegram and provider signatures, use idempotency, redact logs, and never trust provider status over the internal ledger.

## Workflow

1. Map trust boundaries, assets, and state changes.
2. Inspect authorization, validation, logging, storage, and retries.
3. Implement least-privilege controls and safe failures.
4. Add attack-oriented and regression tests.
5. Run secret scanning and affected verification.

## Validation checklist

- No secrets, tokens, raw webhook headers, or sensitive payloads are exposed.
- Auth precedes privileged actions and state mutation is transactional.
- Provider and Telegram callbacks are verified before processing.

## Expected outputs

Threat-oriented findings or hardened implementation, tests, and residual-risk notes.
