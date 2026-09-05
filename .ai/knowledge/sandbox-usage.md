# Sandbox Usage Guide

## Purpose

Sandbox mode helps developers inject mock inbox/contact data safely for UI and AI workflow testing without calling external provider APIs when data is marked as `isMock`.

## Prerequisites

- Backend and frontend are running.
- Authenticated user session is available.
- Environment must be development, or `ENABLE_SANDBOX_API=true` must be set for backend sandbox APIs.

## Developer Dashboard

- Open `/dev/sandbox`.
- Use scenario dropdown to select one scenario and click **Load Selected Scenario**.
- Use **Submit Fake Webhook** to inject one custom inbound email.
- Use **Clear All Sandbox Data** to remove all current user's mock data.

## API Endpoints

- `GET /api/sandbox/scenarios`:
  - Returns list of available scenarios: `slug`, `title`, `description`.
- `GET /api/sandbox/scenarios/:slug`:
  - Returns full scenario payload for the selected slug.
- `POST /api/sandbox/inject`:
  - Accepts sandbox scenario array and creates mock Contact/Thread/Message records.
- `DELETE /api/sandbox/clear`:
  - Deletes current user's records where `isMock=true` across sandbox-enabled collections.

## Current Built-in Scenarios

- Easy:
  - `easy-one-customer-single-topic`
  - `easy-one-customer-multi-topic-noise`
  - `easy-one-customer-long-thread`
- Medium:
  - `medium-one-customer-multi-email`
  - `medium-multi-customer-multi-email`
- Hard:
  - `hard-multi-customer-email-telegram`
  - `hard-release-war-room`
- Integration:
  - `integration-one-customer-email-telegram`
  - `integration-multi-customer-shared-topic`
  - `integration-multi-channel-noise-escalation`
  - `integration-telegram-only-private-upsert`

All scenarios use professional Vietnamese business style and are arranged with increasing complexity.

## Scenario Validation Matrix

- `easy-one-customer-single-topic`
  - Goal: baseline clustering and summary/smart-reply on one clear topic.
  - Expected: 1 contact yields 1-2 coherent topics, latest inbound unresolved email remains visible for follow-up.
- `easy-one-customer-multi-topic-noise`
  - Goal: verify topic split and noise filtering from same sender.
  - Expected: business threads contribute to focus/topics; promotional thread (`CATEGORY_PROMOTIONS`) is informational noise and does not require outbound reply.
- `easy-one-customer-long-thread`
  - Goal: test long-body summarization quality and actionable extraction.
  - Expected: summary captures key issues/deadlines from long finance thread; newsletter thread stays low-signal.
- `medium-one-customer-multi-email`
  - Goal: duplicate/similar contact detection across PM/Finance/Ops emails of same person.
  - Expected: verify flow should surface merge candidates with high confidence and preserve active business context after merge.
- `medium-multi-customer-multi-email`
  - Goal: stress contact triage at mixed identity scale.
  - Expected: true duplicates are suggested for merge while distinct customers remain separated.
- `hard-multi-customer-email-telegram`
  - Goal: unify topic signals across email and Telegram for multiple contacts.
  - Expected: chat insights and email threads for same business intent converge to stable focus/topic ranking.
- `hard-release-war-room`
  - Goal: escalation handling with urgent operational context.
  - Expected: unresolved critical threads appear on focus; timeline preserves escalation order and cross-role coordination.
- `integration-one-customer-email-telegram`
  - Goal: regression for single-contact cross-channel topic continuity.
  - Expected: shared intent from Telegram + email is grouped without splitting into unrelated topics.
- `integration-multi-customer-shared-topic`
  - Goal: ensure same macro initiative can exist across different contacts without incorrect identity merge.
  - Expected: per-contact topic grouping is maintained while semantic similarity still supports consolidation within each contact scope.
- `integration-multi-channel-noise-escalation`
  - Goal: test coexistence of escalation and marketing noise in one contact timeline.
  - Expected: escalation paths drive focus; promotional email remains non-actionable noise.
- `integration-telegram-only-private-upsert`
  - Goal: regression for Telegram-only contact materialization.
  - Expected: inbound private Telegram can create contact even without initial email thread; optional email threads still work when present.

## UI Refresh After Sandbox Writes

- After `POST /api/sandbox/inject`, frontend revalidates contacts, threads, focus, and topics caches.
- After `DELETE /api/sandbox/clear`, frontend revalidates contacts, threads, focus, and topics caches.
- After fake webhook submit (`POST /api/sandbox/inject`), frontend revalidates the same cache groups.

## Scenario Authoring Rules

- Use Vietnamese professional business email tone.
- Prefer interrupted 3-4 email exchanges that end with unresolved customer request to stress-test Smart Reply.
- Keep realistic sender signature blocks (`Gửi`, body, closing/signature) for each participant.
- Ensure message timestamps and thread order preserve escalation narrative.
- For authenticated user identity, use placeholders:
  - `{{USER_EMAIL}}` for mailbox address.
  - `{{USER_NAME}}` for display/signature name.
- Hard-level scenarios can include Telegram branch under `contacts[].telegram` and inject mock `TelegramChat`/`TelegramMessage` records.

## AI Summary Action Format (UI Contract)

- `AISummaryCard` parses one action per line and maps metadata chips from this suffix format:
  - `... [Priority:Cao][Owner:CS Team][Deadline:Hôm nay 17:00]`
- Keep each action executable and concise (one verb-first instruction per line).
- If metadata is unknown, still return an action line; chips are optional.

## UI Markers

- Thread list and contact list show `[MOCK]` badge when item has `isMock=true`.
- Thread detail plain-text body normalizes escaped newline sequences (`\\n`) before rendering.

## Naming Convention

- Use the term **changelog** consistently in documentation and state updates.
- Avoid alternative spellings (for example, `chanelog`).
