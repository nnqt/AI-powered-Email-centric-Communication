# 2026-03-31 — Focus Level Tabs + Sync Pipeline Ordering

## Changed

- Focus page now separates topic visibility by level tabs:
    - default tab: `High` (includes high + critical scores)
    - second tab: `Medium`
    - removed per-card priority badge text because level is now managed by page-level navigation.
- Email sync pipeline ordering adjusted:
    - `upsertParticipants` now runs before topic clustering so contact rows exist when assigning newly-synced threads to topics.
    - reduces cases where a thread exists but has no topic immediately after sync.

# 2026-03-28 — Contact Topics Endpoint

## Added

- Added backend route `GET /api/contacts/:id/topics` at `apps/backend/src/app/api/contacts/[id]/topics/route.ts`.
- Route enforces auth + ownership check (`contact.userId === session.user.id`) and returns `{ topics }` via `TopicService.listTopicsForContact`.
- Endpoint is used by frontend hook `useContactTopics` (`/api/contacts/${contactId}/topics`) for both real and sandbox/mock contacts.

# Changelog — FR-10 Topic Intelligence (Phases 1–6)

> Load file này khi làm việc với Topics, Focus page, thread clustering, AI labeling, focus score.

## Phase 1 — Thread Category Classification

22-value `ThreadCategory` enum on Thread. Fire-and-forget classification after each Thread upsert.

**ThreadCategory enum:**
```
inquiry | introduction | follow_up | thank_you
proposal | contract | invoice | negotiation
project_update | task_request | meeting_request | report
support_request | bug_report | complaint | feedback
notification | newsletter | receipt | security_alert
personal | other
```

**AI Service:** `POST /classify-thread-category` — Tier 1 hard-reject (noreply/automated → 0 Gemini); Tier 2 Gemini returns 1–3 categories.

**Backend:** `Thread.ts` — 6 new fields: `categories[]`, `categorizedAt`, `categorySource`, `lastMessageDirection`, `lastInboundAt`, `noiseFiltered`. `ai.service.ts` — `classifyThreadCategory()`.

## Phase 2 — Topic Model + Heuristic Clustering

**Topic model** (`models/Topic.ts`): `userId`, `contactId`, `name`, `nameEditedByUser`, `threadIds[]`, `threadCount`, `noiseCount`, `focusScore`, `unansweredCount`, `lastInboundAt`, `lastOutboundAt`, `aiLabeled`, `aiLabeledAt`, `chatInsights[]`. Index: `{ userId, contactId }`.

**`TopicService`** (`modules/topics/topic.service.ts`):
- `normalizeSubject(s)` — strip Re:/Fwd:/[TAG]
- `subjectMatchesTopic(a, b)` — exact → substring → ≥60% word overlap (words >2 chars)
- `clusterThreadsIntoTopics(userId, threadIds[])` — skip noise/assigned; fuzzy-match 30d window
- `updateTopicOnNewMessage(topicId, direction, date)` — `$max` on dates + recompute unansweredCount
- `listTopics`, `listTopicsForContact`, `getTopicWithThreads`, `renameTopic`

**API routes:** `GET/PATCH /api/topics/[topicId]`, `GET /api/topics`, `GET /api/contacts/:id/topics`

**gmail.service.ts triggers:**
- Trigger 1&2: unassigned threads → `clusterThreadsIntoTopics`
- Trigger 3: existing thread message → `updateTopicOnNewMessage`

## Phase 3 — AI Topic Labeling

For topics with `aiLabeled=false` and `nameEditedByUser=false`, Gemini generates a 2–5 word label.

**AI Service:** `POST /label-topic` — 0-cost shortcuts: no subjects → `"Untitled"`; single subject ≤60 chars → return as-is; else Gemini.

**Backend:** `TopicService.labelUnlabeledTopics(userId, batchSize=20)` — 5 concurrent; chains after `clusterThreadsIntoTopics`.

## Phase 4 — Focus Score Engine

```
focusScore = unansweredCount × 40
           + recencyScore(lastInboundAt)   // <6h=30 | 6-24h=24 | 1-3d=18 | 3-7d=9 | 7-30d=3 | >30d=0
           + contactWeight                 // colleague|customer=10 | other|unknown=5 | spam=0
```

**Functions:** `computeFocusScore()` (pure), `scoreTopicById()`, `scoreAllTopicsForUser()`, `getFocusTopics()` → `FocusTopicDTO[]`.

**API:** `GET /api/focus?limit=20&refresh=1` — `refresh=1` triggers re-score before return.

**5 gmail.service.ts triggers:** new thread sync, new message in thread, `markRead(true)`, `markRead(false)`, `archiveThread`.

## Phase 5 — Focus Page UI

**New frontend files:**
- `hooks/useFocusTopics.ts` — SWR, `GET /api/focus`, `refreshInterval=120_000`
- `features/focus/FocusTopicCard.tsx` — expandable card: avatar, topic name (inline rename), score bar, lazy thread load, "View contact →" link
- `app/(dashboard)/focus/page.tsx` — skeleton/empty/error states + "Refresh scores" button

Focus nav item added between Email and Contacts in sidebar.

## Phase 6 — Contact Timeline Upgrade (By Topic view)

**New frontend files:**
- `hooks/useContactTopics.ts` — SWR, `GET /api/contacts/:id/topics`
- `features/contacts/ContactTopicGroup.tsx` — expandable topic card with inline rename, direction dots

**Contact detail page changes:**
- `timelineView: "flat" | "topics"` toggle state
- "By Topic" panel: `ContactTopicGroup` sorted by focusScore desc
- "Timeline" panel: unchanged flat chronological list

**Route compatibility updates (Next.js 15 async params):**
- `api/contacts/[contactId]/topics/route.ts` — `params` → `Promise<{contactId}>`
- `api/topics/[topicId]/route.ts` — `params` → `Promise<{topicId}>` for GET + PATCH

## March 29, 2026 — Topic Clustering Stabilization (Key-first)

- Added key-first clustering metadata:
    - `Thread.topicKey`, `Thread.topicKeySource`, `Thread.topicKeyConfidence`
    - `Topic.clusterKey`, `Topic.clusterKeySource`, `Topic.clusterVersion`
- Updated `TopicService._assignThread()` flow:
    - derive heuristic key from thread subject/snippet/summary context
    - try match existing topics by `clusterKey` first
    - fallback to `subjectMatchesTopic()` only when key match is unavailable
- New topics now inherit `isMock` from source thread to align sandbox lifecycle with `DELETE /api/sandbox/clear`.

## March 29, 2026 — P2/P3 Deep Improvements

- P2: AI-assisted canonical topic key
    - AI contract `POST /classify-thread-category` now can return:
        - `topic_key` (kebab-case canonical key)
        - `topic_key_confidence` (0.0–1.0)
    - Backend persists AI key on threads (`topicKey/topicKeySource/topicKeyConfidence`) during sync.
    - AI service has fallback heuristic key generation when Gemini output is missing/invalid.

- P3: Post-clustering merge pass
    - Added `TopicService.mergeLikelyTopicsForUser(userId, contactIds?)`.
    - Merge criteria:
        - same `clusterKey` (strong signal)
        - fallback deterministic similarity: subject normalization + token overlap + recency window
    - Merge operation rewires source threads to target topic, recomputes denormalized topic metrics, then deletes source topic.

- Sandbox verification support
    - `POST /api/sandbox/inject` now runs merge pass explicitly for touched mock contacts.
    - Inject response includes `diagnostics.topicsByContact` to quickly verify expected topic counts per contact.

## March 29, 2026 — AI Consolidation Mode (Reused label-topic API)

- Extended existing `POST /label-topic` with dual mode:
    - `mode="label"` (backward compatible)
    - `mode="consolidate"` for deciding topic clusters to merge.
- Consolidation candidates now carry richer context:
    - thread subjects
    - full summary text (budgeted/truncated)
    - key issues + action required
    - categories
    - Telegram chat insights + recent Telegram messages.
- Backend `TopicService` added AI consolidation pass per contact and applies AI cluster decisions through existing topic merge flow.
- Sandbox pipeline updated to run AI consolidation between deterministic merge and final labeling/scoring.
