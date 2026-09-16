# Provider Module Architecture

Transferly is a modular financial services platform. Every payment provider is an independent service module that shares common platform infrastructure while implementing only its unique behaviour. PayPal, Stripe, Wise, Flutterwave, Paystack, and Crypto Commerce are enabled modules; Binance and Cash App are discovery-only modules and remain disabled until their integration, jurisdiction, custody/settlement, webhook, and ledger controls are approved.

---

## Directory Structure

```
api/
└── providers/
    ├── base-provider.js          BaseProvider class (extend this)
    ├── registry.js               Re-exports moduleRegistry singleton
    ├── moduleRegistry.js         ProviderModuleRegistry — auto-discovery + enable/disable
    ├── shared/
    │   ├── providerSDK.js        Central SDK entry point (all shared primitives)
    │   ├── providerConfig.js     Typed, per-provider config from env vars
    │   ├── createProviderWorkspaceModule.js  Module factory
    │   ├── mountProviderRoutes.js  Mounts per-provider routes + webhooks at startup
    │   └── tests/
    │       └── providerSDK.test.js  Comprehensive SDK test suite
    ├── paypal/
    │   ├── index.js              Module entry (createProviderWorkspaceModule output)
    │   ├── provider.js           PayPalProvider extends BaseProvider
    │   ├── client.js             HTTP client stub
    │   ├── service.js            Service layer
    │   ├── routes.js             Per-provider Express router (mounted at /api/providers/paypal)
    │   ├── webhooks.js           Webhook router (mounted at /webhooks/paypal)
    │   ├── jobs.js               BullMQ job definitions
    │   ├── schemas.js            Zod schemas for provider-specific query params
    │   ├── fixtures.js           Test fixtures
    │   ├── adapter.js            PayPal adapter bridge
    │   ├── readiness.js          PayPal-specific readiness checks
    │   ├── statusMapper.js       PayPal status → Transferly status mapping
    │   ├── webhookMapper.js      PayPal event → internal event mapping
    │   ├── README.md             Provider-specific notes
    │   └── tests/
    ├── stripe/    (same structure)
    ├── wise/      (same structure)
    ├── paystack/  (same structure)
    ├── flutterwave/ (same structure)
    └── crypto/    (same structure)

miniapp/src/
└── providers/
    ├── index.js                  ALL_PROVIDERS barrel + getProvider() helper
    ├── ProviderRegistry.jsx      React context + useProvider / useProviderRegistry hooks
    ├── shared/
    │   ├── BaseProviderUI.jsx    ProviderShell + re-exports ProviderOverview + ProviderTransactions
    │   ├── ProviderOverview.jsx  Shared Overview tab (metrics, activity, readiness)
    │   └── ProviderTransactions.jsx  Shared Transactions tab (search, pagination)
    ├── paypal/
    │   ├── index.js              UI module descriptor
    │   ├── Overview.jsx          → delegates to shared ProviderOverview
    │   └── Transactions.jsx      → delegates to shared ProviderTransactions
    └── stripe/ wise/ paystack/ flutterwave/ crypto/  (same structure)

bot/
└── utils/
    └── providerWorkspaces.js     Pulls from shared/providerWorkspaceContract.js, merges bot-only lanes

shared/
└── providerWorkspaceContract.js  Re-exports api/constants/providerWorkspaceContract.js
```

---

## Provider Module Lifecycle

### 1. Discovery (startup)

`ProviderModuleRegistry` scans `api/providers/` at startup:

```js
const entries = fs.readdirSync(directory)
  .filter(entry => entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'shared')
```

For each directory it finds, it `require`s `index.js` and validates the module exposes `key`, `adapter`, and `getContract()`.

### 2. Validation

Each provider `index.js` must call `createProviderWorkspaceModule()`:

```js
module.exports = createProviderWorkspaceModule({
  key: 'stripe',        // must match directory name
  order: 20,            // display order
  adapter: stripeProviderAdapter,
  fixtures: {}
});
```

The registry throws at startup if `key` doesn't match the directory name, or if `adapter`/`getContract` are missing.

### 3. Enable / Disable

Set `PAYMENT_PROVIDER_FEATURE_FLAGS` in `.env`:

```
PAYMENT_PROVIDER_FEATURE_FLAGS=paypal,stripe
```

An empty value enables providers marked `enabledByDefault`; this preserves live and setup-backed providers while keeping discovery-only modules dark. A non-empty value is an explicit allowlist. The registry's `isEnabled(key)` and `list()` respect this gate.

### 4. Per-provider Routes

If `api/providers/<key>/routes.js` exists, `mountPerProviderRoutes()` mounts it at `/api/providers/<key>` with `requireAuthenticatedUser` applied automatically.

If `api/providers/<key>/webhooks.js` exists, it's mounted at `/webhooks/<key>` without auth (signature verification is the provider's responsibility).

### 5. Config

Every provider has a typed config object from `providerConfig.js`:

```js
const { getProviderConfig } = require('../shared/providerConfig');
const cfg = getProviderConfig('stripe');
// { secretKey, webhookSecret, apiVersion, baseUrl, configured, missingKeys }
```

`BaseProvider.getConfig()` calls this automatically, so providers never read `process.env` directly.

---

## How to Add a New Provider

### Step 1 — API module

Create `api/providers/<key>/` with:

```
index.js       createProviderWorkspaceModule({ key, order, adapter, fixtures })
provider.js    class extends BaseProvider { createClient(), getHealth() }
client.js      HTTP client (retries, timeouts, idempotency)
service.js     Service layer (getBalance, listTransactions, etc.)
routes.js      Express router for provider-specific endpoints
webhooks.js    Webhook router (verify signature before processing)
schemas.js     Zod schemas for provider-specific params
fixtures.js    Test fixtures: { provider, readiness, invoices, payouts }
README.md      Provider notes: credentials, environments, webhook setup
tests/         <key>.service.test.js — unit tests
```

### Step 2 — Adapter

Add an adapter in `api/adapters/paymentProviders/<key>ProviderAdapter.js`:

```js
const { createProviderAdapter } = require('./baseProviderAdapter');

const myProviderAdapter = createProviderAdapter({
  key: 'myprovider',
  displayName: 'My Provider',
  requiredEnv: ['MY_API_KEY'],
  capabilities: { invoices: true, payouts: false },
  supportedOperations: ['invoice.create']
});

module.exports = { myProviderAdapter };
```

Then reference it in `api/providers/<key>/index.js`.

### Step 3 — Config

Add the provider's config shape to `api/providers/shared/providerConfig.js`:

```js
function buildMyProviderConfig() {
  return buildConfigEntry('myprovider', { apiKey: true }, {
    apiKey: config.MY_API_KEY || '',
    baseUrl: 'https://api.myprovider.com'
  });
}
// Add 'myprovider': buildMyProviderConfig to CONFIG_BUILDERS
```

### Step 4 — miniapp UI module

Create `miniapp/src/providers/<key>/`:

```
index.js        { id, name, components: { Overview, Transactions }, metadata }
Overview.jsx    import { ProviderOverview } from '../shared/BaseProviderUI'; delegate
Transactions.jsx import { ProviderTransactions } from '../shared/BaseProviderUI'; delegate
```

Then add to `miniapp/src/providers/index.js`:

```js
import myProvider from './<key>';
export const ALL_PROVIDERS = Object.freeze([
  ...existing,
  myProvider
]);
```

### Step 5 — Provider manifest

Add the workspace manifest entry to `api/constants/providerWorkspaceContract.js` (PROVIDER_WORKSPACES array). This automatically flows through to:
- The API's provider routes (capabilities, readiness, dashboard)
- The bot's command menus (via `shared/providerWorkspaceContract.js`)
- The miniapp's `providerManifests.js` tabs and routing

### Step 6 — Tests

Add `api/providers/<key>/tests/<key>.service.test.js` covering:
- Provider constructor
- `getHealth()` shape
- `createClient()` returns object
- `getContract()` returns provider key and operations map

### Step 7 — Verify

```bash
npm run lint --prefix api
npm run db:migrate --prefix api
npm test --prefix api
npm run build --prefix miniapp
```

---

## Shared Abstractions Reference

| Abstraction | Location | Purpose |
|---|---|---|
| `BaseProvider` | `api/providers/base-provider.js` | Abstract base class — extend for every provider |
| `ProviderModuleRegistry` | `api/providers/moduleRegistry.js` | Auto-discovery, enable/disable, singleton |
| `createProviderWorkspaceModule` | `api/providers/shared/createProviderWorkspaceModule.js` | Module factory |
| `createProviderAdapter` | `api/adapters/paymentProviders/baseProviderAdapter.js` | Adapter contract factory |
| `providerConfig` | `api/providers/shared/providerConfig.js` | Typed env-var → config mapping |
| `ProviderSDK` | `api/providers/shared/providerSDK.js` | Central re-export of all above |
| `mountPerProviderRoutes` | `api/providers/shared/mountProviderRoutes.js` | Mounts routes.js + webhooks.js at startup |
| `ProviderOverview` | `miniapp/src/providers/shared/ProviderOverview.jsx` | Shared Overview UI (metrics, activity, readiness) |
| `ProviderTransactions` | `miniapp/src/providers/shared/ProviderTransactions.jsx` | Shared Transactions UI (search, pagination) |
| `ALL_PROVIDERS` | `miniapp/src/providers/index.js` | Registry barrel — add new providers here |
| `providerWorkspaceContract` | `shared/providerWorkspaceContract.js` | Single source of truth for manifests across all packages |

---

## Extension Points

- **New provider**: follow "How to Add a New Provider" above — no existing files need modification except `providers/index.js` (miniapp) and `providerWorkspaceContract.js`
- **New operation type**: add to `OPERATION_SUPPORT` in `providerCapabilityService.js` and the adapter's `supportedOperations` array
- **New lane**: add to the provider's `lanes` array in `providerWorkspaceContract.js` — bot menus, miniapp tabs, and routing all update automatically
- **Feature flags**: use `ENABLED_PAYMENT_PROVIDERS` env var to gate providers at runtime without code changes
- **Custom UI sections**: pass `children` to `ProviderOverview` or `ProviderTransactions` for provider-specific content below the shared layout

---

## Webhook Architecture

Per-provider webhook routers are mounted at `/webhooks/<key>` by `mountPerProviderRoutes`.
**Important**: `webhookRoutes.js` (which handles PayPal, Stripe, and Crypto with full ledger integration)
is mounted **before** `mountPerProviderRoutes` in `routes/index.js`, so those providers' existing
handlers always win. Per-provider webhooks.js files activate only for providers not yet in
`webhookRoutes.js` (currently Wise, Paystack, Flutterwave).

Each per-provider `webhooks.js` implements:
- **Signature verification** using the provider's scheme (see table below)
- **In-process deduplication** (Set, 5000-entry cap — replace with Redis for multi-instance production)
- **Async job dispatch** via `setImmediate` → `jobs.processWebhookEvent`

| Provider | Signature scheme | Header |
|---|---|---|
| Stripe | HMAC-SHA256 (timestamp.body) | `Stripe-Signature` |
| Wise | RSA-SHA256/PSS | `X-Signature-SHA256` |
| Paystack | HMAC-SHA512 | `X-Paystack-Signature` |
| Flutterwave | Constant-time secret compare | `verif-hash` |
| Crypto | HMAC-SHA256 | `X-CC-Webhook-Signature` |

## Health Endpoints

### Provider manifest and readiness report

`api/services/providerManifestService.js` derives safe provider metadata from discovered provider modules and the existing workspace contract. It includes lifecycle, feature-gate state, configuration readiness, routes, navigation, and permissions without exposing credentials.

`GET /api/admin/payment-providers/readiness` is an admin-authenticated operational summary. It includes disabled discovery modules such as Binance and Cash App, but it does not activate routes, API calls, webhooks, custody, or money movement. Disabled modules have no health probe and explicitly recommend completing the approved integration before enablement.

### Execution readiness contract

Provider readiness is authoritative at the operation level. The provider readiness and status responses expose a legacy `status` field for compatibility and canonical `operation_status`, `execution_eligible`, `production_enabled`, and `sandbox_enabled` fields for all new consumers. Valid canonical states are `unsupported`, `planned`, `coming_soon`, `preview`, `sandbox`, `live`, `disabled`, `degraded`, and `maintenance`.

Only `live` is production-executable. `sandbox` can execute only in a sandbox environment; all other states are non-executable even when shown in the UI. Configuration and credential readiness contain environment-variable names and missing names only—never values. Country and currency allowlists are restrictive: an absent declaration means unknown support, never worldwide support.

Use `buildProviderReadinessDescriptor()` from `api/core/financial/providerContract.js` for new provider or admin surfaces. It is the canonical adapter-to-product translation; do not infer readiness from a UI lane, a provider name, or a non-empty capability list.
### Normalized result + error contract

Beyond readiness, provider **responses and errors** are normalized before they can influence domain logic. `api/core/financial/providerContract.js` exports provider-agnostic helpers that every adapter-facing integration should go through:

- `normalizeProviderOutcome(rawStatus)` maps a raw provider status to a canonical financial outcome (`success` | `failed` | `unknown`). Normalization is deliberately conservative: empty, pending/in-flight, and unrecognised statuses resolve to `unknown`, never to `success`.
- `buildProviderResult({ operation, provider, rawStatus, settlement, ... })` produces the canonical result for a payment, payout, refund, or balance operation. It separates `outcome` from `settlement` and raises `reconciliation_required: true` whenever the outcome or settlement is `unknown`.
- `categorizeProviderError(error)` classifies an error into a canonical category (`authentication`, `timeout`, `rate_limit`, `provider_down`, `insufficient_funds`, `declined`, `duplicate`, `invalid_request`, `configuration`, `connectivity`, `unknown`) with a deterministic `retryable` answer. The raw provider message is never surfaced (`raw_provider_error_exposed: false`).
- `screenSafeMetadata(metadata)` redacts credential-shaped values and sensitive keys, and truncates deep/large payloads, so provider request material cannot reach logs, API responses, or clients.
- `normalizeWebhookEvent(...)` classifies an inbound event as `financial`, `dispute`, `administrative`, or `unknown` and flags unknown financial outcomes for reconciliation.

Two invariants apply to all of these helpers:

1. An unknown or ambiguous provider outcome is **never** silently settled as `success`; it must enter reconciliation.
2. Provider transaction IDs and references are preserved, but secret material is never echoed.

These helpers compose with the readiness descriptor so a capability can be production-eligible for routing (`execution_eligible.production === true`) while its live runtime result is still normalized safely.

Every provider exposes `GET /api/providers/<key>/health` (auth-guarded).
Returns HTTP 200 when configured, 503 when env vars are missing.

```json
{ "ok": true, "data": { "provider": "stripe", "status": "configured", "configured": true } }
```

## Testing Strategy

Tests live at three levels:

| Level | Location | Runs with |
|---|---|---|
| Provider SDK unit | `api/providers/shared/tests/providerSDK.test.js` | `npm test --prefix api` |
| Per-provider service/provider/client/jobs | `api/providers/<key>/tests/<key>.service.test.js` | `npm test --prefix api` |
| Integration (routes, auth, payouts, webhooks) | `api/test/api.integration.test.js` | `npm test --prefix api` |
| Miniapp e2e | `miniapp/tests/` | `npm run test:e2e --prefix miniapp` |
| Bot contract | `bot/tests/apiContract.test.js` | `npm test --prefix bot` |

## Incremental migration plan

1. Keep existing provider routes and aggregate invoice/payout APIs stable.
2. Register a provider module with an adapter, centralized config, metadata, and explicit default enablement policy.
3. Add provider client, service, Zod schemas, jobs, webhook verification, persistence, and tests after its contract is approved.
4. Add a provider workspace contract and Mini App module using the shared overview, transactions, activity, settings, and error-state components.
5. Enable through `PAYMENT_PROVIDER_FEATURE_FLAGS` only after transactions reconcile to the internal ledger, audit logging is present, and release gates pass.

Binance and Cash App currently complete step 2 only. They are intentionally absent from user-facing provider navigation and cannot submit external requests, receive webhooks, or mutate balances.

## Remaining Technical Debt

| Item | Location | Notes |
|---|---|---|
| Ledger integration in per-provider jobs | `api/providers/{wise,paystack,flutterwave}/jobs.js` | Marked with `// TODO: credit internal pending_balance` — wire `ledgerService` once live credentials available |
| Redis webhook deduplication | All `webhooks.js` files | In-process `Set` works for single-instance; replace with Redis key-expiry store for multi-instance production |
| Real API calls | All non-PayPal clients | Clients are production-ready (auth, retries, error parsing) but no live credentials are wired in the test environment |
