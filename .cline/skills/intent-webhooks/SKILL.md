---
name: intent-webhooks
description: Harden Transferly provider and Telegram webhook ingestion. Use for raw-body capture, signature verification, timestamp freshness, replay prevention, event deduplication, webhook jobs, and safe provider callback processing.
---

# Purpose

Ensure untrusted webhook traffic is verified, deduplicated, persisted, and processed without leaking secrets or corrupting financial state.

## Trigger conditions

Use when changing PayPal, Stripe, crypto, Paystack, Flutterwave, Wise, Telegram webhook routes/controllers/services, provider webhook signature utilities, raw-body parsing, webhook jobs, or replay/recovery behavior.

## Best practices

- Verify signatures before trusting payloads.
- Use raw request bodies where providers require exact signature verification.
- Enforce timestamp freshness and replay/deduplication controls.
- Persist webhook receipts before async processing.
- Keep webhook processing idempotent and queue failures recoverable.
- Never log webhook secrets, signature headers, or raw sensitive payloads.

## Workflow

1. Identify provider contract, signature headers, raw body requirements, and event ID semantics.
2. Trace route → controller → verification → receipt persistence → job dispatch → handler side effects.
3. Add strict validation, dedupe keys, and safe failure responses.
4. Add tests for invalid signatures, stale timestamps, duplicate events, and replay/recovery.
5. Run webhook/provider tests and secret scan when sensitive payload handling changes.

## Validation checklist

- Unverified events cannot mutate state.
- Duplicate events are safe and deterministic.
- Webhook failure responses expose no secrets or raw payloads.
- Ledger/payment transitions remain transactional and audited.

## Expected outputs

Webhook security hardening, attack-oriented tests, and provider-specific residual-risk notes.