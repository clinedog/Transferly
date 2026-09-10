# Transferly Master Product Vision & Architecture

**Status:** Active | **Last Updated:** 2026-09-09
**For:** Cline/Codex implementation guidance, Mintlify documentation, future reference

> **Transferly — an intelligent, provider-agnostic financial infrastructure platform for payments, payouts, wallets, invoices, reconciliation, and business financial operations.**

---

## 1. Product North Star

Transferly should become a **Telegram-native financial operating layer** for modern businesses:

> **One place to request, collect, track, reconcile, and safely move money, with proactive bot automation and evidence-backed transaction status.**

Every feature must support this position rather than merely adding another provider dashboard.

---

## 2. The Three-Layer Capability Model

### Layer 1 — Provider-Native Capabilities

What the provider genuinely supports. Examples:

- PayPal: invoices, payouts, payments, webhooks, disputes, subscriptions
- Stripe Connect: payments, billing, connected accounts, refunds, webhooks
- Wise: receive, send, balances, compliance
- Paystack: collections, transfers, customers, virtual accounts, subscriptions, refunds, webhooks
- Flutterwave: collections, transfers, settlements, refunds, webhooks

**Transferly never claims native support for what a provider lacks.** Instead, we expose only what exists.

---

### Layer 2 — Transferly-Enhanced Capabilities

Intelligence built around providers:

- **Smart Routing** – automatically selects the optimal provider based on country, currency, payment method, capability, health, fees, latency, limits, and risk.
- **Provider Health** – real-time monitoring and status indicators.
- **Automatic Failover** – routes to alternate providers when the primary is unavailable *before* execution.
- **Unified Transaction History** – cross-provider aggregation with provider tagging.
- **Reconciliation Engine** – matches provider observations with internal ledger entries.
- **Risk Engine** – scores transactions 0–100; blocks high-risk items automatically.
- **Analytics & Reporting** – per-provider and global dashboards with settlement data.
- **Audit Trails** – immutable records for every financial mutation.
- **Notification Automation** – Telegram, email, webhook, and push notifications with customizable rules.

---

### Layer 3 — Transferly-Universal Capabilities

Capabilities independent of any single provider:

- **Global Wallet** – aggregates balances across all connected providers.
- **Transaction Center** – unified timeline showing request → provider → webhook → ledger.
- **Payment Links** – reusable URLs for collecting payments across any supported method.
- **Universal Checkout** – card, bank, mobile-money, wallet, PayPal, Stripe options (shown dynamically).
- **Business Management** – organizations, RBAC, team members, provider preferences.
- **SDKs & APIs** – RESTful JSON with OpenAPI contract; TypeScript definitions for frontend.
- **Developer Sandbox** – test wallets, simulated providers, webhook testing, test fixtures.

---

## 3. Provider-First Workspaces

Each connected provider becomes a first-class financial workspace. Navigation is generated from the provider capability manifest, ensuring:

- only supported features appear as navigable tabs;
- actions are enabled or disabled based on actual provider state (`live`, `preview`, `setup`);
- unsupported lanes remain visible only as **Coming Soon** and never call provider APIs, create orders, or charge points.

### Provider Workspace Manifest (Schema)

```json
{
  "id": "paypal",
  "slug": "paypal",
  "displayName": "PayPal",
  "shortDescription": "Transferly-owned PayPal operations workspace.",
  "icon": "paypal",
  "accentColor": "#0070BA",
  "docsUrl": "https://developer.paypal.com/docs/",
  "supportUrl": "https://www.paypal.com/us/cshelp/",
  "environments": ["sandbox", "live"],
  "capabilities": [
    "invoices", "payouts", "payments", "orders", "transactions",
    "webhooks", "disputes", "subscriptions", "tokens", "fx"
  ],
  "status": "live",
  "lanes": [
    { "id": "overview", "label": "Overview", "intent": "overview", "status": "live" },
    { "id": "invoices", "label": "Invoices", "intent": "collect", "status": "live" },
    { "id": "payouts", "label": "Payouts", "intent": "send", "status": "live" },
    { "id": "payments", "label": "Payments", "intent": "payments", "status": "preview" },
    { "id": "transactions", "label": "Transactions", "intent": "reconciliation", "status": "preview" },
    { "id": "webhooks", "label": "Webhooks", "intent": "webhooks", "status": "live" }
  ]
}
```

### Lane Status Semantics

| Status | Meaning |
|--------|---------|
| `live` | Fully functional; money movement is enabled after policy checks. |
| `preview` | UI or partial backend support exists; do not present as production-ready. |
| `setup` | Placeholder with setup guidance; no provider API call or financial mutation. |


---

## 4. Provider Capabilities by Platform

### PayPal

| Capability | Status | Notes |
|------------|--------|-------|
| Invoices | ✅ Live | Create, send, refresh, cancel, release funds |
| Payouts | ✅ Live | Mass payouts with deterministic batch IDs |
| Payments | ⚠ Preview | Captures, refunds, voids, payment timelines |
| Webhooks | ✅ Live | Signature verification, receipt persistence, replay readiness |
| Disputes | ⚠ Preview | Evidence submission and status tracking |
| Subscriptions | ⚠ Preview | Lifecycle management |
| FX | ⚠ Preview | Currency conversion rates |

**Official reference:** https://developer.paypal.com/docs/

### Stripe Connect

| Capability | Status | Notes |
|------------|--------|-------|
| Payments | ✅ Live | Customer → invoice item → invoice → finalize flow |
| Billing | ⚠ Preview | Subscriptions, invoices, customer portal |
| Connected Accounts | ✅ Live | Onboard, refresh, and gated transfer submission |
| Webhooks | ✅ Live | Event verification and idempotency |
| Refunds | ⚠ Preview | API-driven refund lifecycle |

**Official reference:** https://docs.stripe.com/connect

### Wise

| Capability | Status | Notes |
|------------|--------|-------|
| Receive | ⚠ Setup | Account details and balance checks |
| Send | ⚠ Setup | Quotes, recipients, transfers |
| Balances | ⚠ Setup | Multi-currency balances |
| Compliance | ⚠ Setup | Verification and transfer readiness |

**Official reference:** https://docs.wise.com/

### Paystack

| Capability | Status | Notes |
|------------|--------|-------|
| Collections | ⚠ Setup | Card, bank, mobile-money collection |
| Customers | ⚠ Setup | Customer lookup and profile readiness |
| Virtual Accounts | ⚠ Setup | Dedicated collection destinations |
| Subscriptions | ⚠ Setup | Recurring billing |
| Webhooks | ⚠ Setup | Event ingestion and signature verification |

**Official reference:** https://paystack.com/docs/

### Flutterwave

| Capability | Status | Notes |
|------------|--------|-------|
| Collections | ⚠ Setup | Card, bank, mobile-money collection |
| Transfers | ⚠ Setup | Payouts and recipient management |
| Settlements | ⚠ Setup | Settlement tracking and reconciliation |
| Refunds | ⚠ Setup | Refund lifecycle |
| Webhooks | ⚠ Setup | Event verification |

**Official reference:** https://developer.flutterwave.com/docs

---

## 5. Automatic Payout Lifecycle

Normal payouts execute **without admin approval** when all checks pass:

```
User requests payout
        ↓
Validate request (amount, beneficiary)
        ↓
Calculate service points (fees)
        ↓
Check available balance & reserve
        ↓
Risk/policy evaluation (score < 30 → auto)
        ↓
Provider capability check (eligible provider)
        ↓
Provider selection (Smart Routing or user preference)
        ↓
Execute payout → provider API
        ↓
Provider confirmation → webhook
        ↓
Ledger settlement (transaction entry)
        ↓
Notification (success/failure)
```

### Service Pricing Engine

| Service | Points Cost | Auto-charged? |
|---------|-------------|---------------|
| Create invoice | 250 | ✅ |
| Receive payment | 250 | ✅ |
| Payout | 250 | ✅ |
| Refund | 150 | ✅ |
| Webhook replay | 0 | ❌ (internal) |
| Provider balance check | 0 | ❌ |

**Pre-transaction quote screen:**

```
Confirm Payout

Amount:         ₦100,000
Provider:       Paystack
Provider fee:   ₦1,500
Transferly fee: 250 points

Estimated completion: ~30 seconds

[Confirm payout] [Cancel]
```

---

## 6. Risk-Based Admin Intervention

A policy engine routes transactions based on risk score:

| Score | Action |
|-------|--------|
| 0–29 | ✅ Auto-execute |
| 30–59 | ⚠ Queue for review |
| 60–79 | 🛑 Request additional info |
| 80–100 | ❌ Block for investigation |

**Risk signals include:**
- Transaction velocity and amount
- Account history and age
- Destination country match
- Provider success anomalies
- Unusual behavior patterns
- Configurable rule violations

Every blocked or reviewed item includes an **explanation** visible to admins.
The current source of truth for these manifests is `api/constants/providerWorkspaceContract.js`, with the same contract mirrored for the Mini App and bot.