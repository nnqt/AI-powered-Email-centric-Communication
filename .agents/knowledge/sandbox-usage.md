# Sandbox Usage Guide

## Purpose

Sandbox mode helps developers inject mock inbox/contact data safely for UI and AI workflow testing without calling external provider APIs when data is marked as `isMock`.

## Prerequisites

- Backend and frontend are running.
- Authenticated user session is available.
- Environment must be development, or `ENABLE_SANDBOX_API=true` must be set for backend sandbox APIs.

## Developer Dashboard

- Open `/dev/sandbox` (development only).
- Use **Load Scenario: Angry Customer** to inject a prepared scenario.
- Use **Submit Fake Webhook** to inject one custom inbound email.
- Use **Clear All Sandbox Data** to remove all current user's mock data.

## API Endpoints

- `GET /api/sandbox/scenarios/angry-customer`:
  - Returns the canonical angry-customer scenario JSON.
- `POST /api/sandbox/inject`:
  - Accepts sandbox scenario array and creates mock Contact/Thread/Message records.
- `DELETE /api/sandbox/clear`:
  - Deletes current user's records where `isMock=true` across sandbox-enabled collections.

## UI Markers

- Thread list and contact list show `[MOCK]` badge when item has `isMock=true`.

## Naming Convention

- Use the term **changelog** consistently in documentation and state updates.
- Avoid alternative spellings (for example, `chanelog`).
