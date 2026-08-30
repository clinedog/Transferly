# Product Context

Transferly is a **cross‑platform money‑transfer platform** that brings together
payment providers (currently PayPal, with placeholders for Stripe, Paystack,
Flutterwave, crypto) under a single API surface. Users can:

1. **Create invoices** and request payouts.
2. **Buy points** in the Mini App to pay for services.
3. **Track transactions** through a unified ledger.

The product solves the friction of dealing with multiple payment SDKs, differing
webhook formats, and inconsistent balance calculations. By centralising the
ledger, Transferly guarantees a single source of truth for balances and audit
trails.

**User experience goals**
* Simple, responsive Mini App UI (Vite + React + Tailwind).
* Telegram Bot for quick operations and notifications.
* Clear error messages and idempotent flows to avoid duplicate charges.
