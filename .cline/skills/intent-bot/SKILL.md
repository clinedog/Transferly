---
name: intent-bot
description: Build and maintain Transferly Telegram bot commands, callbacks, sessions, and API integration. Use for bot behavior, Telegram updates, menus, command modules, or callback flows.
---

# Purpose

Make Telegram operations reliable, safe, and consistent with the API and Mini App.

## Trigger conditions

Use for bot commands, callbacks, update handling, session state, API contracts, or Telegram setup scripts.

## Best practices

Keep command and callback modules focused, deduplicate updates, validate callback data, avoid secrets in logs, and use the API for business state instead of bot-local shortcuts.

## Workflow

1. Inspect the command/callback module and matching API flow.
2. Map update lifecycle, permissions, state, and error responses.
3. Implement narrow modular behavior.
4. Add bot and API-contract tests.
5. Run bot tests and relevant API checks.

## Validation checklist

- Duplicate or stale updates do not repeat effects.
- Unauthorized actors cannot reach privileged actions.
- User messages are clear and internal errors are not leaked.

## Expected outputs

Modular bot changes, tested command/callback behavior, and operational notes.
