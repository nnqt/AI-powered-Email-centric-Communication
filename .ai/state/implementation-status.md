# Implementation Status (March 31, 2026)

This file tracks stable implementation coverage by FR.
Detailed timeline and migration history are in `state/changelog/*`.

## FR Coverage

| FR    | Area                                              | Status |
| ----- | ------------------------------------------------- | ------ |
| FR-01 | Email sync (Gmail)                               | ✅     |
| FR-02 | Compose + send + attachments                      | ✅     |
| FR-03 | Read/unread/archive                               | ✅     |
| FR-04 | Inbox + timeline + pagination                     | ✅     |
| FR-05 | Realtime Socket.IO                                | ✅     |
| FR-06 | Contacts (enrich + verify + merge)                | ✅     |
| FR-07 | AI summarize                                      | ✅     |
| FR-08 | Smart reply studio                                | ✅     |
| FR-09 | Telegram multi-channel                            | ✅     |
| FR-10 | Topic intelligence + focus                        | ✅     |

## Key Runtime Contracts In Use

1. Backend APIs:
  - `.agents/knowledge/api-contracts-backend.md`
2. AI service APIs:
  - `.agents/knowledge/api-contracts-ai-service.md`

## Core Pipeline Checkpoints

1. Unified thread analysis is active via `POST /analyze-thread`.
2. Topic consolidation uses `POST /label-topic` consolidate mode with naming overrides.
3. Focus refresh model is split into list, overview, and recompute endpoints.
4. Contacts verification flow is centralized at `/contacts/verify`.
5. Runtime metrics are exposed through `/api/metrics/overview`.

## Architecture Guardrails

1. Keep one backend AI adapter: `apps/backend/src/modules/ai/ai.service.ts`.
2. Do not add parallel AI adapters under `apps/backend/src/services/*`.
3. Sync contracts/docs whenever endpoint payloads change.

## Deep-Dive Sources

1. Current snapshot:
  - `.agents/state/current-state.md`
2. Topic/Focus design and rollout details:
  - `.agents/skills/patterns/topic-focus-optimization.md`
3. Domain history:
  - `.agents/state/changelog/email-core.md`
  - `.agents/state/changelog/topic-intelligence.md`
  - `.agents/state/changelog/telegram.md`
  - `.agents/state/changelog/sandbox.md`
