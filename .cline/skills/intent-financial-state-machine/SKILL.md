---
name: intent-financial-state-machine
description: Harden Transferly payment, payout, invoice, refund, transfer, unknown, and reconciliation state machines against illegal transitions, duplicate side effects, and provider ambiguity.
---

# Purpose

Preserve ledger truth and safe financial transitions under retries, timeouts, callbacks, and worker restarts.

## Workflow

1. Map the current state machine and legal transitions.
2. Separate provider status from internal financial state.
3. Persist idempotency, provider references, audit events, and ledger mutations atomically.
4. Preserve UNKNOWN until authoritative reconciliation.
5. Test duplicates, timeout, replay, out-of-order events, rollback, and concurrent mutation.

## Validation checklist

- No direct wallet mutation bypasses the ledger service.
- Unknown outcomes never auto-create a second financial operation.
- Duplicate webhooks and jobs are harmless.
- Failed transactions cannot leave partial balance changes.
- Every externally meaningful transition is auditable.

