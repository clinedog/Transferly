# Transferly Mini App Real-Device QA Checklist

Use this checklist before production Mini App releases and after changes to shell layout, Telegram runtime handling, authentication, provider workspaces, or forms.

## Devices And Clients

- Telegram iOS compact launch at 320px, 360px, 390px, and 430px widths.
- Telegram iOS expanded mode and fullscreen mode when supported by the client version.
- Telegram Android compact launch, expanded mode, and fullscreen mode when supported.
- Telegram Desktop and Telegram Web fallback.
- Mobile browser fallback outside Telegram.
- Portrait orientation.
- Landscape orientation where the Telegram client supports it.

## Launch And Session

- Bot launch button opens the production Mini App URL.
- Direct `/miniapp` launch shows one clear loading state before authentication settles.
- Valid Telegram `initData` creates a secured session and does not fall into Guest Mode.
- Missing Telegram runtime outside Telegram shows Guest preview mode explicitly.
- `/api/me` succeeds after authenticated bootstrap.
- Expired, invalid, or missing sessions show one root error state and a retry path.
- No raw `initData`, bearer token, bot token, provider secret, or cookie value appears in console logs.

## Viewport And Safe Areas

- Header respects top safe area, Dynamic Island, status bar, and Telegram content safe area.
- Bottom navigation remains visible while scrolling and respects home indicator safe area.
- Content bottom padding prevents the bottom navigation from covering actions or form fields.
- Compact mode avoids oversized cards and keeps primary actions reachable.
- Expanded mode uses stable viewport height without large blank gaps.
- Fullscreen mode uses available height without horizontal overflow or native-control overlap.
- Opening and closing the keyboard does not hide focused fields or submit actions.

## Navigation And Interaction

- Bottom navigation active state is correct on all primary routes.
- Native Telegram BackButton and custom fallback back behavior do not conflict.
- SettingsButton opens Mini App settings.
- Command search opens as a bottom sheet, filters actions, and navigates to the selected route.
- Haptic feedback is restrained and disabled when the user setting disables it.
- Reduced-motion mode avoids unnecessary animations.

## Provider Workspaces

- Provider tabs scroll horizontally on narrow screens and preserve the active lane.
- Unsupported provider lanes show clear unsupported copy and no fake success state.
- Provider failures do not break global authentication or the shell.
- Sandbox/test data is visibly labeled and never presented as live payment proof.
- Provider tables and activity lists remain readable on 320px and 360px widths.

## Visual And Accessibility

- Light and dark themes have readable contrast for primary, muted, success, warning, and error text.
- Touch targets are at least 44px tall for key controls.
- Focus-visible styles are visible on desktop and web clients.
- Status is not communicated by color alone.
- Empty, offline, forbidden, rate-limited, unavailable, success, and loading states are distinct.
- No horizontal overflow appears on primary routes or provider workspaces.

## Evidence To Capture

- Screenshots for compact, expanded, and fullscreen home dashboard.
- Screenshots for one provider overview at 360px and 430px.
- Screenshots for command search, settings, and one form with keyboard open.
- Console log export showing no uncaught errors or secret values.
- Network failure notes for any failed API/provider request, including request ID only.
