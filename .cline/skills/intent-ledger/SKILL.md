---
name: intent-ledger
description: Protect Transferly wallet, ledger, points, reservations, invoices, payouts, and financial reconciliation. Use for money/points movement, balance invariants, idempotency, reconciliation, or financial data integrity work.
---

# Purpose

Keep Transferly financial state internally consistent, auditable, and safe under retries, concurrency, provider callbacks, and recovery operations.

## Trigger conditions

Use when touching wallet buckets, ledger entries, point transactions, point reservations, top-up orders, invoices, payouts, provider settlement, reconciliation, or financial admin actions.

## Best practices

- Treat the internal ledger as the source of truth.
- Wrap all balance-changing operations in SQLite transactions.
- Use deterministic idempotency keys for retries, webhooks, and queued work.
- Enforce non-negative integer balance buckets at repository and service boundaries.
- Persist audit logs for externally meaningful state transitions.
- Never trust provider status alone for available balances or settled funds.

## Workflow

1. Map the state transition and all affected persisted rows.
2. Verify ownership, authorization, idempotency, and transaction boundaries.
3. Add or tighten invariant checks before mutation.
4. Add tests for duplicate requests, retry safety, negative balances, and partial failure recovery.
5. Run targeted ledger/order/payout/reconciliation tests, then API lint.

## Validation checklist

- No balance bucket can become negative or fractional.
- Repeated requests/webhooks/jobs do not duplicate side effects.
- Wallet, ledger, reservation, payout, invoice, and audit rows remain consistent.
- Recovery/reconciliation paths are deterministic and safe to retry.

## Expected outputs

Focused integrity hardening, invariant tests, executed checks, and residual financial-risk notes.