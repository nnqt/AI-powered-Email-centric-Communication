# Sandbox Changelog

## 2026-03-17 — Phase 1 (Database Update & API Guards)

### Added

- Added `isMock: { type: Boolean, default: false }` to schemas and interfaces:
  - `Thread`
  - `Message`
  - `Contact`
  - `Topic`
  - `TelegramChat`
  - `TelegramMessage`
- Added route: `DELETE /api/sandbox/clear` at `apps/backend/src/app/api/sandbox/clear/route.ts`.

### Changed

- Updated Gmail send flow (`modules/email/gmail.service.ts`):
  - If target thread is mock (`isMock: true`), skip Google API call.
  - Persist outbound mock message in MongoDB with `isMock: true` and update thread metadata.
- Updated Telegram send flow:
  - Added `sendTelegramMessage` helper in `lib/telegramManager.ts`.
  - If chat or existing chat messages are mock, skip MTProto send and persist outbound mock message with `isMock: true`.
  - Updated API route `app/api/telegram/send/route.ts` to use the new helper.

### Safety Notes

- Real-data behavior remains unchanged when `isMock: false`.
- Sandbox clear API requires authenticated session and user id before deletion.

## 2026-03-17 — Phase 2 (Sandbox Injector API & Logic)

### Added

- Added sandbox payload type definitions in `apps/backend/src/types/sandbox.ts`.
- Added route: `POST /api/sandbox/inject` at `apps/backend/src/app/api/sandbox/inject/route.ts`.
- Added sample mock scenario JSON at `apps/backend/src/lib/mock-data/scenario-angry-customer.json`.

### Changed

- Sandbox injector validates authenticated session and payload shape.
- Injector inserts mock Contact -> Thread -> Message with `isMock: true` and backdated timestamps (`Date.now() - offset`) for sorting workflow tests.
- Injector emits `EMAIL_SYNCED` event after insertion and `SUMMARY_READY` per summarized thread.
- Injector manually triggers AI summary and Topic Intelligence pipeline (`clusterThreadsIntoTopics` -> `labelUnlabeledTopics` -> `scoreAllTopicsForUser`) for injected threads.

### Safety Notes

- Injector avoids mutating real contact rows by generating a sandbox alias email when input email already exists as non-mock data.
- Mock message/thread IDs use `mock-*` prefixes to prevent collisions with real provider IDs.

## 2026-03-17 — Phase 3 (Developer UI Dashboard)

### Added

- Added dev sandbox page at `apps/frontend/src/app/(dashboard)/dev/sandbox/page.tsx`.
- Added action cards and controls for:
  - `POST /api/sandbox/inject` (Load Scenario: Angry Customer)
  - `DELETE /api/sandbox/clear` (Clear All Sandbox Data)
  - Fake Webhook form to inject one inbound mock email via sandbox injector

### Changed

- Updated `ThreadList` UI to show `[MOCK]` badge for mock threads.
- Updated contacts list row UI to show `[MOCK]` badge for mock contacts.
- Extended frontend DTO types with `isMock?: boolean` in hooks:
  - `apps/frontend/src/hooks/useThreads.ts`
  - `apps/frontend/src/hooks/useContacts.ts`

### Safety Notes

- Dev sandbox page is guarded by `NODE_ENV === "development"`; non-dev environments are redirected to home.

## 2026-03-17 — Sandbox Hardening & Docs Cleanup

### Changed

- Added backend environment guard for sandbox APIs:
  - `POST /api/sandbox/inject`
  - `DELETE /api/sandbox/clear`
  - `GET /api/sandbox/scenarios/angry-customer`
- Sandbox APIs now require either `NODE_ENV=development` or `ENABLE_SANDBOX_API=true`.
- Frontend sandbox page now loads angry-customer scenario from backend endpoint (`/api/sandbox/scenarios/angry-customer`) instead of hardcoded payload.
- Added dev-only sidebar navigation entry for Sandbox page (`/dev/sandbox`).

### Docs

- Added usage guide: `.agents/knowledge/sandbox-usage.md`.
- Standardized docs wording to use `changelog` consistently.
