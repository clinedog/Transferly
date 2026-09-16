---
applyTo: "bot/**"
---

# Transferly bot ownership and workflow

- Keep Telegram command and callback entrypoints thin; route the side effects through services and repositories when it fits the existing package.
- Inspect callback handlers, command modules, state/context, and tests before making a behavior change.
- Treat Telegram updates and callback data as untrusted until verified by the existing middleware or command flow.
- Prefer the repository’s bot conventions and local analogs before introducing new command structures.
- Verify the most relevant bot test command before reporting success; widen guardrails if the change affects auth, state, callback payload shape, or provider/webhook behavior.

## Shared skill routing
- Bot command and callback handling → `intent-bot`
- API/provider adapters or payload contracts used by the bot → `intent-api`
- Security or auth checks → `intent-security`
- Testing and regression protection → `intent-test`
- Observability/logging → `intent-observability`
