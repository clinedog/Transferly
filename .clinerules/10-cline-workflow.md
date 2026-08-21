# Transferly Cline Workflow & Safety Rules

## 1. Plan vs Act modes

- **Always start in Plan** for any task that is non‑trivial (multi‑file, refactor, financial logic, auth, or provider flows).
- **Plan mode responsibilities**:
  - Inspect code and docs (`read_files`, `search_codebase`), map routes/services/repos/tests.
  - Identify ownership, dependencies, and risks.
  - Propose a concrete, stepwise implementation plan.
  - Avoid state‑changing tools: no `apply_patch` and no mutating shell commands.
- **Act mode responsibilities**:
  - Implement the approved plan in **small, reviewable steps**.
  - Use `apply_patch` for edits and keep diffs narrowly scoped.
  - Use `run_commands` only for repo‑local inspection, builds, and tests.
  - After each meaningful step, re‑validate (lint/tests) and update the plan if reality differs.
- When the client supports per‑mode model selection, use a **stronger reasoning model** for Plan and a **faster implementation model** for Act.
- Do not skip Plan for large refactors, architectural changes, payment/ledger/webhook logic, or other high‑risk work.

For small, single‑file changes, Plan can be brief but must still exist as an explicit section in the response.

## 2. Context retention and checkpoints

- Assume **Auto Compact** is enabled for this repo; when context is compacted, restate:
  - current goal,
  - key design decisions,
  - active TODOs.
- Treat **checkpoints** as mandatory for risky changes (refactors, migrations, payment/ledger/webhook logic, multi‑step implementations, experimental changes, debugging regressions); keep edits incremental so checkpoints remain fast and useful.
- Do not disable checkpoints or Auto Compact for this repo unless the repository size makes them unreasonably slow and the user explicitly requests that trade‑off.
## 3. Hooks (conceptual behavior)

These are behavioral guardrails for Cline; actual hook wiring happens in the client.

- **TaskStart**
  - Read `.clinerules/00-transferly.md` and `AGENTS.md`.
  - Determine which package(s) (`api`, `bot`, `miniapp`) are in scope.
  - Enter Plan mode and outline an approach before editing.

- **PreToolUse**
  - For `run_commands`, block or reject commands that are clearly destructive (see command policy below).
  - For `apply_patch`, ensure the patch:
    - only touches files relevant to the current task, and
    - does not perform mass reformatting unrelated to the change.
  - For high‑impact tools, confirm they correspond to the current Plan step and are the smallest safe operation needed.

- **PostToolUse**
  - After significant `run_commands` or `apply_patch` calls, briefly restate what changed or what the output means.
  - If a command fails, capture the key error lines, avoid blind retries, and adjust the plan and next actions.

- **PreCompact**
  - Emit a short session summary and list of remaining subtasks so future turns can recover quickly after compaction.

- **TaskComplete**
  - Summarize:
    - files changed,
    - commands/tests run,
    - important design or security decisions,
    - remaining risks or follow‑ups.

## 4. Command safety policy

**Allowed categories (without extra approval):**

- Local inspection: `ls`, `pwd`, `cat`, `sed -n`, `find` limited to the repo.
- Git read‑only: `git status`, `git diff`, `git log -n`, `git ls-files`.
- Node/JS inspection: `node -c file.js`, `node -r ./test/setup-test-env.js --test ...`.
- Package scripts already defined in this repo, especially:
  - `npm run lint --prefix api|bot|miniapp`,
  - `npm test --prefix api|bot`,
  - `npm run build --prefix miniapp`,
  - `npm run test:e2e* --prefix miniapp`.
- Project utilities in `scripts/` that are clearly read‑only or validation‑oriented.

**Require explicit justification before running:**

- Any `npm install` / dependency changes.
- Long‑running scripts or ad‑hoc Node programs that touch the database.

**Disallowed / must not be proposed by default:**

- Destructive shell patterns, e.g. `rm -rf`, `chmod -R`, `chown`, `truncate`, or editing files outside the repo.
- `sudo` or privileged commands.
- Networked download‑and‑execute chains such as `curl ... | sh` or `wget ... | bash`.
- Any command that would modify system‑level configuration outside `/workspaces/Transferly`.

## 5. Implementation discipline

- **Inspect before editing**: always locate the owning routes, controllers, services, repositories, schemas, jobs, and tests before changing behavior.
- **Prefer additive, incremental changes** over wide rewrites.
- **Do not duplicate business logic**: reuse existing services/helpers (especially for ledger, funding, PayPal, and points) instead of creating parallel implementations.
- **Preserve existing contracts** unless a bug or requirement forces a change; call out any externally visible API change explicitly.
- **Validate after each major step** using the smallest relevant checks first (package‑level lint/tests/builds as outlined in `00-transferly.md`).

## 6. Security and financial safety

- Never trust client‑supplied state (including Mini App and bot) for:
  - authn/authz,
  - balances,
  - funding state,
  - provider status.
- Treat payment, ledger, webhook, points, and funding flows as **security‑sensitive**:
  - maintain idempotency,
  - avoid race conditions and double‑processing,
  - never log secrets or raw provider payloads.
- Any change that touches points, payments, payouts, invoices, webhooks, or admin finance must:
  - be implemented inside existing architecture layers (routes → controllers → services → repositories → jobs/adapters), and
  - be covered by or extended with tests in the owning package.
## 7. Auto‑approval posture

- It is safe to auto‑approve in this repo for:
  - reading files,
  - searching the codebase,
  - running clearly non‑destructive validation commands as per the allow‑list above.
- Do **not** assume blanket approval for:
  - edits that span many files or entire packages,
  - commands that modify dependencies or databases.
- YOLO / fully‑unrestricted modes are **not** appropriate for Transferly; keep safety checks active.
- When the client exposes per‑tool auto‑approval settings, configure them so that:
  - read‑only tools (`read_files`, `search_codebase`, `fetch_web_content`) may be auto‑approved,
  - editing tools (`apply_patch`) and shell commands (`run_commands`) are only auto‑approved within Act mode and when clearly low‑risk and task‑scoped,
  - browser and MCP/server integrations start disabled and are only enabled when explicitly needed for a task.
- Prefer notifications (where available) for long‑running validation commands rather than broad auto‑approval of arbitrary commands.

## 8. Subagents for discovery

- Use subagents (for example via `spawn_agent` or the `team_*` tools) for parallel, **read‑only** discovery on complex, cross‑cutting tasks.
- Typical subagent scopes include:
  - architecture entry points and package boundaries,
  - data and control flow for a feature,
  - API routes, authentication, and authorization layers,
  - tests, migrations, and build/CI configuration,
  - provider integrations and external workflows,
  - UI architecture and backend service orchestration.
- Subagents **must not** perform edits or run mutating shell commands:
  - they may use `read_files`, `search_codebase`, `fetch_web_content`, and similar read‑only tools,
  - all edits (`apply_patch`) and mutating commands (`run_commands`) happen in the main agent in Act mode.
- Use subagents to keep the main context focused on the active implementation plan and to speed up initial discovery.

## 9. Performance, efficiency, and validation

- **Context efficiency**
  - For large tasks, summarize findings and the intended design before editing.
  - Avoid re‑reading the same files unnecessarily; reuse existing context when possible.
  - Keep the main conversation focused on the current implementation step and key decisions.
- **Execution efficiency**
  - Change only the minimum set of files required for the current step.
  - Prefer small, atomic edits and avoid unrelated formatting or structural churn.
  - Preserve working code and avoid speculative large rewrites unless explicitly requested.
- **Validation efficiency**
  - After changes, run the smallest relevant lint/test/build command first.
  - Expand validation only when needed (for example, after shared‑module or cross‑package changes).
  - Do not fire off many large commands blindly; investigate failures and isolate them quickly.

## 10. Implementation and reporting discipline

- For every substantial task:
  1. Inspect the relevant parts of the codebase first.
  2. Identify the smallest file set required for the next step.
  3. Explain the implementation plan briefly before editing.
  4. Make incremental edits in Act mode.
  5. Validate after each important step using the smallest relevant checks.
  6. Summarize what changed and why.
  7. Call out unresolved risks, open questions, or follow‑ups.
- For refactors:
  - Preserve behavior unless explicitly asked to change it.
  - Keep old interfaces working when feasible to avoid breaking consumers.
  - Avoid creating duplicate logic paths; consolidate on existing helpers and patterns.
  - Update or add tests alongside code when behavior or contracts move.
- For security‑sensitive or financial code:
  - Treat idempotency, race conditions, and double‑processing as explicit design concerns.
  - Never trust client‑side or external‑provider state for balances or authorization.
  - Avoid secret leakage in logs, errors, and test fixtures.
- For code tasks, final responses should include:
  - a brief summary of the change,
  - the files touched,
  - tests/commands run (or why they could not be run),
  - remaining limitations or risks.
- YOLO / fully‑unrestricted modes are **not** appropriate for Transferly; keep safety checks active.

## 11. Response formatting and output behavior

- Start responses with a short "Plan" section for any non‑trivial task. Keep plans concrete and scoped to the next safe step.
- List all tool calls you intend to run for the next step before executing them. Batch independent reads/searches/commands.
- Use bullet lists; avoid heavy formatting. Provide absolute file paths in references and diffs.
- Provide short progress updates after meaningful milestones (e.g., after an edit or a validation run).
- Always include a concise final summary containing:
  - what changed and why,
  - files touched,
  - commands/tests run and their outcomes (or why they could not be run),
  - any remaining risks, limitations, or follow‑ups.
- For code edits, keep diffs minimal and avoid unrelated churn.
- If context compacts mid‑task, restate current goal, key decisions, and remaining TODOs before continuing.
