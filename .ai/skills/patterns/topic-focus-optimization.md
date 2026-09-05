# Topic and Focus Optimization Blueprint

This file records the FR-10 optimization design and the implemented rollout.
Use it when changing Topic clustering, Focus scoring refresh, or AI call volume.

## Scope

1. Topic ingest and clustering quality.
2. AI request count reduction without quality regression.
3. Focus page and sidebar refresh efficiency.
4. Runtime observability for AI and Focus recompute.

## Current Architecture (March 31, 2026)

1. Unified thread analysis endpoint:
  - `POST /analyze-thread`
  - combines category + optional summary.
2. Topic consolidate endpoint extension:
  - `POST /label-topic` with `mode="consolidate"`
  - returns `clusters`, `topic_name_overrides`, `unmerged_topic_ids`.
3. Focus split endpoints:
  - `GET /api/focus` for list
  - `GET /api/focus/overview` for sidebar counters
  - `POST /api/focus/recompute` for explicit recompute.
4. Runtime metrics endpoint:
  - `GET /api/metrics/overview`.

## Optimization Rules

### Thread Analysis

1. Prefer one call via `analyze-thread` over separate classify + summarize calls.
2. If deterministic noise rules are high-confidence, avoid summary generation.
3. Keep fallback category behavior non-blocking on AI failure.

### Topic Consolidation

1. Keep key-first clustering (`topicKey` and `clusterKey`) before similarity fallback.
2. Run deterministic merge first, then AI consolidate merge.
3. Apply `topic_name_overrides` after consolidation, unless `nameEditedByUser=true`.

### Focus Refresh

1. Use `overview` endpoint for nav badges/counters.
2. Use `recompute` endpoint for explicit user refresh action.
3. Avoid old refresh style that forces duplicate fetch paths.

### Metrics and Guardrails

1. Instrument latency and success/error counters for:
  - `ai.analyze_thread.*`
  - `focus.recompute.*`
2. Validate quality using sandbox scenarios before and after major changes.

## Implemented Rollout Log

### Phase 1: Analyze Thread API

1. Added AI endpoint `POST /analyze-thread`.
2. Added model, service, route in AI service.
3. Registered route in AI service `main.py`.

### Phase 2: Backend Wiring

1. Added `AIService.analyzeThread(...)`.
2. Sandbox inject switched to unified analyze flow.
3. Gmail sync switched to unified analyze flow for uncategorized threads.

### Phase 3: Consolidate and Naming Unification

1. Consolidate response includes `topic_name_overrides`.
2. Backend Topic service applies overrides after merge decisions.
3. Removed redundant relabel step in sandbox flow.

### Phase 4: Focus API Optimization

1. Added `GET /api/focus/overview`.
2. Added `POST /api/focus/recompute`.
3. Focus page and sidebar consume these split endpoints.

### Phase 5: Runtime Metrics

1. Added in-memory metrics utility in backend.
2. Added `GET /api/metrics/overview`.
3. Added counters/timers for thread analysis and focus recompute.

## Acceptance Checks

1. AI call volume reduced on large sync batches.
2. Topic grouping quality unchanged or improved.
3. Focus ranking remains stable for same inbox state.
4. Metrics endpoint shows non-empty counters/timers after active usage.

## Companion References

1. `.agents/knowledge/api-contracts-ai-service.md`
2. `.agents/knowledge/api-contracts-backend.md`
3. `.agents/state/changelog/topic-intelligence.md`
4. `.agents/skills/feature-patterns.md`