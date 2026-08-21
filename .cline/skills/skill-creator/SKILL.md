---
name: skill-creator
description: Create new Cline skills from templates, scaffold skill directories with SKILL.md frontmatter, and manage skill registration in the project .cline/skills/ directory.

---

# Skill Creator

Create new Cline skills with proper frontmatter, directory structure, and best practices.

## When to use
- You need a new skill for a recurring task
- You want to bundle instructions for a specific domain (e.g., payment, webhook, ledger)
- You're setting up a new project and need baseline skills

## How to use
Run: `codex --skill create <skill-name>`

Or invoke from chat: `/skill-creator create my-new-skill`

## Steps
1. **Initialize** - Creates `my-new-skill/` with `SKILL.md`, optional `docs/`, and `scripts/`
2. **Template** - Uses a predefined SKILL.md frontmatter with name, description, and usage guidelines
3. **Register** - Adds the skill to the project's `.cline/skills/` index (if applicable)
4. **Verify** - Checks the new skill loads correctly in the next Cline session

## Generated Structure
```
my-new-skill/
├── SKILL.md          # Required: name, description, instructions
├── docs/             # Optional: advanced guides
│   └── advanced.md
└── scripts/          # Optional: utility scripts
    └── helper.sh
```

## SKILL.md Template
```markdown
---
name: my-new-skill
description: Brief description of what this skill does and when to use it.
---

# My New Skill

When this skill is active, follow these guidelines:
- Step 1: Do this
- Step 2: Then do that
- For advanced usage, see [advanced.md](docs/advanced.md)
```