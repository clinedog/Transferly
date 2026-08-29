# Cline Context and Checkpoint Policy

This repository uses Cline checkpoints and automatic context compaction as safety controls for long-running work.

## Client settings

- Keep **Enable Checkpoints** on. Cline checkpoints are a client feature and are enabled in Cline Settings → Feature Settings; they are not configured by a repository file.
- Keep automatic context compaction enabled when the installed Cline client exposes that setting. Do not invent workspace settings to simulate it.
- Keep YOLO mode off. Auto-approve read-only project operations only; require review for dependency changes, destructive commands, external systems, and edits outside the workspace.

## Compact recovery protocol

Before or immediately after context compaction, preserve a five-line recovery note containing:

1. Current goal.
2. Current package and files being changed.
3. Security/financial decisions that must not change.
4. Validation already completed.
5. Remaining TODOs and blockers.

After compaction, read the current Git diff and this recovery note before editing. Never repeat a broad audit when the active task and diff already establish scope.

## Checkpoint cadence

- Prefer one small checkpoint-worthy step per subsystem: schema/API, service/persistence, UI, then tests.
- For payment, funding, ledger, webhook, auth, migrations, or provider changes, validate the smallest affected test after each step.
- Do not use checkpoints as a substitute for Git review, package tests, or financial idempotency.