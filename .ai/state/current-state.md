# Current State Snapshot (March 31, 2026)

This file is intentionally concise.
Detailed history belongs in `state/changelog/*`.

## System Status

All FR-01..FR-10 features are implemented.
Primary operating focus is quality, consistency, and architecture hygiene.

## Active Architecture (Source of Truth)

1. Backend AI adapter is single-path only:
  - `apps/backend/src/modules/ai/ai.service.ts`
2. Topic pipeline uses unified analysis + consolidation flow:
  - `POST /analyze-thread`
  - `POST /label-topic` (`mode="consolidate"` + `topic_name_overrides`)
3. Focus API is split by concern:
  - list: `GET /api/focus`
  - overview counters: `GET /api/focus/overview`
  - explicit recompute: `POST /api/focus/recompute`
4. Runtime observability endpoint:
  - `GET /api/metrics/overview`
5. Contacts verify workflow is consolidated at:
  - `/contacts/verify`

## Latest Delta (March 31, 2026)

1. Removed deprecated parallel backend AI layer:
  - deleted `apps/backend/src/app/api/ai/summarize/route.ts`
  - deleted `apps/backend/src/services/ai.service.ts`
  - deleted `apps/backend/src/services/cache.service.ts`
  - deleted `apps/backend/src/types/ai.types.ts`
2. Cleaned leftover frontend dead code from contacts directory page.
3. Synced .agents docs/contracts/patterns to current runtime shape.
4. Inbox sync UX and topic/focus reliability updates:
  - inbox page no longer emits duplicate sync success toasts.
  - contacts timeline route maps `threadId` from `Thread.id` (fix `/api/threads/undefined` navigation).
  - focus page defaults to High tab and supports tab navigation to Medium.
  - sync pipeline upserts contacts before topic clustering to reduce freshly-synced threads without topics.
5. Sandbox test matrix and inject contract refresh:
  - scenario registry expanded to Easy/Medium/Hard progression.
  - sandbox injector supports optional Telegram mock injection.
  - sandbox templates now resolve both `{{USER_EMAIL}}` and `{{USER_NAME}}`.
6. Verify Hub merge queue consistency hardening (April 1, 2026):
  - staged duplicate merges now preserve queue-time source/target at save.
  - verified-anchor suggestions are no longer force-reoriented to selected contact.
7. Sandbox mock dataset enhancement (April 1, 2026):
  - all mock scenario payloads were reviewed and expanded (more contacts/threads/messages).
  - unnatural phrasing in scenario email bodies was cleaned for natural business tone.
  - replied threads in mock payloads are now marked `isRead: true` for realistic queue behavior.
8. Sandbox temporal/noise stress expansion (April 1, 2026):
  - every scenario now includes legacy old threads/topics and one high-volume noisy thread (24 emails) to stress topic separation and summarization quality.

## What To Validate On New Changes

1. Do not re-introduce parallel AI adapter path.
2. Keep API contracts in sync whenever payloads change.
3. Revalidate Focus sidebar badge behavior after topic/focus changes.
4. Revalidate sandbox flows after topic or summarize pipeline edits.

## Fast Navigation

1. Current API contracts:
  - `.agents/knowledge/api-contracts-backend.md`
  - `.agents/knowledge/api-contracts-ai-service.md`
2. Reusable implementation patterns:
  - `.agents/skills/feature-patterns.md`
  - `.agents/skills/patterns/topic-focus-optimization.md`
3. Historical domain changes:
  - `.agents/state/changelog/email-core.md`
  - `.agents/state/changelog/topic-intelligence.md`
  - `.agents/state/changelog/telegram.md`
  - `.agents/state/changelog/sandbox.md`
