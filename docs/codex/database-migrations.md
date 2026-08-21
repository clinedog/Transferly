# Database Migration Operations

Transferly uses additive CommonJS migrations in `api/db/migrations/`. Each migration is applied once inside the same SQLite `BEGIN IMMEDIATE` transaction as compatibility schema updates, catalogue seeding, and required-table verification.

## Creating A Migration

1. Add `api/db/migrations/YYYYMMDDNNNN_snake_case_name.js` using a unique, increasing 12-digit identifier.
2. Export matching `id`, `name`, and `async up(client)` values.
3. Keep the migration additive and preserve existing rows. Use a deliberate, separately reviewed table rebuild when SQLite cannot express a compatible alteration.
4. Add clean-schema and representative legacy-schema tests.
5. Run migration status, migration tests, API lint, and the full API suite.

Never rename, delete, reorder, or edit an applied migration. The runner stores a SHA-256 checksum and fails closed when local definitions diverge from database history. Correct deployed behavior with a new migration.

## Deployment Workflow

1. Stop or drain API and worker processes that can write to SQLite.
2. Record the deployed application revision and database path.
3. Checkpoint WAL data and create a protected backup of the database and any required `-wal` or `-shm` state using an approved SQLite backup procedure.
4. Run `npm run db:migrate:status --prefix api` and investigate checksum or history errors before proceeding.
5. Run `npm run db:migrate --prefix api` from one deployment instance. `BEGIN IMMEDIATE` serializes competing writers; do not use concurrent migration processes as an orchestration strategy.
6. Run `npm run db:migrate:status --prefix api` again and verify every expected migration is `applied`.
7. Start the matching application revision, then run health and staging smoke checks before restoring normal traffic.

Do not run `db:seed` as a substitute for migration. The default service catalogue seed used by migration is idempotent and part of the migration transaction.

## Failure And Rollback

- A failure before transaction commit rolls back schema changes, data updates, catalogue changes, and migration ledger records together. Fix the cause and rerun.
- There are no automatic `down` migrations because reverse data transformations can destroy production data.
- Prefer a forward corrective migration after a committed migration when data is still valid.
- If restoration is required, stop all writers and restore the protected database backup together with the exact compatible application revision. Verify integrity and migration status before reopening traffic.
- Never delete rows from `schema_migrations` to force a rerun.

## Verification Commands

```bash
npm run db:migrate:status --prefix api
npm run db:migrate --prefix api
npm run lint --prefix api
node --test --test-concurrency=1 api/test/dbMigration*.test.js api/test/migrationRunner.test.js
npm test --prefix api
```

Production rollout still requires strict environment validation, a recent restorable backup, maintenance-window ownership, and post-deployment smoke evidence.
