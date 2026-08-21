# Transferly API

Production-grade payments, invoicing, payouts, and wallet backend. Handles PayPal integration, SQLite persistence, Redis job queuing, and Telegram Mini App session management.

## Quick Start

### Prerequisites
- Node.js 18+
- Redis 7+
- SQLite 3

### Installation
```bash
cd api
npm install
cp .env.example .env  # Configure with your credentials
npm run db:migrate
npm run db:seed        # Optional: seed demo data
```

### Running
```bash
# Development
npm run dev            # Runs app.js with nodemon

# Worker (background jobs)
npm run dev:worker    # Runs jobs/worker.js

# Production
npm start
npm run worker
```

### Environment Variables
See `.env.example` for all required variables. Key ones:
- `REDIS_URL` — Redis connection for BullMQ job queue
- `SQLITE_DATABASE_PATH` — SQLite database file path
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` — PayPal API credentials
- `PAYPAL_WEBHOOK_ID` — PayPal webhook ID
- `JWT_SECRET` — Session token signing secret
- `TELEGRAM_BOT_TOKEN` — Telegram bot token for Mini App auth

### Verification
```bash
npm run lint              # ESLint
npm run db:migrate       # Verify migrations apply
npm test                 # Run all tests
npm run verify:paypal:sandbox  # Test PayPal integration
```

## Architecture

### Key Directories
- `app.js` — Express entry point
- `config.js` — Configuration defaults and validation
- `controllers/` — HTTP request handlers
- `services/` — Business logic (ledger, payouts, invoices)
- `repositories/` — Data access layer (queries, inserts)
- `routes/` — Route definitions
- `middleware/` — Request interceptors (auth, logging, errors)
- `jobs/` — BullMQ background jobs
- `webhooks/` — PayPal webhook handlers
- `db/` — Database schema, migrations, seed data

### Key Services
- **ledgerService** — Immutable transaction log; source of truth for balances
- **paypalInvoiceService** — Create, send, and track PayPal invoices
- **paypalPayoutService** — Submit and monitor PayPal payouts
- **riskService** — Evaluate transaction risk before approval
- **walletLinkService** — TonConnect wallet linking with ed25519 verification
- **telegramIdentityService** — Verify Telegram initData and create sessions
- **auditLogService** — Log all user actions for compliance

## Key Workflows

### Invoice Flow
1. User creates invoice → `POST /api/invoices`
2. PayPal invoice created immediately via API
3. Database record persisted with PayPal ID
4. User sends invoice link to recipient
5. PayPal webhook confirms payment → ledger updated → `pending_balance` increased
6. Admin releases funds → `pending_balance` → `available_balance`

### Payout Flow
1. User requests payout → `POST /api/payouts`
2. Check sufficient `available_balance`
3. Evaluate risk (geolocation, amount, velocity)
4. Reserve funds → `available_balance` → `frozen_balance`
5. Queue job to submit batch to PayPal
6. PayPal processes batch → webhook confirms
7. Move funds → `frozen_balance` → `paid_out_balance`

### Wallet & Ledger
- **Wallets** table: user, currency, balance columns (derived, not normalized)
- **Ledger** table: immutable log of all balance-changing events
- **Balance tiers**:
  - `available_balance` — Ready for payout
  - `pending_balance` — Awaiting approval (from invoices)
  - `frozen_balance` — Reserved for active payouts
  - `paid_out_balance` — Cumulative paid

### TonConnect Wallet Linking
1. User requests challenge → `POST /api/wallet-links/challenge`
2. Challenge stored with expiration (5 min)
3. User signs challenge with TON wallet private key
4. User submits proof → `POST /api/wallet-links/verify`
5. API verifies ed25519 signature
6. TON address derivation attempted (best-effort, tonweb)
7. If match: persist link; if mismatch: reject

### Telegram Mini App Auth
1. Mini App initializes with Telegram.WebApp
2. Gets `initData` from Telegram client
3. Exchanges for session token → `POST /auth/telegram/exchange`
4. API verifies HMAC-SHA256 signature, checks auth_date
5. Creates session, returns JWT token
6. All subsequent requests use JWT for auth

## Testing

### Unit Tests
```bash
npm test                     # Run all tests (Node --test)
```

Tests cover:
- Service logic (ledger, payouts, invoices)
- Repository queries
- Webhook signature verification
- Auth flows

### Integration Tests
See `tests/api.integration.test.js` for full API flow tests with real DB.

### Manual Testing
```bash
# Verify PayPal sandbox credentials
npm run verify:paypal:sandbox

# Test provider smoke
npm run smoke:providers
```

## Monitoring & Observability

### Health Check
```bash
curl http://localhost:3000/api/health
```

Returns:
- `database` — SQLite connectivity
- `redis` — Redis connectivity (if configured)
- `uptime` — Server uptime

### Client Health
```bash
curl http://localhost:3000/api/health/client
```

Returns readiness info for Mini App (auth, feature flags, deployment status).

### Structured Logging
All requests logged with:
- `requestId` — Unique request identifier
- `method`, `path`, `statusCode`, `durationMs`
- Service-level logs include operation names and IDs

Logs can be piped to Sentry/DataDog/ELK for monitoring.

## Security

### Secrets Management
- **Never commit credentials.** Use `.env` and environment variables.
- Rotate credentials every 90 days.
- Use Dependabot alerts for dependency vulnerabilities.
- Scan with `npm audit` in CI.

### Idempotency
- All balance-changing operations require `Idempotency-Key` header.
- PayPal API calls use deterministic batch IDs for replay protection.
- Webhook processing deduplicates by event ID.

### Validation
- All inputs validated with Zod schemas.
- Rate limiting on auth endpoints.
- CORS restricted to configured origins.

## Deployment

### Staging
```bash
npm ci
npm run lint
npm run db:migrate
npm test
npm run smoke:providers
```

### Production
See `docs/deployment-operations-guide.md` for:
- Pre-deployment checklist
- Canary rollout procedure
- Rollback playbook
- Incident response

### Environment Setup
```bash
# Required
export REDIS_URL=redis://localhost:6379
export PAYPAL_CLIENT_ID=<sandbox-or-live-id>
export PAYPAL_CLIENT_SECRET=<secret>
export JWT_SECRET=<random-32-char-string>

# Optional
export PAYPAL_ENVIRONMENT=sandbox  # or: live
export MAX_SINGLE_PAYOUT=10000     # cents
export DAILY_PAYOUT_LIMIT=100000   # cents
export HIGH_RISK_COUNTRIES=RU,IR,KP
```

## CI/CD

GitHub Actions workflows:
- `.github/workflows/api-ci.yml` — Lint, audit, migrate, test (runs on PR)
- `.github/workflows/security.yml` — npm audit, dependency check (weekly)

## Troubleshooting

### Database Errors
Check migrations have run:
```bash
npm run db:migrate:status
```

### Redis Connection Fails
Ensure Redis is running:
```bash
redis-cli ping  # Should return PONG
```

### PayPal Webhook Delays
Check BullMQ queue:
```bash
# In worker logs, look for queue depth
```

Check PayPal API status: https://www.paypalstatus.com

## Contributing

1. Create a feature branch: `git checkout -b feature/description`
2. Make changes and add tests
3. Run lint and tests: `npm run lint && npm test`
4. Commit with clear messages: `git commit -m "feat(scope): description"`
5. Push and open a PR

See `docs/deployment-operations-guide.md` for release procedures.

## License

Proprietary — Transferly Inc.
