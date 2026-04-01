# Sandbox Changelog

## 2026-04-01 — Temporal + High-Volume Noise Expansion

### Changed

- Expanded all scenario payloads in `apps/backend/src/lib/mock-data/*.json` to better stress real-world behavior:
  - added legacy threads/topics with old timestamps (`dateOffsetMs` in 90-190 day ranges),
  - added additional distinct business topics per contact (for topic separation quality checks),
  - added one high-volume noisy email thread per scenario (`24` messages) to test summarization/clustering robustness under signal noise.
- Re-applied read-state normalization:
  - threads containing outbound user reply are marked `isRead: true`.

### Validation

- `11/11` scenarios now contain legacy threads.
- `11/11` scenarios now contain at least one 20-30 message noisy thread.
- All mock JSON files parse successfully.

## 2026-04-01 — Test-Case Intent Alignment Pass

### Changed

- Re-validated all mock scenarios against actual system test goals (contact verify/merge, topic clustering, focus ranking, noise filtering, smart reply context).
- Fixed semantic drift in noise threads:
  - removed unnatural outbound replies from newsletter/promotion threads in:
    - `scenario-easy-one-customer-long-thread.json`
    - `scenario-easy-one-customer-multi-topic-noise.json`
    - `scenario-integration-multi-channel-noise-escalation.json`
  - kept these threads as informational-only noise signals.
- Added explicit scenario validation matrix to `.agents/knowledge/sandbox-usage.md` so each scenario maps to expected behavior/outcome.

## 2026-04-01 — Full Mock Dataset Enhancement Pass

### Changed

- Reviewed and refreshed all sandbox mock scenario payloads under `apps/backend/src/lib/mock-data/*.json`.
- Rewrote unnatural/ambiguous wording in email content, including replacing the confusing line:
  - "Nội dung này vẫn thuộc cùng bối cảnh làm việc với thầy Anh ở chuỗi trước."
  - with clearer business context continuity phrasing.
- Increased scenario density across all mocks:
  - added more contacts (customer personas),
  - added more threads per contact,
  - added more email messages per thread.
- Added read-state realism:
  - threads that already have outbound reply from authenticated user are now marked `isRead: true` in payload.

### Validation

- All modified mock JSON files parse successfully.
- Post-update aggregate density (per file) shows higher contacts/threads/messages compared to previous baseline.

## 2026-03-31 — Scenario Matrix Overhaul + Telegram Injection Support

### Changed

- Replaced legacy 2-scenario registry with progressive test matrix:
  - Easy (3 cases)
  - Medium (2 cases)
  - Hard (2 cases)
- Updated scenario titles/descriptions to be explicit about testing intent and complexity.
- Added new scenario payload files under `apps/backend/src/lib/mock-data/`:
  - `scenario-easy-one-customer-single-topic.json`
  - `scenario-easy-one-customer-multi-topic-noise.json`
  - `scenario-easy-one-customer-long-thread.json`
  - `scenario-medium-one-customer-multi-email.json`
  - `scenario-medium-multi-customer-multi-email.json`
  - `scenario-hard-multi-customer-email-telegram.json`
  - `scenario-hard-release-war-room.json`

### API / Contract

- Extended sandbox payload schema with optional Telegram branch on contact:
  - `contacts[].telegram.telegramId`
  - `contacts[].telegram.telegramUsername`
  - `contacts[].telegram.telegramName`
  - `contacts[].telegram.chats[]`
  - `contacts[].telegram.chats[].messages[]`
- Injector now persists Telegram mock entities (`TelegramChat`, `TelegramMessage`) with `isMock=true`.
- Added support for `{{USER_NAME}}` placeholder in scenario text templates, alongside existing `{{USER_EMAIL}}` support.

### Testing Intent

- Easy: one-customer baseline, then add unrelated/noise threads, then long formal email body.
- Medium: one customer with multiple sender emails, then multiple customers and mixed signal/noise.
- Hard: medium-like complexity plus Telegram escalation in parallel with email threads.

## 2026-03-28 — Topic Test Dataset Expansion (4 Threads / 2 Scenarios)

### Changed

- Updated built-in scenario payloads to support multi-thread same-topic testing:
  - `angry-customer` now contains 2 related logistics threads for one contact (`alex.customer@example.com`).
  - `payment-dispute` now contains 2 related billing threads for one contact (`Maria Tran`) using 2 sender emails.
- Each thread now has 2-3 messages and ends with an inbound unresolved customer email so Smart Reply and Summary can be tested on latest pending response.

### Testing Intent

- Validate topic clustering groups related threads under the same topic.
- Validate summary timeline and smart-reply context selection on unresolved latest inbound messages.

## 2026-03-28 — PO Communication Rewrite For Sandbox Scenarios

### Changed

- Rewrote both built-in scenario contents from support/billing incident style to Product Owner communication style.
- New thread topics now center around:
  - CRM UAT timeline and scope baseline alignment.
  - Change request (`CR-17`) effort/cost estimation and phase approval.
- Kept technical test contract unchanged:
  - 2 scenarios, total 4 threads.
  - Each thread has 2-3 emails.
  - Latest email remains inbound unresolved for Smart Reply and Summary testing.
  - Scenario B still uses two sender emails for one contact identity.

## 2026-03-28 — Authenticated Mailbox Alignment In Scenarios

### Changed

- Added support for `{{USER_EMAIL}}` placeholder in sandbox injector message normalization.
- Updated built-in scenario payloads so:
  - outbound mock messages use `from: "{{USER_EMAIL}}"`
  - inbound mock messages target `to: ["{{USER_EMAIL}}"]`
- This ensures sent/received mock emails align with the currently authenticated user mailbox during injection.

## 2026-03-28 — FR Topic Scenario Naming + Scenario 02 Distribution Update

### Changed

- Renamed topic-testing scenarios to explicit FR labels:
  - `FR-Topic-Scenario-01`
  - `FR-Topic-Scenario-02`
- Updated `FR-Topic-Scenario-02` dataset to follow test intent exactly:
  - total 3 threads, same topic `CR-17`
  - thread 1,2 from email 1 (`ha.nguyen.client@example.com`)
  - thread 3 from email 2 (`ha.finance.client@example.com`)
  - all messages still target authenticated mailbox via `{{USER_EMAIL}}` placeholder.

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
- Added sample mock scenario JSON at `apps/backend/src/lib/mock-data/scenario-fr-topic-01.json`.

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
- Added second scenario file: `apps/backend/src/lib/mock-data/scenario-fr-topic-02.json`.

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
