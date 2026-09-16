---
name: intent-privacy-compliance
description: Protect Transferly payment, Telegram, provider, identity, audit, and operational data through minimization, retention, redaction, access control, export, and deletion rules.
---

# Purpose

Prevent sensitive data leakage while preserving required financial auditability.

## Workflow

1. Classify data and trust boundaries.
2. Inspect logs, API responses, storage, exports, and error reporting.
3. Minimize, redact, encrypt, or restrict sensitive fields.
4. Define retention and deletion behavior without destroying required ledger evidence.
5. Add secret-scanning and response-shape tests.

## Validation checklist

- No tokens, API secrets, credentials, or raw sensitive webhook payloads are logged.
- Frontend responses contain only necessary provider and identity fields.
- Audit logs retain action evidence without secret material.
- Data exports are authorized and minimized.

