# BizBox — Telegram Mini App

BizBox is a React/Vite personal business workspace. Version **2.0-cloud** stores a user's profile, onboarding progress and workspace in **Telegram CloudStorage**, scoped by Telegram to the current bot and user. No new hosted database, bot token or paid backend is needed for this version.

## Open

Production: https://biz-boxv3.vercel.app
Telegram: https://t.me/Biznowbox_bot?startapp

Outside Telegram the landing page offers an explicit, temporary demo with sample data. Email/password registration and fake password reset have been removed. A direct browser visit does not authenticate a Telegram user.

## Local development

Use Node **24** and npm:

```sh
npm ci
npm run dev
npm run check
```

`npm run check` runs TypeScript, storage regression tests, then the production build. Vercel uses the same command before publishing. No environment variables are required. The existing unused Supabase starter schema is not applied by this application.

## Persistence and navigation

1. Load the official Telegram WebApp SDK, call ready/expand and require CloudStorage support (Telegram 6.9+).
2. Read the manifest and its chunks before routing. An actual missing manifest means first use; transport errors or corrupt data show retry, never a new blank profile.
3. Autosave onboarding drafts and workspace mutations through one queue. A completion stays on the form until Telegram acknowledges the committed cloud snapshot. Retrying completion also applies the saved state to the UI.
4. On reopening, the completed cloud profile routes straight to the dashboard. localStorage is only an optional, user-scoped recovery copy; it is not the source of truth.
5. Existing browser data are offered for explicit import when there is no cloud profile. This is never automatic because the previous email login did not verify ownership.
6. UI shows saving/saved/error. On error the user can retry, export a JSON copy, or explicitly replace local edits with the cloud version. Close confirmation is enabled while data are pending.

The SDK's `initDataUnsafe` is used for a display name and a local cache key only. There is no application server trusting it as authentication. CloudStorage requests use Telegram's own bridge and per-user storage. Future server APIs must validate `initData` server-side (HMAC with the bot token or Telegram's documented Ed25519 signature), and enforce ownership.

## Storage format and limits

- Manifest: `bizbox_workspace_v2`.
- Immutable generation chunks: `bizbox_ws_<uuid>_<index>`.
- SHA-256, length and full state shape checks detect incomplete/corrupt loads.
- Each chunk is at most 3,500 UTF-16 code units (below Telegram's 4,096-character limit). A workspace supports up to 48 chunks, roughly 168,000 code units.
- All chunks must be acknowledged before publishing a new manifest. The previous generation is retained; older committed generations are cleaned up best effort.
- A failure or timeout does not report successful save. A manifest timeout can be ambiguous: reload the cloud version to reconcile before trying to overwrite it.
- Known revision conflicts are rejected. Telegram CloudStorage has no compare-and-swap/transactions, so simultaneous writes from two devices can still race; use one active editing window.
- This is a personal MVP, not a shared team database. Larger datasets, shared workspaces, authoritative billing/admin access and payment verification need a server-backed database with verified Telegram identity. Existing tariff/payment screens remain prototype features; the admin panel is available only in demo.

Official APIs:
- https://core.telegram.org/bots/webapps#cloudstorage
- https://core.telegram.org/bots/webapps#validating-data-for-third-party-use

## Release and operational checks

Keep the Mini App/menu URL in BotFather on one stable production alias: `https://biz-boxv3.vercel.app`. Deploy-specific preview URLs should not be used as the permanent bot URL.

Before release:
- `npm run check` must pass.
- Verify landing/demo rendering and no JavaScript errors.
- In a real Telegram session: create a workspace, finish onboarding, wait for **Сохранено в Telegram**, close and reopen; verify the dashboard and a saved operation.
- Reopen with local browser storage unavailable; the cloud profile must still load.
- Simulate load/save failure: show retry, keep prior data, and don't announce completion.

The automated suite uses an in-memory mock of the documented Telegram callback API. It covers reopen, draft steps, multiple chunks/emoji, errors, timeouts, invalid data, size bounds, revision conflicts, interrupted writes and generation cleanup. Passing mock tests is not evidence of a live Telegram session test.

Rollback: redeploy the prior Vercel version. CloudStorage keys are versioned and remain available; the old app will not understand them. Do not delete cloud keys or run a database reset to fix a loading problem.
