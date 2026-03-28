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

- `angry-customer`: Vietnamese long-thread delivery escalation.
- `payment-dispute`: Vietnamese long-thread duplicate-charge dispute.

## Scenario Authoring Rules

- Use Vietnamese professional business email tone.
- Prefer interrupted 3-4 email exchanges that end with unresolved customer request to stress-test Smart Reply.
- Keep realistic sender signature blocks (`Gửi`, body, closing/signature) for each participant.
- Ensure message timestamps and thread order preserve escalation narrative.

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
