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
