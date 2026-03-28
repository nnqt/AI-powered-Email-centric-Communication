# Current State — March 28, 2026

## Status: All FRs Implemented ✅

| FR    | Feature                                          | Status                                       |
| ----- | ------------------------------------------------ | -------------------------------------------- |
| FR-01 | Email sync (Gmail)                               | ✅ Manual sync; webhook architecture-pending |
| FR-02 | Compose + send + attachments                     | ✅                                           |
| FR-03 | Read/unread/archive (two-way Gmail)              | ✅                                           |
| FR-04 | Inbox + Thread timeline + pagination             | ✅                                           |
| FR-05 | Real-time UI (Socket.IO)                         | ✅                                           |
| FR-06 | Contact management (enrich + merge + categories) | ✅                                           |
| FR-07 | Thread AI summarization (Vietnamese)             | ✅                                           |
| FR-08 | Smart reply suggestions                          | ✅                                           |
| FR-09 | Multi-channel Telegram (Phases 1–5)              | ✅                                           |
| FR-10 | Topic Intelligence (Phases 1–6)                  | ✅                                           |

## Recent Bug Fixes (March 28, 2026)

| Bug                                                       | Fix                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /api/telegram/chats` returned `[]` (no initial sync) | Added `syncDialogs(userId)` in `telegramManager.ts`; route triggers on empty DB                  |
| Chat messages empty when opening chat                     | Added `syncChatHistory(userId, chatId)`; `GET /api/telegram/chats/[chatId]` triggers on empty DB |
| Contact detail "Contact not found" — missing route        | Created `api/contacts/[id]/route.ts` with GET + PATCH handlers                                   |
| Frontend build failed at `ThreadList.tsx` with `Unexpected token {` | Removed misplaced JSX from `useThreads` destructuring and rendered `[MOCK]` badge inside thread row JSX |
| Sandbox menu missing on localhost in non-dev mode         | Replaced strict `NODE_ENV === "development"` gate with `NEXT_PUBLIC_ENABLE_SANDBOX_UI=true` or dev-mode gate in frontend layout/page |
| Sandbox controls unavailable in Docker local run          | Added `NEXT_PUBLIC_ENABLE_SANDBOX_UI=true` build arg for frontend and `ENABLE_SANDBOX_API=true` runtime env for backend in `infra/docker-compose.yml` |
| `ENOENT` loading sandbox scenario JSON in backend runtime | Switched scenario route to static JSON import (no runtime fs path dependency) and expanded angry-customer data to a long multi-message thread |
| Sandbox could only inject one hardcoded scenario          | Added scenario registry + list API (`GET /api/sandbox/scenarios`) + slug API (`GET /api/sandbox/scenarios/:slug`) and updated frontend Sandbox page with scenario dropdown |
| Scenario content/docs not localized                        | Translated built-in scenario datasets and metadata to Vietnamese; updated sandbox markdown docs for multi-scenario endpoints and new UI flow |
| Smart Reply test lacked interrupted unresolved context     | Reworked built-in scenarios into professional 4-email interrupted threads ending with unresolved customer request that requires immediate reply |
| Summary output too long and next action unclear            | Refined summarization prompt with strict 2-3 sentence summary, executable action format (priority/owner/deadline) and refactored prompt logic into `core/prompts/summarization_prompt.py` |
| Thread detail summary/actions hard to scan                 | Upgraded `AISummaryCard` action UI to parse metadata into chips (Priority/Owner/Deadline) and replaced fragile checkbox character with SVG icon |
| Mock email bodies showed literal `\\n` on detail page      | Added message body normalization and safe plain-text rendering (`whitespace-pre-wrap`) in thread detail page while preserving HTML rendering path |

## Active Tech Debt / Known Limitations

- Gmail webhook (Pub/Sub) not implemented — manual sync only
- Telegram `syncDialogs` fetches last 50 dialogs; no pagination
- `syncChatHistory` fetches last 50 messages; no infinite scroll yet

## Recent Updates (March 17, 2026 - Sandbox Phase 1)

- Added `isMock` field (default `false`) to models: Thread, Message, Contact, Topic, TelegramChat, TelegramMessage.
- Added guard in Gmail send flow: replying to mock thread now skips Google API and stores only local mock message.
- Added guard in Telegram send flow: mock chats/messages now skip MTProto send and store local mock message only.
- Added API `DELETE /api/sandbox/clear` to remove all mock data for current user across 6 collections.

## Recent Updates (March 17, 2026 - Sandbox Phase 2)

- Added sandbox payload type definitions in `apps/backend/src/types/sandbox.ts`.
- Added API `POST /api/sandbox/inject` at `apps/backend/src/app/api/sandbox/inject/route.ts`.
- Injector now validates session user id, inserts mock Contact -> Thread -> Message with `isMock: true`, and backdated message dates for sorting tests.
- Injector emits `EMAIL_SYNCED` to refresh frontend inbox and triggers `SUMMARY_READY` per injected thread after AI summarize call.
- Injector triggers Topic Intelligence pipeline (`cluster -> label -> score`) for injected mock threads.
- Added sample scenario file `apps/backend/src/lib/mock-data/scenario-angry-customer.json`.

## Recent Updates (March 17, 2026 - Sandbox Phase 3)

- Added dev-only dashboard page at `apps/frontend/src/app/(dashboard)/dev/sandbox/page.tsx`.
- Sandbox page includes:
  - "Load Selected Scenario" action (`POST /api/sandbox/inject`).
  - "Clear All Sandbox Data" button (`DELETE /api/sandbox/clear`).
  - "Fake Webhook" form to inject one inbound mock email instantly.
- Added loading states and Toast feedback for all sandbox actions via `apiClient` from `lib/api.ts`.
- Added `[MOCK]` badges in UI:
  - Thread rows in `features/inbox/ThreadList.tsx` when `thread.isMock === true`.
  - Contact rows in `app/(dashboard)/contacts/page.tsx` when `contact.isMock === true`.
- Extended frontend DTOs (`useThreads.ts`, `useContacts.ts`) with optional `isMock` field.

## Recent Updates (March 17, 2026 - Sandbox Hardening)

- Added production safety guard for sandbox APIs (`inject`, `clear`, `scenarios`) with env gate:
  - Allowed in development by default.
  - Allowed in non-development only when `ENABLE_SANDBOX_API=true`.
- Standardized scenario source: frontend now fetches scenario list and payload from backend APIs (`/api/sandbox/scenarios`, `/api/sandbox/scenarios/:slug`) instead of hardcoded JSON.
- Added dev-only sidebar navigation item for Sandbox dashboard.
- Added short usage documentation: `.agents/knowledge/sandbox-usage.md`.

## Recent Updates (March 28, 2026 - Sandbox Multi-Scenario & UX)

- Added registry-based sandbox scenario architecture with list endpoint (`GET /api/sandbox/scenarios`) and slug endpoint (`GET /api/sandbox/scenarios/:slug`).
- Added second built-in scenario (`payment-dispute`) and migrated scenario metadata/content to Vietnamese.
- Updated frontend sandbox page to load scenario options dynamically and inject selected slug payload.
- Reworked built-in scenarios into interrupted unresolved threads to improve Smart Reply evaluation quality.
- Refined summary prompt contract and moved prompt builder/normalizer into `apps/ai-service/core/prompts/summarization_prompt.py`.
- Improved thread detail UX:
  - `AISummaryCard` action metadata chips for Priority/Owner/Deadline.
  - Stable SVG checkbox icon rendering.
  - Plain-text message body normalization for escaped newline characters.

## Changelog Files (load only what you need)

| File                                                                 | When to load                               |
| -------------------------------------------------------------------- | ------------------------------------------ |
| [`changelog/telegram.md`](changelog/telegram.md)                     | Telegram auth, chat, messages, sync        |
| [`changelog/topic-intelligence.md`](changelog/topic-intelligence.md) | Topics, Focus page, clustering, scoring    |
| [`changelog/email-core.md`](changelog/email-core.md)                 | Email sync, compose, contacts, AI features |
| [`changelog/infra-fixes.md`](changelog/infra-fixes.md)               | Docker, build config, production fixes     |
