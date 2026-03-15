# Current State – March 10, 2026

## Topic Intelligence — Phase 1: Thread Category Classification ✅ IMPLEMENTED

### Decisions (chốt từ discussion)

- Topic granularity: **Option B** — nhiều Topics per contact
- Detection: **Option C** background batch; input = subject + summary (if exists) + snippet fallback
- Time window: **30 ngày**
- Category: **22-value functional enum**, multi-category per thread
- Focus page: **Hybrid** (topic card expand → threads), replace Urgent tab hoàn toàn
- Score: DB-computed, async after sync, stored `focusScore` on Topic
- Pre-filter: Tier 1 hard reject (noreply/spam/automated) + Tier 2 soft (single-message, vẫn vào topic)

### ThreadCategory enum (22 values)

```
inquiry | introduction | follow_up | thank_you
proposal | contract | invoice | negotiation
project_update | task_request | meeting_request | report
support_request | bug_report | complaint | feedback
notification | newsletter | receipt | security_alert
personal | other
```

### Files thay đổi

**AI Service:**

- `apps/ai-service/models/thread_category.py` — **NEW** — `ClassifyThreadCategoryRequest/Response`, `VALID_THREAD_CATEGORIES`, `NOISE_CATEGORIES`
- `apps/ai-service/services/thread_categorizer.py` — **NEW** — service wrapper
- `apps/ai-service/routes/thread_category.py` — **NEW** — `POST /classify-thread-category`
- `apps/ai-service/core/llm_client.py`:
  - Import `thread_category` models
  - `_NOREPLY_PREFIXES` set — noreply/no-reply/bounce/postmaster...
  - `_AUTOMATED_SUBJECT_PATTERNS` list
  - `_is_noreply_sender()`, `_has_automated_subject()` helpers
  - `GeminiThreadCategoryClient.classify()` — Tier 1 guards (0 AI) → Gemini fallback → validate output
  - `get_thread_category_client()` factory
- `apps/ai-service/main.py` — register `thread_category_routes`

**Backend:**

- `apps/backend/src/models/Thread.ts`:
  - Export type `ThreadCategory` (22 values)
  - `THREAD_CATEGORY_VALUES[]` const cho Mongoose enum
  - 6 new fields: `categories[]`, `categorizedAt`, `categorySource`, `lastMessageDirection`, `lastInboundAt`, `noiseFiltered`
- `apps/backend/src/modules/ai/ai.service.ts`:
  - `classifyThreadCategory(threadId, subject?, snippet?, senderEmail?, senderCategories?)` → `{ categories[], noiseFiltered }`
  - POST `AI_SERVICE_URL/classify-thread-category`, timeout 15s, fallback `{ categories: [], noiseFiltered: false }`
- `apps/backend/src/modules/email/gmail.service.ts`:
  - `getUserEmail()` private method (DB lookup, returns `user.email.toLowerCase()`)
  - `GmailService.parseEmail(raw)` static helper (parse `"Name <email>"` → email)
  - Fetch `userEmail` once at top of `syncEmails`
  - Track `lastSenderRaw` + `lastInboundAt` in message loop
  - Compute `lastMessageDirection` (inbound/outbound) từ `lastSenderEmail` vs `userEmail`
  - Store `lastMessageDirection`, `lastInboundAt` trong Thread upsert
  - New fire-and-forget block: `!categorizedAt` → lookup contact → `classifyThreadCategory` → `Thread.updateOne({ categories, noiseFiltered, categorizedAt, categorySource:"ai" })`
- `apps/backend/src/app/api/threads/[threadId]/categories/route.ts` — **NEW** — `POST` manual re-classify endpoint

---

## Topic Intelligence — Phase 2: Topic Model + Heuristic Clustering ✅ IMPLEMENTED

### New files

**Backend:**

- `apps/backend/src/models/Topic.ts` — **NEW**
  - `ITopic` interface: `userId`, `contactId` (ref Contact), `name`, `nameEditedByUser`, `threadIds[]`, `threadCount`, `noiseCount`, `focusScore`, `lastScoredAt`, `lastInboundAt`, `lastOutboundAt`, `unansweredCount`, `aiLabeled`, `aiLabeledAt`
  - Compound index `{ userId: 1, contactId: 1 }`
  - `topicId` field also added to `IThread` / `ThreadSchema` (ref Topic, indexed)

- `apps/backend/src/modules/topics/topic.service.ts` — **NEW** — `TopicService` class:
  - `normalizeSubject(s)` — strip Re:/Fwd:/FW:/Tr: (multi-level) + `[TAG]` brackets
  - `subjectMatchesTopic(a, b)` — exact → substring → ≥60% word overlap (words >2 chars)
  - `clusterThreadsIntoTopics(userId, threadDocIds[])` — main clustering: skip noiseFiltered, skip already-assigned; fuzzy-match against active topics (30d window) or create new Topic; updates Thread.topicId
  - `updateTopicOnNewMessage(topicId, direction, date)` — Trigger 3: `$max` on lastInboundAt/lastOutboundAt + recompute `unansweredCount`
  - `renameTopic(userId, topicId, name)` — sets `nameEditedByUser=true`
  - `listTopics(userId, limit)` — sorted by focusScore desc
  - `listTopicsForContact(userId, contactId)`
  - `getTopicWithThreads(userId, topicId)`

**API routes:**

- `apps/backend/src/app/api/topics/route.ts` — **NEW** — `GET /api/topics?limit=`
- `apps/backend/src/app/api/topics/[topicId]/route.ts` — **NEW** — `GET` (with threads) + `PATCH` (rename)
- `apps/backend/src/app/api/contacts/[contactId]/topics/route.ts` — **NEW** — `GET /api/contacts/:id/topics`

### gmail.service.ts changes (Phase 2 triggers)

- Import + instantiate `TopicService`
- Per-batch: collect `SyncedThreadMeta[]` (threadId, topicId, direction, dates) from Thread upsert
- After all batches:
  - **Trigger 1 & 2** — unassigned threads → fire-and-forget `clusterThreadsIntoTopics(userId, unassignedIds)`
  - **Trigger 3** — threads with existing topicId → fire-and-forget `updateTopicOnNewMessage(topicId, direction, date)`

### Pending phases

- **Phase 3** — AI topic labeling ✅ (see below)
- **Phase 4** — Focus score engine ✅ (see below)
- **Phase 5** — Focus page UI ✅ (see below)
- **Phase 6** — Contact timeline upgrade ✅ (see below)

---

## Topic Intelligence — Phase 3: AI Topic Labeling ✅ IMPLEMENTED

### Goal

For topics with `aiLabeled=false` and `nameEditedByUser=false`, call Gemini to replace the raw subject-based placeholder name with a concise 2–5 word label that captures the topic.

### AI Service new files

- `apps/ai-service/models/topic_label.py` — **NEW**
  - `LabelTopicRequest(topic_id, thread_subjects[], contact_name?)`
  - `LabelTopicResponse(topic_id, name)`

- `apps/ai-service/services/topic_labeler.py` — **NEW** — thin wrapper calling `GeminiTopicLabelClient.label()`

- `apps/ai-service/routes/topic_label.py` — **NEW** — `POST /label-topic`

- `apps/ai-service/core/llm_client.py`:
  - Import `LabelTopicRequest`
  - `GeminiTopicLabelClient.label()`:
    - No subjects → returns `"Untitled"` (0 AI cost)
    - Single subject ≤ 60 chars → returns it directly (0 AI cost)
    - Otherwise → Gemini prompt: provide subjects (up to 20), contact hint, instruct 2–5 word label in same language as subjects
    - Fallback on error: return first subject
  - `get_topic_label_client()` factory

- `apps/ai-service/main.py`: registered `topic_label_routes`

### Backend changes

- `apps/backend/src/modules/ai/ai.service.ts`:
  - `labelTopic(topicId, threadSubjects[], contactName?)` → `{ name: string }` — POST `/label-topic`, timeout 10s, fallback to first subject

- `apps/backend/src/modules/topics/topic.service.ts`:
  - Import `AIService`; `private _aiService = new AIService()`
  - `labelUnlabeledTopics(userId, batchSize=20)`:
    - Query `{ aiLabeled: false, nameEditedByUser: false }` (capped at batchSize)
    - For each topic: gather thread subjects + contact displayName/name → call `_aiService.labelTopic()`
    - Update: `{ name, aiLabeled: true, aiLabeledAt: new Date() }`
    - Processes 5 topics concurrently (respects Gemini rate limits)

- `apps/backend/src/modules/email/gmail.service.ts`:
  - After `clusterThreadsIntoTopics` resolves → chain `.then(() => topicService.labelUnlabeledTopics(userId))`
  - Both cluster + label share a single `.catch()` log handler

### Automatic trigger flow (per sync)

```
syncEmails()
  └─ clusterThreadsIntoTopics(userId, unassignedIds)   — heuristic (0 AI)
      └─ .then() labelUnlabeledTopics(userId)           — AI labeling
```

### Pending phases

- **Phase 4** — Focus score engine ✅ (see below)
- **Phase 5** — Focus page UI ✅ (see below)
- **Phase 6** — Contact timeline upgrade ✅ (see below)

---

## Topic Intelligence — Phase 4: Focus Score Engine ✅ IMPLEMENTED

### Score Formula (pure, stored on Topic.focusScore)

```
focusScore = unansweredCount × 40          // primary signal — each unanswered thread
           + recencyScore(lastInboundAt)    // 0–30 time-decay bucket
           + contactWeight                  // 0–10 based on relationship
```

recency decay: <6h=30 | 6–24h=24 | 1–3d=18 | 3–7d=9 | 7–30d=3 | >30d=0
contact weight: colleague|customer=10 | other|unknown=5 | spam=0

### New functions in `topic.service.ts`

- `computeFocusScore({ unansweredCount, lastInboundAt?, contactCategory? })` — exported pure function (testable)
- `scoreTopicById(topicId)` — fetch topic + contact.category via DB → compute → update `focusScore`, `lastScoredAt`
- `scoreAllTopicsForUser(userId)` — aggregate all user's topics + contact category in one `$lookup`, batch-update in groups of 50
- `getFocusTopics(userId, limit=20)` — aggregate with `$lookup` contact, return `FocusTopicDTO[]` sorted by focusScore desc
- New export type: `FocusTopicDTO extends TopicDTO` with nested `contact { _id, email, name, org, category, categories }`

### New API route

- `apps/backend/src/app/api/focus/route.ts` — **NEW**
  - `GET /api/focus?limit=20&refresh=1`
  - `refresh=1` triggers `scoreAllTopicsForUser` before returning (optional, for pull-to-refresh)
  - Returns `{ topics: FocusTopicDTO[] }`

### Trigger map (gmail.service.ts)

| Trigger | Event                          | Action                                                     |
| ------- | ------------------------------ | ---------------------------------------------------------- |
| 1 & 2   | New thread synced (no topicId) | `cluster → label → scoreAll`                               |
| 3       | New message in existing thread | `updateTopicOnNewMessage → scoreTopicById`                 |
| 4       | `markRead(true)`               | `Thread.findOneAndUpdate → scoreTopicById(thread.topicId)` |
| 5       | `archiveThread`                | `Thread.findOneAndUpdate → scoreTopicById(thread.topicId)` |

### Pending phases

- **Phase 5** — Focus page UI ✅ (see below)
- **Phase 6** — Contact timeline upgrade ✅ (see below)

---

## Topic Intelligence — Phase 5: Focus Page UI ✅ IMPLEMENTED

### New files

**Frontend:**

- `apps/frontend/src/hooks/useFocusTopics.ts` — **NEW**
  - `FocusContactDTO`, `FocusTopicDTO` TypeScript interfaces
  - `useFocusTopics(limit=20)` — SWR hook, `GET /api/focus`, `refreshInterval=120_000`
  - Returns `{ topics, isLoading, error, mutate }`

- `apps/frontend/src/features/focus/FocusTopicCard.tsx` — **NEW**
  - `ContactAvatar` — single-letter avatar from name/email
  - `CategoryChip` — colored chip per contact category
  - `ScoreBar` — fill bar proportional to focusScore (red≥120, amber≥60, indigo<60; cap=200)
  - `FocusTopicCard({ topic, onRename })`:
    - Header: avatar + topic name (inline rename on pencil click) + contact info + score bar
    - Right side: unansweredCount badge (red) + threadCount + lastInbound time + category chip + chevron
    - Expand → lazy `GET /api/topics/:id` → thread list with direction dot + subject + snippet + link
    - "View contact →" link to `/contacts/:contactId`

- `apps/frontend/src/app/(dashboard)/focus/page.tsx` — **NEW**
  - Loading skeleton (4 animated bars)
  - Error state with retry
  - Empty state with description
  - "Refresh scores" button → `GET /api/focus?refresh=1` then `mutate()`
  - Local state for optimistic rename (`localTopics`)
  - BEM: `focus-page`, `focus-page__topbar`, `focus-page__content`, `focus-page__list`

### Modified files

- `apps/frontend/src/app/(dashboard)/layout.tsx`:
  - Added Focus nav item between Email and Contacts in `NAV_ITEMS`
  - `href: "/focus"`, `label: "Focus"`, eye/target SVG icon, `activePaths: ["/focus"]`

---

## Topic Intelligence — Phase 6: Contact Timeline Upgrade ✅ IMPLEMENTED

### Goal

In the contact detail page (`/contacts/[id]`), add a **"By Topic" view** alongside the existing flat timeline. Threads are grouped by their assigned topic so the user can see conversation threads in context.

### New files

**Frontend:**

- `apps/frontend/src/hooks/useContactTopics.ts` — **NEW**
  - `TopicDTO` TypeScript interface
  - `useContactTopics(contactId)` — SWR hook, `GET /api/contacts/:id/topics`
  - Returns `{ topics, isLoading, isError, mutate }`

- `apps/frontend/src/features/contacts/ContactTopicGroup.tsx` — **NEW**
  - `ScoreChip` — colored pill (red≥120, amber≥60, indigo<60)
  - `ContactTopicGroup({ topic, onRename })`:
    - Expandable header with chevron + topic name + AI label indicator
    - Inline rename (pencil button → input → Save/Cancel → `PATCH /api/topics/:id`)
    - Right-side: unansweredCount badge (red dot) + thread count + focusScore chip
    - Expand → lazy `GET /api/topics/:id` → thread list with inbound/outbound direction dots
    - `onRename(topicId, newName)` callback for optimistic parent update

### Modified files

- `apps/frontend/src/app/(dashboard)/contacts/[id]/page.tsx`:
  - Added `useContactTopics` hook call + `localTopics` state for optimistic rename
  - Added `timelineView: "flat" | "topics"` toggle state
  - Timeline section header now shows **Timeline / By Topic** toggle buttons (indigo active state)
  - "By Topic" panel renders `ContactTopicGroup` cards sorted by focusScore desc
  - "Timeline" panel keeps existing flat chronological thread list unchanged
  - Skeleton loading (3 animated bars) while topics load

### Bug fixes applied

- `apps/backend/src/app/api/contacts/[contactId]/topics/route.ts`: `params` changed to `Promise<{contactId}>` (Next.js 15 async params)
- `apps/backend/src/app/api/topics/[topicId]/route.ts`: `params` changed to `Promise<{topicId}>` for both `GET` and `PATCH` handlers

---

## Phase 1–3 (previous session): Bulk Enrich + Urgent Improvements ✅ IMPLEMENTED

### Phase 1 — Bulk Enrich Contacts

**New route:** `POST /api/contacts/bulk-enrich`

- Queries all contacts với `aiEnriched=false, mergedInto: {$exists:false}` — max 200 per call.
- Batches of 5, sequential với 300ms delay giữa các batch (tránh Gemini rate limit).
- Với mỗi contact: fetch snippet từ timeline, call AI enrich, update fields.
- Trả về `{ processed, skipped, failed, total }`.

**UI:** `contacts/page.tsx`

- Import `apiClient`; expose `mutate` từ `useContacts`.
- State: `bulkEnriching`, `bulkResult`.
- Button "✦ Enrich All" trong header topbar.
  - Spinning khi loading; hiển thị `processed/total` sau khi xong.
  - `mutate()` để refresh contact list.

---

### Phase 2 — Urgent Classification: Sender Context + Prompt Fix

**AI Service:**

- `models/urgent.py`: Thêm `sender_email?: str`, `sender_categories?: List[str]` vào `ClassifyUrgentRequest`.
- `core/llm_client.py`:
  - **Keyword set tightened**: Bỏ `"important"`, `"follow up"`, `"follow-up"`, `"reminder"`, `"deadline"`, `"ngay"` — tránh false positive với newsletter/marketing.
  - **Spam fast-path**: Nếu `sender_categories` chỉ có `"spam"` → trả `is_urgent=False` ngay, không gọi Gemini.
  - **Prompt rewrite**: Explicit instruction không flag newsletter/promotional/routine reminders. Thêm sender context block vào prompt với tone hint:
    - `colleague/customer` → "give deadlines appropriate urgency weight"
    - `spam` → "lean toward NOT urgent"
- `ai.service.ts` (`classifyUrgent`): Thêm tham số `senderEmail?`, `senderCategories?`, pass vào request body.

**Backend:**

- `gmail.service.ts`:
  - Import `Contact` model.
  - Track `firstSenderRaw` (From header của message đầu tiên).
  - Trước khi gọi `classifyUrgent`: lookup `Contact` by `senderEmail` → lấy `categories[]`.
  - Pass `senderEmail` + `senderCategories` vào `classifyUrgent`.

---

### Phase 3 — Urgent Dismissed (Option B: granular flag)

**Decision:** Không clear `isUrgent` khi đọc — dùng field `urgentDismissed` riêng để giữ history.

**Schema change** — `Thread`:

- Thêm field: `urgentDismissed: Boolean` (default: `false`).

**Behavior:**

- `markRead(read=true)` → set `urgentDismissed: true` cùng với `isRead: true`.
- `markRead(read=false)` → **không** restore `urgentDismissed` (email đã đọc = đã ack urgent).
- Timeline urgent filter: `isUrgent=true AND isArchived!=$true AND urgentDismissed!=$true`.

**Files changed:**

- `apps/backend/src/models/Thread.ts`: Thêm `urgentDismissed` vào interface + schema.
- `apps/backend/src/modules/email/gmail.service.ts`: `markRead` cập nhật.
- `apps/backend/src/modules/timeline/timeline.service.ts`: Urgent query thêm `urgentDismissed: { $ne: true }`.

---

## BEM className Convention ✅ IMPLEMENTED

**Rule mới thêm vào `.claude/code-conventions.skill.md`:**

- Mỗi component/page root element và structural children phải có BEM identifier className để dễ debug.
- Format: `block-name`, `block-name__element`, `block-name--modifier` (kebab-case).
- BEM class đặt **trước** Tailwind classes; Tailwind không thay đổi.

**Components đã cập nhật:**

| File                     | BEM Block                      | Các element được đánh dấu                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout.tsx`             | `dashboard-layout`, `sidebar`  | `sidebar__logo`, `sidebar__compose`, `sidebar__nav`, `sidebar__nav-list`, `sidebar__nav-item`, `sidebar__user`, `dashboard-layout__content`                                                                                                                                                                |
| `inbox/page.tsx`         | `inbox-page`                   | `inbox-page__topbar`, `inbox-page__content`                                                                                                                                                                                                                                                                |
| `ThreadList.tsx`         | `thread-list`                  | `thread-list__search`, `thread-list__filters`, `thread-list__pagination`, `thread-list__items`, `thread-list__item`, `thread-list__item-actions`, `thread-list__item-indicator`, `thread-list__pagination-footer`, `thread-list__empty-state`, `thread-list__error`                                        |
| `threads/[id]/page.tsx`  | `thread-detail`                | `thread-detail__container`, `thread-detail__back`, `thread-detail__header`, `thread-detail__messages`, `thread-detail__message`, `thread-detail__message-meta`                                                                                                                                             |
| `contacts/page.tsx`      | `contacts-page`, `contact-row` | `contacts-page__topbar`, `contacts-page__create-form`, `contacts-page__list`, `contacts-page__search`, `contacts-page__filters`, `contacts-page__merge-suggestions`, `contacts-page__items`, `contacts-page__pagination`; `contact-row__avatar`, `contact-row__info`, `contact-row__badges`                |
| `contacts/[id]/page.tsx` | `contact-detail`               | `contact-detail__topbar`, `contact-detail__container`, `contact-detail__profile`, `contact-detail__profile-header`, `contact-detail__info`, `contact-detail__info-row`, `contact-detail__category-checklist`, `contact-detail__timeline`, `contact-detail__timeline-list`, `contact-detail__timeline-item` |
| `AISummaryCard.tsx`      | `ai-summary-card`              | `ai-summary-card--loading`, `ai-summary-card--empty`, `ai-summary-card__spinner`, `ai-summary-card__trigger`, `ai-summary-card__header`, `ai-summary-card__regenerate`, `ai-summary-card__key-issues`, `ai-summary-card__action-required`                                                                  |
| `SmartReplyBar.tsx`      | `smart-reply-bar`              | `smart-reply-bar__header`, `smart-reply-bar__format-toggle`, `smart-reply-bar__chips`, `smart-reply-bar__cards`, `smart-reply-bar__reply-card`, `smart-reply-bar__error`, `smart-reply-bar__hint`                                                                                                          |
| `ComposeDrawer.tsx`      | `compose-drawer`               | `compose-drawer__overlay`, `compose-drawer__header`, `compose-drawer__fields`, `compose-drawer__toolbar`, `compose-drawer__toolbar-btn`, `compose-drawer__editor`, `compose-drawer__attachments`, `compose-drawer__attachment`, `compose-drawer__footer`                                                   |
| `SyncButton.tsx`         | `sync-button`                  | (root button only)                                                                                                                                                                                                                                                                                         |
| `Toast.tsx`              | `toast-container`, `toast`     | `toast--{type}` (modifier), `toast__body`, `toast__close`                                                                                                                                                                                                                                                  |

---

## UI & Data Fixes (Session 2)

### Issue 1 — Thread row action buttons ✅ FIXED

`ThreadList.tsx`: Replaced hover-only absolute buttons with always-visible inline buttons on the **left** of each thread row.

- Removed `group relative` + `absolute` hover pattern.
- New layout per row: `[mark-read btn | archive btn] [unread dot] <Link>content + time/urgent</Link>`
- Buttons now use `text-gray-300 hover:text-gray-600` (subtle when idle, visible on hover) — not hidden at all.

### Issue 2 — Compose button → sidebar; SyncButton → ThreadList pagination ✅ FIXED

New file: `apps/frontend/src/lib/ComposeContext.tsx`

- `ComposeProvider` + `useCompose()` — context holding `{ composeOpen, openCompose, closeCompose }`.

`layout.tsx`:

- Wrapped `DashboardContent` in `<ComposeProvider>`.
- Added full-width **Compose** button (indigo) in sidebar below logo.
- Split export into `DashboardLayout → ComposeProvider > DashboardContent`.

`inbox/page.tsx`:

- Removed local `composeOpen` state + Compose button + SyncButton from header.
- Now reads `{ composeOpen, closeCompose }` from `useCompose()`.
- Header simplified to just "Inbox" title.

`ThreadList.tsx`:

- Imported `SyncButton`.
- SyncButton now appears in **both** pagination rows (top header + bottom footer), next to ← Newer / Older → buttons.

### Issue 3 — Contacts category filter tabs ✅ FIXED

`contacts/page.tsx`:

- Added `CATEGORY_FILTER_TABS` constant: `All / Colleague / Customer / Other / Spam`.
- Destructures `categoryFilter, setCategoryFilter` from `useContacts`.
- Tabs rendered below search bar with indigo underline active indicator (same pattern as inbox).

### Issue 4 — Rename `third_party` → `other` ✅ FIXED (breaking change)

Files changed:

- `apps/backend/src/models/Contact.ts` — enum values updated.
- `apps/backend/src/app/api/contacts/[contactId]/route.ts` — `VALID_CATEGORIES`.
- `apps/ai-service/core/llm_client.py` — domain fallback + prompt + valid_categories set.
- `apps/ai-service/models/contact.py` — comment.
- `apps/frontend/src/hooks/useContacts.ts` — `ContactCategory` type.
- `apps/frontend/src/app/(dashboard)/contacts/[id]/page.tsx` — `CATEGORY_LABELS`, `CATEGORY_CHIP_STYLE`.

### Issue 5 — Multi-category + checklist UI ✅ FIXED

**Backend:**

- `Contact.ts`: Added `categories: [String]` field (enum `colleague|customer|other|spam|unknown`, default `[]`).
- `IContact` interface: Added `categories: ContactCategory[]`.
- `ContactDTO`: Added `categories: ContactCategory[]`.
- `toDTO()`: Maps `categories` (default `[]`).
- `updateContact()` Pick: Added `categories`.
- PATCH route `[contactId]/route.ts`: Accepts `categories: ContactCategory[]`; `categoryAiSuggestion: null` now explicitly clears the field.

**Frontend (`contacts/[id]/page.tsx`):**

- Added `ALL_CATEGORIES` constant.
- New state: `pendingCats: Set<ContactCategory>`.
- `useEffect` initializes `pendingCats` from `contact.categories` + AI suggestion when suggestion banner appears.
- `togglePendingCat(cat)` — toggle individual category.
- `handleConfirmCategories()` — saves `categories[]`, derives `category` as `categories[0]` or `"unknown"`, clears `categoryAiSuggestion`.
- **AI suggestion banner** replaced with inline **checklist**:
  - All 5 categories shown as toggle chips.
  - AI-suggested one pre-ticked + labeled `AI`.
  - Existing `contact.categories` also pre-ticked.
  - "Confirm" button (disabled if nothing selected) + "Skip" text link.
- Profile chips: shows all `contact.categories` (filtered `!= "unknown"`); falls back to `contact.category`.

---

## Claude Project Knowledge Files (`.claude/`)

Tất cả `.copilot/*.md` đã được convert sang format Claude Project Knowledge tại `.claude/`:

| File                            | Loại  | Nội dung                                                                                 |
| ------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| `project-overview.spec.md`      | spec  | Stack, services, ports, routing, auth, Docker, env vars                                  |
| `database-schema.spec.md`       | spec  | MongoDB schemas (User, Thread, Contact, Message) + Redis keys                            |
| `api-contracts.spec.md`         | spec  | Tất cả REST endpoints (backend + AI service) với request/response shapes                 |
| `ai-service.spec.md`            | spec  | Module structure, Gemini clients, token safety, domain fallback, language policy         |
| `implementation-status.spec.md` | spec  | FR status table, module details, architecture decisions, production fixes                |
| `code-conventions.skill.md`     | skill | TypeScript/Python naming, file structure, patterns, Socket.IO events                     |
| `feature-patterns.skill.md`     | skill | Route templates, AI feature add pattern, cursor pagination, optimistic UI, FR→module map |

---

## Deployment Mode

All services run fully via **Docker Compose** (`infra/docker-compose.yml`).

```
Browser → http://localhost:3000  (frontend container)
       → /api/* rewrites → http://backend:4000  (internal Docker network)
       → Google OAuth callback → http://localhost:4000/api/auth/callback/google
       → AI calls → http://ai-service:5000
       → MongoDB → mongo:27017
       → Redis  → redis:6379
```

**Start everything:**

```bash
cd infra
docker compose build --no-cache
docker compose up -d
```

---

## Services & Ports

| Service       | Host port | Internal Docker URL               |
| ------------- | --------- | --------------------------------- |
| Frontend      | 3000      | —                                 |
| Backend       | 4000      | `http://backend:4000`             |
| AI Service    | 5000      | `http://ai-service:5000`          |
| MongoDB       | 27017     | `mongodb://mongo:27017/emailhub`  |
| Redis         | 6379      | `redis://redis:6379`              |
| mongo-express | 8081      | `http://localhost:8081` (browser) |

---

## Implemented Features

### Phase 2 — Email Search + Filter Tabs ✅ IMPLEMENTED

**Backend + Frontend.**

`TimelineService.getThreads()` (`apps/backend/src/modules/timeline/timeline.service.ts`):

- New param `filter: ThreadFilter` (`"all" | "unread" | "archived"`, default `"all"`).
  - `all` → `isArchived: { $ne: true }` (excludes archived từ main inbox).
  - `unread` → `isRead: false, isArchived: { $ne: true }`.
  - `archived` → `isArchived: true`.
- New param `q?: string` → regex search trên `subject`, `participants`, `snippet` (case-insensitive, special chars escaped).
- `total` count giờ reflect filter + search thay vì chỉ userId.
- Cursor parsing cải thiện: dùng `lastIndexOf("_")` thay vì `split("_")[0]` để đúng với ISO date strings.

`GET /api/threads` route:

- Extract `filter` + `q` từ searchParams, validate filter enum, pass xuống service.

`useThreads` hook (`apps/frontend/src/hooks/useThreads.ts`):

- Export `ThreadFilter` type.
- State: `filter` (default `"all"`), `search` (raw), `debouncedSearch` (350ms debounce dùng `useDebounce()`).
- Auto-reset cursor + page khi `filter` hoặc `debouncedSearch` thay đổi (dùng `useRef` để detect).
- URL build bằng `URLSearchParams`: chỉ append params khi có giá trị.
- Expose `filter, setFilter, search, setSearch` ra ngoài.

`ThreadList` (`apps/frontend/src/features/inbox/ThreadList.tsx`):

- Search input: icon kính lúp, clear button (×) khi có text, debounced qua hook.
- Filter tabs: `All / Unread / Archived / 🔴 Urgent`.
  - Active tab: indigo underline line indicator.
  - Urgent tab: **fully enabled** (powered by `isUrgent` flag từ Phase 4A).
- Loading state: skeleton cho search bar + tabs + thread rows.
- Empty state: context-aware message ("No results for 'X'" / "No unread emails" / ...).
- Tabs + search bar hiển thị ngay cả khi array rỗng (không early-return ẩn UI).

### Phase 3 — Contacts UI Redesign ✅ IMPLEMENTED

**Frontend-only (builds on Phase 1 shell + FR-06 backend).**

`contacts/page.tsx`:

- Search bar (debounced) + clear button, pre-populated từ `?q=` URL query param.
- Category filter tabs: `All / Colleague / Customer / Third-party / Spam`.
- `ContactRow` component: initials avatar, name/email, org badge, `CATEGORY_CHIP_STYLE` badge.
- `EditContactModal`: Form inline modal cho sửa name / org / language / alternateEmails.
- `useContacts` hook: `search`, `setSearch`, `categoryFilter`, `setCategoryFilter` exposed.

`contacts/[id]/page.tsx`:

- Inline edit mode: `isEditing` state, `startEdit`/`cancelEdit`/`handleSaveEdit` handlers.
- Editable fields: Name, Org, Language (select), Alternate Emails (comma-separated).
- Category chip badge trong profile header badges area (với "· confirmed" suffix khi `categorySource === "user"`).

### Phase 4A — AI Urgent Email Classification ✅ IMPLEMENTED

**Full stack: Python AI service + Backend models/service + Frontend tab + badge.**

AI Service (`apps/ai-service`):

- `models/urgent.py` — `ClassifyUrgentRequest(thread_id, subject?, snippet?)`, `ClassifyUrgentResponse(thread_id, is_urgent, reason)`.
- `services/urgent_classifier.py` — `classify_urgent(request)` → calls `GeminiUrgentClassifier`.
- `routes/urgent.py` — `POST /classify-urgent` endpoint.
- `GeminiUrgentClassifier` trong `core/llm_client.py`:
  - `_URGENT_KEYWORDS` frozenset (English + Vietnamese urgency words: "urgent", "asap", "khẩn", "gấp", ...).
  - **Fast path**: keyword scan, trả `is_urgent=True` ngay (không gọi Gemini).
  - **Gemini fallback** cho unknown cases (`max_retries=2`); default `is_urgent=False` on error.
  - `get_urgent_classifier()` factory function.

Backend:

- `Thread` model: added `isUrgent: Boolean (default false)`, `urgentClassifiedAt: Date`.
- `AIService.classifyUrgent(threadId, subject?, snippet?)` trong `ai.service.ts` — calls `POST /classify-urgent`; returns `{ isUrgent: false }` on error (non-fatal).
- `gmail.service.ts`: fire-and-forget sau mỗi thread upsert — `if (!threadDoc.urgentClassifiedAt)` → `classifyUrgent().then(({ isUrgent }) => Thread.updateOne({ id }, { isUrgent, urgentClassifiedAt: new Date() }))`.
- `timeline.service.ts`: `ThreadFilter` thêm `"urgent"` → `isUrgent: true, isArchived: { $ne: true }`.
- `GET /api/threads`: thêm `"urgent"` vào valid filter list.

Frontend:

- `useThreads.ts`: `ThreadFilter = "all" | "unread" | "archived" | "urgent"`, `ThreadDTO` thêm `isUrgent?`, `urgentClassifiedAt?`.
- `ThreadList.tsx`: Urgent tab **enabled** (không còn disabled/Soon badge); empty state "No urgent emails"; thread row hiển thị `🔴 Urgent` chip khi `thread.isUrgent`.
- Thread detail `threads/[id]/page.tsx`: header hiển thị `🔴 Urgent` chip + "AI classified X ago" khi `thread.isUrgent`.

### Phase 4B — Contact Category AI Suggestion ✅ IMPLEMENTED

**Full stack: Python AI service + Backend enrich route + Frontend suggestion banner.**

AI Service (`apps/ai-service`):

- `EnrichContactRequest`: thêm `user_email_domain: Optional[str]`.
- `EnrichContactResponse`: thêm `category_suggestion: Optional[str]`.
- `GeminiContactEnrichClient` updated:
  - Step 0 (fast path): same-domain email → `category_suggestion = "colleague"`, skip Gemini.
  - Step 1 (domain fallback): known corporate domain → `category_suggestion = "third_party"`, personal domain → `None`.
  - Step 2 (Gemini): prompt updated to return `category_suggestion` field.
  - `valid_categories = {"colleague", "customer", "third_party", "spam"}` validation.

Backend:

- `Contact` model: fields `category`, `categorySource`, `categoryAiSuggestion` (xem schema bên dưới).
- `contacts/[contactId]/enrich/route.ts`: derives `userEmailDomain = session.user.email.split("@")[1]`, passes to `aiService.enrichContact()`, saves `categoryAiSuggestion` khi AI trả về và `categorySource !== "user"`.

Frontend (`contacts/[id]/page.tsx`):

- `CATEGORY_LABELS` + `CATEGORY_CHIP_STYLE` constants.
- `suggestionDismissed` state (session-local).
- `handleConfirmCategory(category)`: PATCH `{ category, categorySource: "user", categoryAiSuggestion: null }` → mutate + toast + dismiss.
- `handleDismissSuggestion()`: local dismiss ngay + PATCH xóa `categoryAiSuggestion`.
- **AI suggestion banner** (violet card): hiển thị khi `categoryAiSuggestion && categorySource !== "user" && !suggestionDismissed`; buttons "Confirm" + "Dismiss".
- **Category chip badge** trong profile header: hiển thị current `contact.category` với "· confirmed" suffix khi `categorySource === "user"`.

### Phase 5 — UI Polish ✅ IMPLEMENTED

**Frontend only.**

1. **Sidebar live unread-count badge** (`layout.tsx` + `hooks/useUnreadCount.ts`):
   - `useUnreadCount` hook: SWR poll `/api/threads?filter=unread&limit=1` mỗi 60s, trả `total`.
   - Indigo pill badge trên Email nav item (hiện "99+" khi > 99).

2. **Fixed read/unread toggle icons** (`ThreadList.tsx`):
   - Thread unread → hover = checkmark icon (action = mark read).
   - Thread read → hover = envelope icon (action = mark unread).
   - Trước đây cả 2 render cùng SVG path (bug).

3. **Thread detail urgent badge** (`threads/[id]/page.tsx`):
   - `🔴 Urgent` chip + "AI classified X ago" timestamp trong thread header.

4. **Sender name → contacts linkify** (`threads/[id]/page.tsx`):
   - Parse email address từ `msg.from`; wrap display name trong `<Link href="/contacts?q=email">`.
   - Enables one-click navigation từ email message sang contact record.

5. **Contacts page search bar + `?q=` URL param** (`contacts/page.tsx`):
   - Full-width search input với clear button, wired tới `useContacts` `setSearch`.
   - On mount: reads `?q=` từ URL (via `useSearchParams`) → pre-populates search.
   - Empty state context-aware: "No contacts matching 'X'" khi đang search.

### Phase 1 — Dashboard Shell (UI Redesign) ✅ IMPLEMENTED

Route structure (Next.js App Router route group `(dashboard)`):

| File                                     | URL              | Notes                                                              |
| ---------------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `app/page.tsx`                           | `/`              | Login only — Google OAuth button, redirects to `/inbox` after auth |
| `app/(dashboard)/layout.tsx`             | —                | Sidebar wrapper + auth guard (redirect `/` if unauthenticated)     |
| `app/(dashboard)/inbox/page.tsx`         | `/inbox`         | Inbox page (moved from old `app/page.tsx`)                         |
| `app/(dashboard)/contacts/page.tsx`      | `/contacts`      | Same URL as before                                                 |
| `app/(dashboard)/contacts/[id]/page.tsx` | `/contacts/[id]` | Same URL as before                                                 |
| `app/(dashboard)/threads/[id]/page.tsx`  | `/threads/[id]`  | Same URL as before                                                 |

`app/(dashboard)/layout.tsx` (Sidebar):

- Fixed sidebar 224px (`w-56`), indigo branding, logo "EmailHub".
- Nav items: **Email** (`/inbox`) + **Contacts** (`/contacts`), active state highlighted indigo.
- Active detection: `/threads/*` also highlights "Email" nav.
- Bottom: user avatar (Google image or initials) + name + email + Sign out button.
- Auth guard: `useEffect` on `status === "unauthenticated"` → `router.replace("/")`.

Login page (`app/page.tsx`):

- Clean centered card with EmailHub logo.
- Google sign-in button (SVG color logo).
- On `authenticated` → `router.replace("/inbox")`.
- `signIn("google", { callbackUrl: "/inbox" })`.

Individual pages:

- Removed old `← Inbox` / `← Contacts` nav buttons from page headers.
- Removed `min-h-screen` `<main>` wrapper → pages now use `div` fitting within sidebar layout.
- Inbox topbar: sticky header with "Inbox" title + Sync + Compose buttons.
- Contacts topbar: sticky header with "Contacts" title + count badge + Check duplicates + Add Contact.

### Authentication (NextAuth v4)

- Google OAuth provider in `apps/backend/src/lib/auth.ts`.
- On sign-in: upsert `User` in MongoDB with `googleId`, `email`, `name`, `image`, `accessToken`, `refreshToken`.
- `jwt` callback:
  - Stores `accessToken`, `refreshToken`, `expiresAt` in JWT on initial sign-in.
  - Auto-refreshes Google access token when within 5 min of expiry via `https://oauth2.googleapis.com/token`.
  - Sets `token.error = "RefreshTokenError"` if refresh fails.
  - Loads `User._id` from MongoDB and stores as `token.id`.
- `session` callback: exposes `session.user.id` (MongoDB `_id`) and propagates `session.error`.
- Frontend (`apps/frontend/src/app/page.tsx`): `session.error === "RefreshTokenError"` → shows toast + sign-out.
- `apps/backend/src/types/next-auth.d.ts` extends types with `id`, `error` on `Session` and `JWT`.

**Google Cloud Console required config:**

- Authorized JavaScript origins: `http://localhost:3000`, `http://localhost:4000`
- Authorized redirect URIs: `http://localhost:4000/api/auth/callback/google`

### FR-01 – Email Sync

`GmailService` (`apps/backend/src/modules/email/gmail.service.ts`):

- `syncEmails(pageToken?)`: fetches up to 50 threads per call using `users.threads.list`.
- Extracts `participants` (From + To headers), `subject`, `snippet` (fallback to last `msg.snippet`).
- Upserts `Thread` and `Message` documents (idempotent).
- Stores `nextPageToken` in `User.gmailNextPageToken`; sets `gmailSyncComplete = true` when done.
- Returns `{ syncedMessages, nextPageToken, hasMore }`.
- **Performance fix**: thread fetches run in parallel batches of 10 via `Promise.allSettled` (was sequential for-loop over 50 threads). Inner `Message.findOneAndUpdate` calls per thread also parallelized. Contact upsert is fire-and-forget (non-blocking).
- **Architecture note**: Gmail Pub/Sub webhook (< 5s push) is the production target per thesis FR-01 requirement. PoC dùng manual sync trigger do hạn chế setup local (cần public HTTPS URL). Architecture đã được thiết kế để thêm webhook handler sau này mà không cần refactor.

API routes:

- `POST /api/emails/sync` – body `{ pageToken? }` → calls `syncEmails(pageToken)`. Auth errors → 401.
- `GET /api/emails/sync` – returns `{ hasMore, nextPageToken, syncComplete }` from User record.

`SyncButton` (`apps/frontend/src/components/SyncButton.tsx`):

- On mount: `GET /api/emails/sync` to preload `hasMore` / `nextPageToken`.
- Button text: `"Syncing..."` / `"Sync More Emails"` / `"Sync Inbox"`.
- Auto-retry once on network error (2s delay). Auth errors handled by axios interceptor.
- Success/error feedback via `useToast()`.

**Auto-sync on load**: `apps/frontend/src/app/page.tsx` fires `POST /api/emails/sync` automatically on first authenticated session load via `useEffect` + `useRef` guard (fires once only).

### FR-04 – Inbox / Timeline

`TimelineService` (`apps/backend/src/modules/timeline/timeline.service.ts`):

- `getThreads(userId, limit=20, cursor?)`: cursor-based pagination using composite key `"lastMessageDate_id"`.
- `getThreadDetails(userId, threadId)`: trả về thread + toàn bộ messages.
- Returns `PaginatedThreadsResult { threads, total, hasNext, hasPrev }`.

API routes:

- `GET /api/threads?limit=&cursor=` – paginated thread list.
- `GET /api/threads/[threadId]` – single thread + messages.

`useThreads` hook (`apps/frontend/src/hooks/useThreads.ts`):

- SWR-based, manages `cursor` state.
- `ThreadDTO` bao gồm `isRead?: boolean`, `isArchived?: boolean`.
- Exposes `{ threads, total, hasNext, hasPrev, currentPage, goToNextPage, goToPrevPage, mutate }`.

`ThreadList` (`apps/frontend/src/features/inbox/ThreadList.tsx`):

- Gmail-style pagination header: `"1–20 of 1,234"` + ← Newer / Older → buttons.
- Sender từ `thread.participants[0]` (strips `<email>` nếu có display name).
- Unread dot màu indigo + sender/subject hiện **bold** khi `isRead === false`.
- Hover hover-group hiện 2 action icon: toggle read/unread, archive — cả hai dùng **optimistic UI** với `mutate()` revert on error.
- Snippet preview; relative time via `date-fns`.

### FR-06 – AI-Assisted Contact Management ✅ IMPLEMENTED

Backend models:

- `Contact` (`apps/backend/src/models/Contact.ts`): `email`, `name`, `org`, `language`, `alternateEmails[]`, `userId`, `aiEnriched`, `enrichedAt?` (Date — ghi lại thời điểm enrich lần cuối), `mergedInto?`.

`ContactService` (`apps/backend/src/modules/contacts/contact.service.ts`):

- `upsertParticipants(userId, emails[])` — called after each `syncEmails` (fire-and-forget), idempotent.
- `getContacts(userId)`, `getContact(userId, contactId)`, `mergeContacts(userId, sourceId, targetId)`.
- `getContactTimeline(userId, contactId)` — threads where any of `[email, ...alternateEmails]` appears in `participants`.
- `getContactsForMergeSuggestions(userId)` — **2 DB queries thay vì N+1**: fetch contacts (max 100) + bulk fetch 300 recent threads, match in memory → trả `ContactSnippetDTO[]` với `sample_threads` thực.
- `updateContact(userId, contactId, fields)` — hỗ trợ cả `enrichedAt` trong fields.

`ContactSnippetDTO` interface: `{ contact_id, email, name?, alternate_emails[], sample_threads[] }`.

API routes:

- `GET /api/contacts` – list contacts.
- `POST /api/contacts` – create manually.
- `GET /api/contacts/[contactId]` – single contact (bao gồm `enrichedAt`).
- `GET /api/contacts/[contactId]/timeline` – email timeline for this contact.
- `POST /api/contacts/[contactId]/enrich` – **có guard**: nếu `aiEnriched=true` → trả `{ contact, cached: true }` (200 OK) ngay, không gọi AI. Append `?force=true` để force re-enrich. Khi enrich thành công, lưu cả `enrichedAt: new Date()`.
- `GET /api/contacts/merge-suggestions` – **Redis cache 6h** (key `contact:merge_suggestions:{userId}`). Append `?refresh=true` để bypass cache. Dùng `getContactsForMergeSuggestions()` với `sample_threads` thực. Trả `{ suggestions, fromCache: true }` khi hit cache.
- `POST /api/contacts/merge` – body `{ sourceId, targetId }`, soft-merges (sets `mergedInto`). **Sau khi merge thành công, xóa Redis cache** `contact:merge_suggestions:{userId}`.

AI Service (`apps/ai-service`):

- `POST /enrich-contact` – `{ email, name?, conversation_snippet? }` → `{ display_name, org, language }`.
- `POST /suggest-merge` – `{ contacts[] }` (capped **100**, tăng từ 50) → `[{ source_id, target_id, confidence, reason }]`.
- `GeminiContactEnrichClient` + `GeminiMergeSuggestionClient` trong `core/llm_client.py`.
- `apps/ai-service/models/contact.py` — Pydantic models: `EnrichContactRequest`, `EnrichContactResponse`, `ContactSnippet`, `MergeSuggestion`.
- `apps/ai-service/routes/contact.py` — `/enrich-contact` + `/suggest-merge` routes.

Frontend:

- `apps/frontend/src/app/contacts/page.tsx` — danh sách contacts + merge suggestion banner (Dismiss / Merge buttons).
- `apps/frontend/src/app/contacts/[id]/page.tsx` — contact detail + email timeline + "Enrich with AI" button. ✅ IMPLEMENTED

AI Service (`apps/ai-service`):

- `POST /summarize` → `{ summary, key_issues, action_required }` via `GeminiSummarizationClient`.
- **Always responds in Vietnamese** (`_LANG_INSTRUCTION` constant instructs Gemini to translate output into Vietnamese regardless of email language).
- Token safety: each message body truncated to 1,500 chars; total content capped at 12,000 chars via `_truncate()` + `_build_messages_text()`.
- JSON markdown code block stripping for Gemini response.

Backend:

- `AIService.summarizeThread()` (`apps/backend/src/modules/ai/ai.service.ts`) — gọi AI service via axios.
- `POST /api/threads/[threadId]/summarize` → lưu result vào `thread.summary` trong MongoDB, emits `SUMMARY_READY` socket event.

Frontend:

- `AISummaryCard` (`apps/frontend/src/components/AISummaryCard.tsx`):
  - Shows `"Summarize this Thread"` button khi `!summary || !summary.text`.
  - Hiển thị summary (Vietnamese) + key issues + action items khi có kết quả.
  - `"Regenerate"` link để re-trigger.

### FR-02 – Compose + Send ✅ IMPLEMENTED (Rich Text + Attachments)

`GmailService` (`apps/backend/src/modules/email/gmail.service.ts`):

- `sendEmail({ to, subject, htmlBody, attachmentIds? })`: RFC 2822 MIME encode (HTML body) → `users.messages.send` → upsert Thread + Message vào MongoDB.
- Attachment support: `POST /api/emails/attachments` nhận multipart/form-data, lưu tạm trong `uploads/`, trả về `attachmentId`. `sendEmail` đính kèm file trước khi gửi.

API routes:

- `POST /api/emails/send` – body `{ to, subject, htmlBody, threadId?, attachmentIds? }`.
- `POST /api/emails/attachments` – multipart upload, trả về `{ attachmentId, filename, size }`.

Frontend:

- `ComposeDrawer` (`apps/frontend/src/components/ComposeDrawer.tsx`): Tiptap rich text editor (bold, italic, bullet, blockquote, link) + file picker + attachment chips. ESC + backdrop close. `htmlBody` gửi HTML string từ Tiptap thay vì plain text.

`GmailService` (`apps/backend/src/modules/email/gmail.service.ts`):

- `markRead(gmailThreadId, read)`: add/remove `UNREAD` Gmail label + update `Thread.isRead` trong DB.
- `archiveThread(gmailThreadId)`: remove `INBOX` label + set `Thread.isArchived = true`.
- `sendEmail({ to, subject, body, threadId? })`: RFC 2822 MIME encode → `users.messages.send` → upsert Thread + Message vào MongoDB.

API routes:

- `PATCH /api/threads/[threadId]/read` – body `{ read: boolean }`.
- `PATCH /api/threads/[threadId]/archive`.
- `POST /api/emails/send` – body `{ to, subject, body, threadId? }`.

Frontend:

- `ComposeDrawer` (`apps/frontend/src/components/ComposeDrawer.tsx`): bottom slide-up drawer, ESC + backdrop close, gọi `POST /api/emails/send`, hiển thị error inline.
- Inbox `page.tsx`: nút "Compose" (indigo, + icon) → `setComposeOpen(true)` → mở `ComposeDrawer`.
- Thread detail `page.tsx`: nút "Reply" → mở `ComposeDrawer` pre-filled `to`, `subject`, `replyToThreadId`. `useEffect` auto-marks thread as read khi component mount.

### FR-08 – Smart Reply Suggestions ✅ IMPLEMENTED

AI Service (`apps/ai-service`):

- `POST /suggest-reply` → `{ thread_id, format, replies: [{ subject, body }] }` via `GeminiReplyClient`.
- Accepts `format: "email" | "message"` (default `"message"`).
  - `email` format: full RFC 2822-style reply with greeting, content, sign-off, and subject line.
  - `message` format: short conversational reply (1–3 sentences, no formal greeting).
- **Always responds in Vietnamese** (shared `_LANG_INSTRUCTION`).
- Token safety: `conversation_context` capped at 400 chars, `latest_message.text` capped at 1,500 chars.
- JSON array output `[{"subject": ..., "body": ...}]`; plain-text fallback parser for non-JSON Gemini responses.

Backend:

- `AIService.suggestReplies(threadId, latestMessage, context?, maxReplies, format)` — returns `{ format, replies: ReplyItem[] }`.
- `ReplyItem` interface: `{ subject: string | null; body: string }`. Exported from `ai.service.ts`.
- `POST /api/threads/[threadId]/suggest-reply` — accepts `{ format? }` in body, resolves thread+messages from DB, returns `{ threadId, format, replies[] }`.

Frontend:

- `SmartReplyBar` (`apps/frontend/src/components/SmartReplyBar.tsx`):
  - Format toggle header: `💬 Message` / `✉ Email`.
  - **Message format**: compact chip buttons showing `reply.body`.
  - **Email format**: expanded cards with Subject + body preview + "Use this reply" button.
  - `onSelect(reply: ReplyItem)` callback.
- Thread detail `page.tsx`:
  - `subjectOverride` state: khi user chọn email-format reply có subject, `ComposeDrawer` dùng subject đó thay vì `Re: <original>`.
  - `handleSelectReply(reply: ReplyItem)` pre-fills both `initialBody` và `subjectOverride`.

### FR-05 – WebSocket Realtime

Custom server (`apps/backend/server.ts`):

- Tạo `http.createServer` wrapper quanh Next.js `getRequestHandler()`.
- Attach `Socket.IO` server với `path: "/socket.io"`, CORS từ `FRONTEND_URL`.
- Kết nối Redis adapter (`@socket.io/redis-adapter`) → hỗ trợ multi-instance broadcasting.
- Lưu `io` instance vào `global.__io` để API routes truy cập.
- Client gửi event `join(userId)` → join room `user:<userId>`.

Helper (`apps/backend/src/lib/socketServer.ts`):

- `getIO()`: đọc `global.__io`.
- `emitToUser(userId, event, payload)`: emit về room `user:<userId>`, silent nếu `io` chưa init.

Backend routes emit events:

| Event           | Route                                    | Payload              |
| --------------- | ---------------------------------------- | -------------------- |
| `EMAIL_SYNCED`  | `POST /api/emails/sync`                  | `{ count, hasMore }` |
| `SUMMARY_READY` | `POST /api/threads/[threadId]/summarize` | `{ threadId }`       |
| `EMAIL_SENT`    | `POST /api/emails/send`                  | `{ threadId }`       |

Frontend hook (`apps/frontend/src/hooks/useSocket.ts`):

- Singleton socket kết nối trực tiếp `NEXT_PUBLIC_BACKEND_SOCKET_URL` (baked tại build time).
- `useSocket(userId, listeners)`: join room khi connect **và** reconnect (fixed: trước đây chỉ join khi `connect`, bỏ sót `reconnect` event → room bị mất sau ngắt kết nối).
- `useBackgroundSync(cb, intervalMs, enabled)`: polling fallback mỗi 60s để revalidate SWR cache phòng trường hợp socket event bị miss.

Frontend wiring:

- `apps/frontend/src/app/page.tsx`: `EMAIL_SYNCED` → `mutate(/api/threads/*)` + toast (chỉ khi `count > 0`). `NEW_THREAD` + `EMAIL_SENT` → mutate. `useBackgroundSync` 60s fallback.
- `apps/frontend/src/app/threads/[id]/page.tsx`: `SUMMARY_READY` (match threadId) → `mutate()` refresh AISummaryCard.

Dockerfile backend:

- Không còn `output: "standalone"`.
- Build stage: `npm run build` = `next build && tsc -p tsconfig.server.json` → `dist-server/server.js`.
- Runner: copy đủ `node_modules`, `.next`, `dist-server/server.js` → `CMD ["node", "server.js"]`.

### Toast Notification System

- `Toast.tsx` (`apps/frontend/src/components/Toast.tsx`): `ToastProvider` + `useToast()` hook.
- Slide-in animation, auto-dismiss 5s, types: `success | error | info`.
- Wrapped in `apps/frontend/src/app/layout.tsx`.

### Auth Error Handling (Frontend)

- `apps/frontend/src/lib/api.ts` axios response interceptor:
  - 401 → `signOut({ redirect: false })` + `window.location.href = "/"`.
  - 403 → rejects with `isForbiddenError: true`.

---

## Architecture & Key Decisions

### Docker / Build

- Each app has its **own build context** (`apps/frontend`, `apps/backend`, `apps/ai-service`). No cross-references.
- **Base images**: `node:22-alpine` (frontend, backend), `python:3.12-alpine` (ai-service) — Node 22 LTS + Alpine để giảm CVEs.
- **Frontend Dockerfile**: multi-stage, `output: "standalone"` → `node server.js`. `ARG BACKEND_INTERNAL_URL` + `ARG NEXT_PUBLIC_BACKEND_SOCKET_URL` baked tại build time.
- **Backend Dockerfile**: multi-stage, **không dùng `output: "standalone"`** — dùng custom `server.ts` (socket.io). Builder compile `server.ts` → `dist-server/server.js` via `tsc -p tsconfig.server.json`. Runner copy `node_modules` + `.next` + `dist-server/server.js`.
- **AI Service Dockerfile**: multi-stage alpine — builder stage cài `gcc`/`musl-dev` để compile C extensions (`uvloop`, `httptools`); runner stage sạch chỉ nhận `/install`, không giữ build tools.
- `curl` installed trong backend và ai-service runner images cho Docker healthchecks.
- `depends_on` với `condition: service_healthy` cho đúng start order.

### Production Runtime Fixes Applied

| File                                 | Issue                                                                                      | Fix                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------- | --------------------------------- |
| `src/lib/axiosClient.ts`             | Top-level `throw` failed Next.js build-time page collection                                | `                                             |            | 'http://localhost:5000'` fallback |
| `src/lib/db.ts`                      | Same top-level `throw` for `MONGO_URI`                                                     | Moved validation inside `connectToDatabase()` |
| `src/lib/logger.ts`                  | `pino-pretty` uses worker threads, crashes in production bundled builds                    | Only loaded when `NODE_ENV === 'development'` |
| `src/modules/email/gmail.service.ts` | `nextPageToken` typed `string                                                              | null                                          | undefined` | `?? undefined` coercion           |
| `src/models/User.ts`                 | `gmailNextPageToken`, `gmailSyncComplete` in TS interface but missing from Mongoose schema | Added to schema                               |

### Frontend → Backend Proxy

`apps/frontend/next.config.ts` rewrites:

- Docker: `BACKEND_INTERNAL_URL=http://backend:4000` (build arg in Dockerfile)
- Local dev: falls back to `http://localhost:4000`

### Required `.env` values

`apps/backend/.env`:

```
PORT=4000
NEXTAUTH_URL=http://localhost:4000
NEXTAUTH_SECRET=<secret>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
MONGO_URI=mongodb://localhost:27017/emailhub   # overridden to mongo:27017 by docker-compose
REDIS_URL=redis://localhost:6379               # overridden to redis:6379 by docker-compose
AI_SERVICE_URL=http://localhost:5000           # overridden to ai-service:5000 by docker-compose
```

`apps/frontend/.env`:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<same as backend>
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

`apps/ai-service/.env`:

```
GEMINI_API_KEY=<key>
GEMINI_MODEL_NAME=gemini-2.0-flash
```

---

## Database Schema

### User (`apps/backend/src/models/User.ts`)

| Field                    | Type    | Notes                         |
| ------------------------ | ------- | ----------------------------- |
| `email`                  | String  | required, indexed             |
| `name`                   | String  | optional                      |
| `image`                  | String  | optional                      |
| `googleId`               | String  | required, unique              |
| `accessToken`            | String  | latest Google access token    |
| `refreshToken`           | String  | for token refresh + Gmail API |
| `gmailNextPageToken`     | String  | null when fully synced        |
| `gmailSyncComplete`      | Boolean | true when no more Gmail pages |
| `createdAt`, `updatedAt` | Date    | Mongoose timestamps           |

### Thread (`apps/backend/src/models/Thread.ts`)

| Field                    | Type     | Notes                                       |
| ------------------------ | -------- | ------------------------------------------- |
| `id`                     | String   | Gmail thread ID, required, unique           |
| `userId`                 | ObjectId | ref: User                                   |
| `historyId`              | String   | Gmail history marker                        |
| `snippet`                | String   | preview text                                |
| `lastMessageDate`        | Date     | for sorting + pagination cursor             |
| `participants`           | String[] | From + To across all messages               |
| `subject`                | String   | first message Subject header                |
| `summary`                | Object   | `{ text, key_issues[], action_required[] }` |
| `isRead`                 | Boolean  | default false                               |
| `isArchived`             | Boolean  | default false                               |
| `isUrgent`               | Boolean  | default false — set by AI urgent classifier |
| `urgentClassifiedAt`     | Date     | timestamp of last urgent classification     |
| `createdAt`, `updatedAt` | Date     | Mongoose timestamps                         |

### Contact (`apps/backend/src/models/Contact.ts`)

| Field                    | Type     | Notes                                                                                 |
| ------------------------ | -------- | ------------------------------------------------------------------------------------- |
| `email`                  | String   | primary email, required, unique per userId                                            |
| `userId`                 | ObjectId | ref: User                                                                             |
| `name`                   | String   | display name (AI-inferred or user-set)                                                |
| `org`                    | String   | organisation / company                                                                |
| `language`               | String   | preferred language (e.g. "vi", "en")                                                  |
| `alternateEmails`        | String[] | alias addresses, default `[]`                                                         |
| `aiEnriched`             | Boolean  | default false — true after successful AI enrichment                                   |
| `enrichedAt`             | Date     | timestamp of last AI enrichment                                                       |
| `mergedInto`             | ObjectId | ref: Contact — set when soft-merged                                                   |
| `category`               | String   | enum: `colleague \| customer \| third_party \| spam \| unknown` (default `"unknown"`) |
| `categorySource`         | String   | enum: `rule \| ai \| user` (default `"rule"`)                                         |
| `categoryAiSuggestion`   | String   | latest AI category suggestion pending user confirmation                               |
| `createdAt`, `updatedAt` | Date     | Mongoose timestamps                                                                   |

### Message (`apps/backend/src/models/Message.ts`)

| Field                    | Type     | Notes                              |
| ------------------------ | -------- | ---------------------------------- |
| `id`                     | String   | Gmail message ID, required, unique |
| `threadId`               | ObjectId | ref: Thread                        |
| `userId`                 | ObjectId | ref: User                          |
| `from`                   | String   | raw From header                    |
| `to`                     | String[] | parsed To header                   |
| `subject`                | String   | Subject header                     |
| `body`                   | String   | decoded HTML or text               |
| `snippet`                | String   | Gmail message snippet              |
| `date`                   | Date     | from `internalDate`                |
| `labelIds`               | String[] | Gmail label IDs                    |
| `createdAt`, `updatedAt` | Date     | Mongoose timestamps                |

---

## Known Issues / Next Steps

**FR hoàn thành (theo thesis)**: FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08.

**FR đang pending**:

| FR    | Description                                                       | Plan       |
| ----- | ----------------------------------------------------------------- | ---------- |
| FR-09 | Multi-channel: abstract `IChannelAdapter` + Telegram Bot (grammy) | Tạm bỏ qua |

**AI improvements (tất cả implemented)**:

| Improvement               | Detail                                                                                                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token truncation          | `_truncate()` helper; 1,500 chars/message, 12,000 chars total, 400 chars snippets                                                                                                                                                                                                  |
| Vietnamese output         | `_LANG_INSTRUCTION` trong summarize + reply prompts — luôn dịch sang tiếng Việt                                                                                                                                                                                                    |
| Smart reply format        | `format: "email"\|"message"` xuyên suốt full stack: AI → backend → frontend                                                                                                                                                                                                        |
| Duplicate class fix       | `llm_client.py` đã xóa các duplicate class definitions                                                                                                                                                                                                                             |
| Enrich guard              | `POST /enrich`: nếu `aiEnriched=true` → trả cached (200 OK), không gọi AI. `?force=true` để re-enrich. Lưu `enrichedAt` date                                                                                                                                                       |
| Merge cache               | `GET /merge-suggestions`: Redis cache 6h (key `contact:merge_suggestions:{userId}`). `?refresh=true` để bypass                                                                                                                                                                     |
| Merge sample_threads      | `getContactsForMergeSuggestions()`: 2 DB queries, truyền `sample_threads` thực vào AI thay vì `[]`                                                                                                                                                                                 |
| Merge cap fix             | AI service `contacts[:100]` (tăng từ 50); backend gửi tối đa 100 contacts (không còn leak 150 records)                                                                                                                                                                             |
| Merge cache invalidate    | `POST /merge` xóa Redis cache sau khi merge thành công                                                                                                                                                                                                                             |
| Domain fallback           | `_DOMAIN_MAP` trong `llm_client.py`: 50+ domains phổ biến (VN universities, corporates, international) → skip Gemini hoàn toàn. `.vn` TLD → `language="vi"`. Personal domain (gmail...) không có snippet → skip Gemini                                                             |
| 429 retry backoff         | `_gemini_with_retry()`: exponential backoff 1s→2s→4s, max 3 lần khi gặp 429. Áp dụng cho tất cả Gemini clients                                                                                                                                                                     |
| **AI urgent classifier**  | **`GeminiUrgentClassifier`**: keyword fast-path (no Gemini call) + Gemini fallback, fire-and-forget from gmail sync. `isUrgent` + `urgentClassifiedAt` persisted trên Thread                                                                                                       |
| **Category suggestion**   | **`GeminiContactEnrichClient`** (updated): same-domain → "colleague" fast-path; domain fallback returns `category_suggestion`; Gemini prompt returns `category_suggestion`. Saved to `categoryAiSuggestion` in Contact. User can Confirm (sets `categorySource="user"`) or Dismiss |
| Contact detail UI         | `contacts/[id]/page.tsx` redesign: 2-col `InfoRow` grid, inline edit mode, category chip badge, AI suggestion banner (violet), enrichment badges                                                                                                                                   |
| Frontend ContactDTO       | `useContacts.ts`: thêm `enrichedAt?`, `category`, `categorySource`, `categoryAiSuggestion?` vào interface `ContactDTO`                                                                                                                                                             |
| **Sidebar unread badge**  | `useUnreadCount` hook polls mỗi 60s; indigo pill badge trên Email nav item (max "99+")                                                                                                                                                                                             |
| **Read/unread icon fix**  | ThreadList hover buttons: unread → checkmark icon, read → envelope icon (trước đây cả 2 cùng SVG)                                                                                                                                                                                  |
| **Sender linkify**        | Thread detail message cards: `msg.from` email address extracted, display name wrapped in `<Link href="/contacts?q=email">`                                                                                                                                                         |
| **Contacts search + URL** | Contacts page có search bar + pre-populates từ `?q=` URL param; wired tới `useContacts` `setSearch`                                                                                                                                                                                |

**Quyết định kiến trúc**:

- FR-01 Gmail Pub/Sub webhook: không implement trong PoC (cần public HTTPS + Google Cloud setup). Architecture sẵn sàng thêm webhook handler sau.
- FR-09 channel được chọn: **Telegram Bot** (grammy) — free, không cần approval, TypeScript SDK tốt. Tạm bỏ qua.
- AI Urgent Classification là **enhancement không thuộc FR riêng** — mở rộng của FR-04/FR-06 giúp trang inbox ưu tiên email quan trọng.
- Contact Category Suggestion là **extension của FR-06** — human-in-the-loop: AI đề xuất, user confirm/dismiss.

---

## Session: 6 UX & Bug-Fix Improvements ✅ IMPLEMENTED

### 1 — Fix Vietnamese Contact Name Encoding (RFC 2047)

**Root cause**: Gmail API trả về display names trong email headers dưới dạng RFC 2047 encoded (e.g., `=?UTF-8?B?VGjhu4tuaCBOZ8O...?=` hoặc `=?UTF-8?Q?Th=E1=BB=8Bnh_Ng=C3=B4?=`). Node.js không tự decode, dẫn đến tên contact hiển thị sai (ví dụ "ThÃ¡Â»Â‹nh" thay vì "Thịnh").

**Fix** (display only, DB data không bị ảnh hưởng):

`apps/backend/src/modules/contacts/contact.service.ts`:
- Thêm function `decodeRfc2047(str: string): string` trước `parseEmailAddress()`.
  - Xử lý `=?charset?B?base64?=` → `Buffer.from(text, 'base64').toString('utf8')`.
  - Xử lý `=?charset?Q?quoted-printable?=` → decode `_` → space, `=XX` → hex byte.
  - Hỗ trợ nhiều encoded-word liên tiếp trong cùng một string.
- `parseEmailAddress(raw)` gọi `decodeRfc2047(raw)` trước khi regex parse.

Fix áp dụng **forward** — contacts sync sau session này sẽ có tên đúng. Không cần migration DB (user confirm).

---

### 2 — Remove Urgent Filter Tab (Keep Per-Thread Badge)

`apps/frontend/src/hooks/useThreads.ts`:
- `ThreadFilter` type: xóa `"urgent"` → `"all" | "unread" | "archived"`.

`apps/frontend/src/features/inbox/ThreadList.tsx`:
- `FILTER_TABS`: xóa `{ value: "urgent", label: "🔴 Urgent" }`.
- Empty state ternary: xóa nhánh `filter === "urgent" ? "No urgent emails"`.

Per-thread `🔴 Urgent` chip trong thread row **giữ nguyên** (không thay đổi).

---

### 3 — Global AI Process Toast Notifications via Socket.IO

**Pattern**: mỗi AI call emit `AI_JOB_START` khi bắt đầu + `AI_JOB_DONE` khi kết thúc; frontend global listener hiển thị toast.

**Backend — files emit events:**

`apps/backend/src/modules/email/gmail.service.ts`:
- Import `emitToUser` từ `socketServer`.
- Trước `clusterThreadsIntoTopics()`: emit `AI_JOB_START { jobId: "topic-pipeline-{ts}", label: "Organizing N thread(s) into topics…" }`.
- Sau chuỗi `.then(labelUnlabeledTopics).then(scoreAllTopics)`: emit `AI_JOB_DONE { jobId, label: "Topics organized and scored", success: true }`.
- `.catch()`: emit `AI_JOB_DONE { success: false, label: "Topic pipeline failed" }`.

`apps/backend/src/app/api/contacts/[contactId]/enrich/route.ts`:
- Import `emitToUser`.
- `jobId = "enrich-{contactId}-{ts}"`.
- Emit `AI_JOB_START { label: "Enriching contact…" }` → call AI → `AI_JOB_DONE { label: "Contact enriched: {name}", success: true }` hoặc `success: false` khi lỗi.

`apps/backend/src/app/api/contacts/bulk-enrich/route.ts`:
- Import `emitToUser`.
- `bulkJobId = "bulk-enrich-{ts}"`.
- Emit `AI_JOB_START { label: "Enriching N contact(s)…" }` → loop → `AI_JOB_DONE { label: "Enriched X of N…", success: failed === 0 }`.

**Frontend — global listener:**

`apps/frontend/src/app/(dashboard)/layout.tsx`:
- Import `useRef`, `useSocket`, `useToast`.
- Extract `userId` từ `session?.user as any)?.id`.
- `aiJobToastMap = useRef<Record<string, string>>({})` — map `jobId → toastId`.
- `useSocket(userId, { AI_JOB_START, AI_JOB_DONE })`:
  - `AI_JOB_START({ jobId, label })` → `showToast(label, "processing")` → lưu `toastId` vào map.
  - `AI_JOB_DONE({ jobId, label, success })` → `updateToast(toastId, label, success ? "success" : "info")` → xóa khỏi map.
- `"processing"` type: không auto-dismiss. Success/info types: auto-dismiss 4s.

**Toast system** (`Toast.tsx`): thêm `"processing"` type — spinner icon, không auto-dismiss, màu slate.

---

### 4 — Contacts "Verify" Tab (Bulk Categorize Uncategorized Contacts)

**Backend:**

`apps/backend/src/modules/contacts/contact.service.ts`:
- Thêm `getUnverifiedContacts(userId, limit=200, skip=0)`:
  - Query: `{ categorySource: { $ne: 'user' }, $or: [{ categories: { $size: 0 } }, { categories: { $exists: false } }], mergedInto: { $exists: false } }`.
  - Sort: `name asc`.
  - Returns `ContactDTO[]`.

`apps/backend/src/app/api/contacts/route.ts`:
- Thêm `?unverified=true` param → gọi `service.getUnverifiedContacts()` thay vì `service.getContacts()`.

**Frontend:**

`apps/frontend/src/app/(dashboard)/contacts/page.tsx`:
- `useUnverifiedContacts()` hook: SWR trên `/api/contacts?unverified=true&limit=200`.
- `mainTab: "directory" | "verify"` state với tab switcher trong header.
- Amber badge trên "Verify" tab hiển thị số lượng chưa verify (sau khi trừ dismissed).
- `dismissedIds: Set<string>` — optimistic skip (không gọi API).
- `VerifyContactRow` component:
  - Hiển thị avatar + tên + email.
  - Category toggle chips (pre-selected từ `categoryAiSuggestion` nếu có).
  - **"AI" button**: chỉ hiển thị nếu `!contact.aiEnriched && !contact.categoryAiSuggestion` → gọi `POST /api/contacts/:id/enrich` → refresh row với suggestion mới.
  - **"Confirm"** button: `PATCH /api/contacts/:id { categories, category, categorySource: "user" }` → dismiss row.
  - **"Skip"** button: thêm vào `dismissedIds` (optimistic).

---

### 5 — Replace Score Numbers with Priority Labels

**New component:**

`apps/frontend/src/components/PriorityBadge.tsx` — **NEW**:
- `scoreToPriority(score?: number): PriorityLevel`:
  - `score >= 120` → `"critical"` (red)
  - `score >= 60` → `"high"` (amber)
  - `score >= 20` → `"medium"` (indigo)
  - else → `"low"` (slate)
- `PriorityBadge({ score, className? })`: colored bordered pill với level name (e.g., "⚡ critical", "↑ high", "→ medium", "↓ low").
- Exports: `PriorityLevel` type, `scoreToPriority` function, `PriorityBadge` component (default export).

**Files updated:**

`apps/frontend/src/features/focus/FocusTopicCard.tsx`:
- Xóa `ScoreBar` component.
- Import + render `<PriorityBadge score={topic.focusScore} />`.

`apps/frontend/src/features/contacts/ContactTopicGroup.tsx`:
- Xóa `ScoreChip` component.
- Import + render `<PriorityBadge score={topic.focusScore} />`.

`focusScore` vẫn được lưu trong DB và dùng để sort — chỉ thay đổi display layer.

---

### 6 — Filter Spam & Noreply from Focus Page

`apps/backend/src/modules/topics/topic.service.ts` — `getFocusTopics()` aggregate pipeline:
- Thêm `{ $limit: limit * 3 }` **trước** `$lookup` contact (để có đủ topics sau khi filter).
- Sau `$addFields _contactDoc`, thêm `$match`:
  ```js
  {
    "_contactDoc.category": { $ne: "spam" },
    "_contactDoc.email": {
      $not: {
        $regex: "^(noreply|no-reply|donotreply|do-not-reply|notifications?|newsletter|bounce|postmaster|mailer-daemon|auto-?reply)@",
        $options: "i"
      }
    }
  }
  ```
- Thêm `{ $limit: limit }` sau match để giữ đúng limit cuối cùng.

Kết quả: topics từ spam contacts hoặc noreply/automated senders bị lọc khỏi Focus page.

---

## Session: Mojibake Fix — Double UTF-8/Latin-1 Encoding ✅ IMPLEMENTED

### Root Cause

Tên "ThÃ¡Â»Â‹nh" là **double Mojibake** — 2 lần misread encoding:
1. Gmail API trả về raw bytes UTF-8 của header `From` → Node.js đọc như Latin-1 → "á»‹" thay vì "ị"
2. Bytes của "á»‹" tiếp tục bị misread qua Windows-1252 (byte 0x8B → `‹` U+2039, 0x92 → `'` U+2018...) → "Ã¡Â»Â‹"

Fix RFC 2047 trước đó chỉ xử lý `=?charset?B/Q?...?=` patterns, không xử lý raw byte Mojibake.

### Fix

**`apps/backend/src/modules/contacts/contact.service.ts`**:
- Thêm `CP1252_TO_CODEPOINT` lookup table (range 0x80–0x9F Windows-1252 special chars).
- `CP1252_UNICODE_TO_BYTE` reverse map.
- `decodeMojibake(str)`: reverse một lớp Mojibake — safe: trả lại original nếu có ký tự Unicode thực nằm ngoài Latin-1/CP1252 range, hoặc nếu decode tạo ra `\uFFFD`.
- `decodeEmailHeader(raw)` (**exported**): `decodeRfc2047(raw)` → `decodeMojibake()` × 2 (double-Mojibake). Exported để `gmail.service.ts` dùng.
- `parseEmailAddress()` giờ gọi `decodeEmailHeader()` thay vì chỉ `decodeRfc2047()`.

**`apps/backend/src/modules/email/gmail.service.ts`**:
- Import `decodeEmailHeader` từ `contact.service.ts`.
- Apply cho `from` header ở **2 chỗ**:
  1. Trong vòng lặp message (Thread.participants + firstSenderRaw/lastSenderRaw).
  2. Trong message upsert (Message.from field).

### 3 Nơi hiển thị tên đều được fix

| Nơi | Field | Fixed via |
|---|---|---|
| ThreadList sender | `Thread.participants[0]` | `decodeEmailHeader` khi lưu participants |
| Thread detail "from" | `Message.from` | `decodeEmailHeader` khi upsert Message |
| Contact.name | `Contact.name` | `parseEmailAddress` → `decodeEmailHeader` |

Sau khi sync lại, tất cả names sẽ hiển thị đúng tiếng Việt.
