# Transferly Bot UX Contract

The Telegram bot is a focused entry point for Transferly. It should not duplicate the Telegram Mini App dashboard or expose dense mini app-like workflows in chat.

## Responsibilities

- Welcome users and explain how to start.
- Provide one primary launcher for the Telegram Mini App home/dashboard.
- Keep navigation simple: Account, Notifications, Settings, and Help.
- Recover safely from expired or stale inline buttons with fresh navigation.
- Route full dashboard, services, payments, wallet, settings, and advanced workflows to the Mini App.
- Keep points funding lightweight in chat: the bot may notify users and link to the Mini App, but bank-transfer evidence submission and admin approval stay in authenticated Mini App/API surfaces.

## Visible Commands

- `/start` — onboarding and launcher.
- `/app` — primary Mini App launcher.
- `/account` — concise Telegram/account access status.
- `/notifications` — notification preferences and delivery guidance.
- `/settings` — bot and Mini App settings handoff.
- `/help` — usage guidance.

## Button Rules

- Use one primary Mini App button: `🚀 Open Transferly`.
- Keep the default control menu to: `🚀 Open Transferly`, `👤 Account`, `🔔 Notifications`, `⚙️ Settings`, and `❓ Help`.
- Point the primary launcher to the exact deployed Mini App URL: `https://transferly-nine.vercel.app`.
- Avoid adding scattered dashboard, wallet, invoice, payout, settings, or service shortcut buttons to primary bot menus.
- Keep role-specific operational actions behind explicit admin/user command paths rather than the default onboarding menu.
- Delegate legacy service, provider, invoice, payout, audit, analytics, and alert callbacks to the Mini App handoff screen.
- Keep bot-owned actions limited to onboarding, App launch, Account, Notifications, Settings, Help, and explicit support recovery.

## Runtime Behavior

- `/health` and `/healthz` report bot liveness for infrastructure probes.
- `/readyz` verifies the Transferly API health endpoint and returns `503` when the API is unreachable.
- `/runtimez` reports safe runtime metadata: update mode, Mini App host/path, menu-button state, API readiness, and webhook/update dedupe settings.
- Production webhook mode requires HTTPS `BOT_WEBHOOK_URL` and a `BOT_WEBHOOK_SECRET`.
- Production validates the bot token shape, requires a 32+ character webhook secret, and can restrict `MINI_APP_URL` with `BOT_ALLOWED_MINI_APP_HOSTS`.
- Webhook setup limits Telegram updates to `BOT_ALLOWED_UPDATES` and respects `BOT_DROP_PENDING_UPDATES`.
- `BOT_CONFIGURE_MENU_BUTTON=true` configures Telegram's persistent menu button to open the Mini App dashboard.
- Telegram updates are deduplicated in memory with `BOT_UPDATE_DEDUPE_TTL_MS` and `BOT_UPDATE_DEDUPE_MAX_ENTRIES` to avoid repeated callback processing during retries.
- Subscription alert sweeps are opt-in with `BOT_RUN_SUBSCRIPTION_ALERT_SWEEP=true` so the bot does not run hidden advanced workflows by default.

## Mini App Launch Configuration

- `MINI_APP_URL` is the bot runtime source of truth for launch buttons and must match the production Mini App URL configured with BotFather.
- Production launch URL: `https://transferly-nine.vercel.app`.
- Bot-owned launch surfaces are `/start` and the persistent menu button when `BOT_CONFIGURE_MENU_BUTTON=true`.
- BotFather owns the bot profile, menu button URL, Mini App URL/domain setup, and public start-link behavior. Keep those values aligned with `MINI_APP_URL` and `BOT_ALLOWED_MINI_APP_HOSTS`.
- Mini App runtime code owns `ready()`, `expand()`, viewport CSS variables, safe-area handling, theme updates, and fullscreen API calls.
- Fullscreen uses the Telegram Web App API on clients that support it. Older clients must keep working in expanded or browser fallback mode.
- Direct links and start parameters should route into the Mini App without adding duplicate bot dashboard flows.
- Orientation, viewport height, safe-area, and fullscreen state are client/runtime behavior; do not document unsupported BotFather options as deployment requirements.

## Error And Recovery Behavior

- Do not expose raw API payloads, tokens, signatures, Mini App init data, or provider payloads in logs.
- Classify API/auth/network failures into safe user-facing messages.
- Include Open Transferly, Account, Notifications, Settings, and Help recovery buttons on command failures.
- Send expired callback users to the clean command hub instead of rebuilding dense stale submenus.
- Store oversized callback actions as short signed session references so inline buttons stay within Telegram limits.

## Smoke Checks

Run the focused bot test suite after menu, callback, launcher, or command changes:

```sh
npm test --prefix bot
```

Preview the live Telegram smoke payload without sending a message:

```sh
npm run smoke:telegram --prefix bot -- --dry-run
```

Run the live Telegram smoke only with a real `BOT_TOKEN`, `SMOKE_CHAT_ID` or `ADMIN_TELEGRAM_ID`, and `MINI_APP_URL`. The smoke message should contain one primary `🚀 Open Transferly` Mini App button plus Account, Notifications, Settings, and Help controls.

## Deployment Checklist

- Set `/health`, `/readyz`, and `/runtimez` probes in the hosting platform.
- Use webhook mode in production with HTTPS `BOT_WEBHOOK_URL` and a long random `BOT_WEBHOOK_SECRET`.
- Keep `BOT_ALLOWED_UPDATES=message,callback_query` unless a new bot-owned Telegram update type is intentionally added.
- Set `BOT_ALLOWED_MINI_APP_HOSTS` to the production Mini App host.
- Confirm Telegram's persistent menu button opens `https://transferly-nine.vercel.app` via `BOT_CONFIGURE_MENU_BUTTON=true`.
