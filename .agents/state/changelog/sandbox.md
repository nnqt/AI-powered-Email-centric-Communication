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
  - `POST /api/sandbox/inject` (Load Selected Scenario)
  - `DELETE /api/sandbox/clear` (Clear All Sandbox Data)
  - Fake Webhook form to inject one inbound mock email via sandbox injector

### Changed

- Updated `ThreadList` UI to show `[MOCK]` badge for mock threads.
- Updated contacts list row UI to show `[MOCK]` badge for mock contacts.
- Extended frontend DTO types with `isMock?: boolean` in hooks:
  - `apps/frontend/src/hooks/useThreads.ts`
  - `apps/frontend/src/hooks/useContacts.ts`

### Safety Notes

- Dev sandbox page is enabled when `NODE_ENV === "development"` or `NEXT_PUBLIC_ENABLE_SANDBOX_UI=true`; otherwise redirects to home.

## 2026-03-17 — Sandbox Hardening & Docs Cleanup

### Changed

- Added backend environment guard for sandbox APIs:
  - `POST /api/sandbox/inject`
  - `DELETE /api/sandbox/clear`
  - `GET /api/sandbox/scenarios/*`
- Sandbox APIs now require either `NODE_ENV=development` or `ENABLE_SANDBOX_API=true`.
- Frontend sandbox page now loads scenarios from backend endpoints (`/api/sandbox/scenarios` + `/api/sandbox/scenarios/:slug`) instead of hardcoded payload.
- Added dev-only sidebar navigation entry for Sandbox page (`/dev/sandbox`).

## 2026-03-28 — Multi-Scenario & Vietnamese Dataset Update

### Added

- Added backend scenario registry at `apps/backend/src/lib/sandbox-scenarios.ts`.
- Added route `GET /api/sandbox/scenarios` to return scenario list for UI dropdown.
- Added route `GET /api/sandbox/scenarios/:slug` to return full scenario payload by slug.
- Added second scenario file: `apps/backend/src/lib/mock-data/scenario-payment-dispute.json`.

### Changed

- Migrated scenario payload text to Vietnamese for both built-in scenarios.
- Updated scenario metadata (`title`, `description`) in registry to Vietnamese.
- Updated Sandbox UI to support selecting and injecting multiple scenarios instead of one hardcoded scenario.

### Docs

- Added usage guide: `.agents/knowledge/sandbox-usage.md`.
- Standardized docs wording to use `changelog` consistently.

## 2026-03-28 — Scenario Realism, Summary Quality & Detail UX

### Changed

- Reworked both built-in scenarios into interrupted 4-email unresolved flows for Smart Reply testing realism.
- Upgraded scenario email writing style to full professional format (salutation/body/signature) in Vietnamese.
- Refined AI summarization prompt behavior to enforce:
  - concise 2-3 sentence summary
  - executable one-line actions
  - optional metadata suffix for UI chips (`Priority/Owner/Deadline`)
- Refactored summarization prompt construction from `core/llm_client.py` into dedicated module:
  - `apps/ai-service/core/prompts/summarization_prompt.py`

### Frontend UX

- Updated `AISummaryCard` action rendering to parse metadata chips and display readable action blocks.
- Replaced fragile checkbox character glyph with SVG icon for consistent display.
- Improved thread detail plain-text rendering to decode escaped `\\n` and keep `whitespace-pre-wrap` formatting.
