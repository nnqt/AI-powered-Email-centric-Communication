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

**Bug fixes (Next.js 15 async params):**
- `api/contacts/[contactId]/topics/route.ts` — `params` → `Promise<{contactId}>`
- `api/topics/[topicId]/route.ts` — `params` → `Promise<{topicId}>` for GET + PATCH
