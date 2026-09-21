# Transferly Release Gates

Run these checks before promoting the API, bot, or Mini App to a shared staging or production environment.

## Commands

- `npm run verify`: runs the API lint, API tests, bot tests, and Mini App production build.
- `npm run check:production`: statically verifies deployment files, environment examples, provider workspace contracts, and production-only requirements when `NODE_ENV=production`.
- `npm run verify:staging`: checks staging environment shape, HTTPS URLs, CORS alignment, and bot webhook settings. Missing live environment variables are warnings unless `STAGING_STRICT=true` or `NODE_ENV=staging`.
- `npm run check:miniapp:bundle`: verifies built Mini App assets stay within production bundle budgets. Run `npm run build --prefix miniapp` first.
- `npm run scan:secrets`: scans tracked source files for high-confidence private key, token, and secret patterns.
- `npm run verify:release`: runs the full release gate chain.

## Environment Notes

- Use `NODE_ENV=production npm run check:production` before a production deploy so missing production variables fail the gate.
- Use `STAGING_STRICT=true npm run verify:staging` in CI once staging secrets and URLs are available.
- Do not print secret values in CI logs. Only report variable names and pass/fail status.

## Bundle Budgets

The Mini App bundle gate defaults to:

- JavaScript: 2,000,000 bytes raw.
- JavaScript gzip: 700,000 bytes.
- CSS: 400,000 bytes.
- Largest single asset: 900,000 bytes.

Override these only when a reviewed product change justifies the growth:

- `MINIAPP_BUNDLE_MAX_JS_BYTES`
- `MINIAPP_BUNDLE_MAX_JS_GZIP_BYTES`
- `MINIAPP_BUNDLE_MAX_CSS_BYTES`
- `MINIAPP_BUNDLE_MAX_ASSET_BYTES`

## Failure Handling

- Treat failed production readiness checks as release blockers unless the failed check is documented as intentionally out of scope for that deployment.
- Fix root causes instead of removing checks or weakening validation.
- If external credentials are unavailable, report the exact missing variable names and run the non-credentialed gates.

## Evidence Recorded by the Current Gate

The current release gate has verified the following repository-backed controls:

- API suite: 629 tests passing.
- Bot suite: 64 tests passing.
- Mini App provider contract tests and production build passing.
- Backup verification: checksummed SQLite copy, operation-marked evidence manifest, tamper rejection, and retention pruning.
- Production readiness: required ecosystem files, environment documentation, provider contracts, idempotency controls, tenant-isolation coverage, and recovery coverage.
- Staging readiness: environment-shape checks pass; live secret validation remains opt-in through `STAGING_STRICT=true` or `NODE_ENV=staging`.
- Bundle budgets: 2,000,000 raw JavaScript bytes, 700,000 gzip JavaScript bytes, 400,000 CSS bytes, and 900,000 bytes per asset.
- Secret scan: no high-confidence committed secret patterns detected.

The gate is evidence-based but does not replace deployment-specific checks. Operators must still validate live credentials, webhook delivery, queue health, reconciliation status, and provider readiness in the target environment.

## Financial Contract Evidence

The centralized points contract is:

- `1 Transferly Point = NGN1` for the configured economy.
- The default service charge is `250` points.
- A service-level point-price override takes precedence over the default.
- Legacy receipt generation is restricted to permanently marked sandbox services and must include all configured safety markings.

The implementation and regression coverage live in `api/services/pointPricingService.js`, `api/services/slipcraftReceiptService.js`, and `api/test/defaultServicePricing.test.js`. Release tests should provision enough points for the configured service charge rather than assuming a legacy fixed price.

## State and Recovery Evidence

Financial UI and API consumers must preserve explicit states instead of converting uncertainty into success:

- `UNKNOWN` and reconciliation states require investigation or refresh.
- Failed or cancelled states must not be presented as completed.
- Provider status is evidence for reconciliation, not the ledger source of truth.
- Retryable failures must retain idempotency and avoid duplicate balance mutations.
- Backup verification must pass before a release is promoted.
