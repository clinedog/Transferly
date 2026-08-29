# Cline settings for Transferly

Transferly commits project guidance through `.clinerules/`, `AGENTS.md`, and `.cline/skills/`. Personal/client permissions remain in Cline Settings and are intentionally not represented by unsupported VS Code workspace keys.

## Recommended client settings

In Cline Settings:

1. Keep **Enable Checkpoints** enabled. Checkpoints use Cline's shadow repository and do not alter Transferly's Git history.
2. Keep automatic context compaction enabled when available in the installed Cline version. Follow `.clinerules/05-context-checkpoints.md` whenever compaction occurs.
3. Auto-approve **Read project files**.
4. Optionally auto-approve safe, read-only commands and existing validation scripts.
5. Keep **Read all files**, **Edit all files**, **Execute all commands**, MCP, browser automation, and YOLO mode disabled by default.
6. Enable browser automation only for an active QA task and never persist credentials, cookies, Telegram init data, or private evidence.

## Repository guidance

- Workspace rules: `.clinerules/*.md`. Cline combines them; conditional YAML `paths` frontmatter activates package-specific rules.
- Shared skills: `.cline/skills/<skill>/SKILL.md`.
- Canonical cross-agent policy: `AGENTS.md`.
- Checkpoint, Auto Approve, and compacting toggles are client settings. Do not add guessed `cline.*` keys to `.vscode/settings.json`.

Official references:

- https://docs.cline.bot/features/cline-rules
- https://docs.cline.bot/features/checkpoints
- https://docs.cline.bot/features/auto-approve
- https://docs.cline.bot/llms.txt