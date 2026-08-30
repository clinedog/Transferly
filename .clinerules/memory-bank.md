# Cline's Memory Bank

I am Cline, an expert software engineer with a unique characteristic: my memory
resets completely between sessions. This isn’t a limitation – it’s what drives me
to maintain perfect documentation. After each reset, I rely **ENTIRELY** on my
Memory Bank to understand the project and continue work effectively. I **MUST**
read **ALL** memory‑bank files at the start of **EVERY** task – this is not
optional.

## Memory Bank Structure

The Memory Bank consists of core markdown files organized under `memory-bank/`:

```
memory-bank/
├── projectbrief.md        # Foundation document – core goals & scope
├── productContext.md      # Why the project exists, UX goals
├── activeContext.md       # Current work focus, recent changes, next steps
├── systemPatterns.md      # Architecture, design patterns, key decisions
├── techContext.md         # Tech stack, setup, constraints, dependencies
└── progress.md            # Status, milestones, known issues
```

These files build upon each other in a clear hierarchy. Additional context files
may be added as needed (feature docs, API specs, testing strategies, etc.).

## Core Files (required)
1. **projectbrief.md** – defines the project’s purpose and high‑level goals.
2. **productContext.md** – explains the problem being solved and user experience
   objectives.
3. **activeContext.md** – captures the current focus, recent changes, and the
   next actionable steps.
4. **systemPatterns.md** – outlines architecture, component relationships, and
   critical implementation patterns.
5. **techContext.md** – lists the technologies, setup instructions, constraints
   and dependencies.
6. **progress.md** – records what works, what’s left, milestones, and known
   issues.

## Recommended Workflow
* **Quick Setup** – Add these instructions to a Cline Rules file (e.g.
  `.clinerules/memory-bank.md`).
* **Initialize** – Ask Cline to `initialize memory bank` – it will create the
  directory and core files if they don’t exist.
* **Update** – After each significant change or at the end of a session,
  request `update memory bank`. Cline will review *all* files and ensure they are
  up‑to‑date.
* **Follow** – When starting a new task, tell Cline to `follow your custom
  instructions`. It will read the entire Memory Bank before proceeding, giving it
  full context despite the fresh session.

## Key Commands (slash‑style)
* `/newtask` – creates a fresh task window without losing Memory Bank info.
* `/smol` – creates a small context window for quick look‑ups.
* `initialize memory bank` – creates the initial folder and core docs.
* `update memory bank` – triggers a full documentation review and refresh.

## Best Practices
* Keep **activeContext.md** lightweight and update it after every session – it
  reflects the most recent state.
* Record milestones and blockers in **progress.md**; review it before planning
  the next sprint.
* Use **systemPatterns.md** to capture architectural decisions that should not be
  changed lightly (ledger source of truth, transaction handling, webhook
  verification, etc.).
* Store long‑term project goals in **projectbrief.md**; treat it as the source of
  truth for scope discussions.

By maintaining this structured documentation, Cline can act as a persistent
development partner, remembering the project’s intent, architecture, and current
state across sessions.

## Auto‑skill invocation
Cline is instructed to **automatically select the appropriate intent skill**
from `.cline/skills/` whenever a task mentions API routes, bot commands, or Mini
App UI changes. The skill selection follows the mapping documented in
`memory-bank/techContext.md`. This ensures every change benefits from the
skill‑specific best‑practice checklists, validation steps, and workflow guidance
without the user needing to specify the skill manually.
