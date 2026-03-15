# Implementation Status — March 16, 2026

## FR Status

| FR    | Description                                       | Status                                             |
| ----- | ------------------------------------------------- | -------------------------------------------------- |
| FR-01 | Email sync (near real-time via Gmail API)         | ✅ Manual sync; webhook is architecture-pending    |
| FR-02 | Compose + send (rich text + attachments)          | ✅ Implemented                                     |
| FR-03 | Read/unread/archive (two-way Gmail sync)          | ✅ Implemented                                     |
| FR-04 | Inbox + Thread timeline view                      | ✅ Implemented                                     |
| FR-05 | Real-time UI update (Socket.IO)                   | ✅ Implemented                                     |
| FR-06 | AI-assisted Contact Management (enrich + merge)   | ✅ Implemented                                     |
| FR-07 | Thread summarization (AI, Vietnamese output)      | ✅ Implemented                                     |
| FR-08 | Smart reply suggestions (email + message formats) | ✅ Implemented                                     |
| FR-09 | Multi-channel adapter + Telegram Bot              | ⏳ Pending (designed not to require core refactor) |
| FR-10 | Topic Intelligence (cluster + AI label + score)   | ✅ Implemented (Phases 1–6)                        |

---

## Key Implemented Modules

### Email Sync (FR-01)

- `apps/backend/src/modules/email/gmail.service.ts`
  - `syncEmails(pageToken?)`: fetches 50 threads/call via `users.threads.list`.
  - Parallel batches of 10 via `Promise.allSettled` (not sequential).
  - Upserts `Thread` + `Message`; contact upsert fire-and-forget.
  - Stores `nextPageToken` on User; sets `gmailSyncComplete` when done.
  - Fires `classifyUrgent()` fire-and-forget after each thread upsert (guard: `!urgentClassifiedAt`).
- Socket.IO: emits `EMAIL_SYNCED { count, hasMore }` on success.
- FR-01 note: Gmail Pub/Sub webhook (< 5s push) is production target but not implemented in PoC (needs public HTTPS). Architecture supports adding webhook handler without refactor.

### Compose + Send (FR-02)

- `sendEmail({ to, subject, htmlBody, attachmentIds? })` — RFC 2822 MIME with HTML body.
- Attachments: upload to `uploads/` via `POST /api/emails/attachments` → `attachmentId`. Sent with email then cleaned up.
- `ComposeDrawer.tsx`: Tiptap rich-text editor (bold, italic, bullet, blockquote, link) + file picker + attachment chips.

### Read/Archive (FR-03)

- `markRead(gmailThreadId, read)`: toggle Gmail `UNREAD` label + update `Thread.isRead`.
- `archiveThread(gmailThreadId)`: remove Gmail `INBOX` label + `Thread.isArchived = true`.
- Frontend: optimistic UI with `mutate()` revert on error.

### Timeline + Pagination (FR-04)

- Cursor-based pagination: composite key `"${lastMessageDate.toISOString()}_${_id}"` via `lastIndexOf("_")`.
- `ThreadFilter` = `"all" | "unread" | "archived"` (urgent filter tab removed; per-thread `🔴 Urgent` badge kept).
- Search: regex on `subject`, `participants`, `snippet` (case-insensitive, escaped special chars).
- `total` reflects active filter + search (not just userId count).

### WebSocket Realtime (FR-05)

- Custom `server.ts` wraps Next.js handler, attaches Socket.IO, connects Redis adapter.
- `global.__io` for access from Next.js API routes.
- Events emitted: `EMAIL_SYNCED`, `SUMMARY_READY`, `EMAIL_SENT`, `AI_JOB_START`, `AI_JOB_DONE`.
- `AI_JOB_START { jobId, label }` / `AI_JOB_DONE { jobId, label, success }`: global AI progress toasts via `aiJobToastMap` ref in `layout.tsx`.
- Client joins `user:<userId>` room on `connect` AND `reconnect` (both handlers required).
- Background polling fallback: `useBackgroundSync` every 60s to revalidate SWR cache.

### Contact Management (FR-06)

- Auto-create contact on `syncEmails` via `upsertParticipants` (idempotent by email).
- `getContactsForMergeSuggestions`: **2 DB queries** — fetch contacts (max 100) + bulk fetch 300 recent threads → match in-memory. `claimedAltEmails` filter prevents contacts already in `alternateEmails` appearing in suggestions.
- Enrich guard: `aiEnriched=true` → cached response; `?force=true` to re-enrich.
- Merge cache: Redis 6h; `?refresh=true` to bypass; invalidated on successful merge.

### AI Summarization (FR-07)

- `POST /api/threads/[threadId]/summarize` → calls AI service → stored in `Thread.summary`.
- AI output always in Vietnamese.
- `AISummaryCard.tsx`: shows "Summarize" button when no summary; shows result with "Regenerate" link.
- `SUMMARY_READY` socket event → `mutate()` refreshes card without page reload.

### Smart Reply (FR-08)

- `SmartReplyBar.tsx`: format toggle (💬 Message / ✉ Email).
  - Message format: compact chip buttons from `reply.body`.
  - Email format: expanded cards with Subject + body preview + "Use this reply" button.
- `handleSelectReply(reply)` → pre-fills `ComposeDrawer` with `initialBody` + `subjectOverride`.
- Lazy-mount: API called only when user clicks "Generate suggestions".

### AI Urgent Classification (enhancement on FR-04/FR-06)

- `GeminiUrgentClassifier`: keyword fast-path → no Gemini call; Gemini fallback with `max_retries=2`.
- Keywords tightened: removed "important", "reminder", "follow up", "deadline" (false-positive prevention).
- Spam fast-path: `sender_categories == ["spam"]` → `is_urgent=false` without Gemini.
- Fire-and-forget in `syncEmails`; guard: `!urgentClassifiedAt`.
- Stored on Thread: `isUrgent`, `urgentClassifiedAt`, `urgentDismissed`.
- `urgentDismissed=true` set on `markRead(true)`; Urgent filter query excludes `urgentDismissed: true`.
- Frontend: Urgent filter tab, `🔴 Urgent` chip on thread rows and thread detail header.

### Contact Category AI Suggestion (FR-06 extension)

- AI suggests category during enrich; stored in `categoryAiSuggestion`.
- Multi-category support: `categories[]` field on Contact.
- Frontend: violet suggestion banner with checklist UI; "Confirm" → PATCH `{ categories, category, categorySource: "user", categoryAiSuggestion: null }`.
- Bulk enrich: `POST /api/contacts/bulk-enrich` — processes up to 200 contacts in batches of 5.
- **Verify tab** (`/contacts?tab=verify`): `getUnverifiedContacts()` query (`categorySource≠'user'`, `categories[]` empty, not merged). `VerifyContactRow` with toggle chips + inline AI suggest + Confirm/Skip. Amber badge shows unverified count.

### Topic Intelligence (FR-10) — Phases 1–6

**Phase 1 — Thread Category Classification**

- 22-value `ThreadCategory` enum on Thread (`categories[]`, `categorizedAt`, `categorySource`, `lastMessageDirection`, `lastInboundAt`, `noiseFiltered`).
- `GeminiThreadCategoryClient`: Tier 1 hard-reject (noreply/spam/automated patterns) → Gemini fallback.
- AI Service: `POST /classify-thread-category`. Fire-and-forget after each Thread upsert.

**Phase 2 — Topic Model + Heuristic Clustering**

- `Topic` model: `userId`, `contactId`, `name`, `nameEditedByUser`, `threadIds[]`, `threadCount`, `noiseCount`, `focusScore`, `unansweredCount`, `lastInboundAt`, `lastOutboundAt`, `aiLabeled`, `aiLabeledAt`.
- `Thread.topicId` (ref Topic, indexed) added.
- `TopicService.clusterThreadsIntoTopics()`: 30-day window, normalize subject, 60% word overlap fuzzy match.
- APIs: `GET /api/topics`, `GET/PATCH /api/topics/:id`, `GET /api/contacts/:id/topics`. (Next.js 15 async params applied.)

**Phase 3 — AI Topic Labeling**

- `GeminiTopicLabelClient`: 0-cost shortcuts → Gemini 2–5 word label in subject's language.
- `TopicService.labelUnlabeledTopics()` (5 concurrent, batchSize=20). Chains after cluster in `syncEmails`.

**Phase 4 — Focus Score Engine**

- Formula: `focusScore = unansweredCount×40 + recencyScore(0–30) + contactWeight(0–10)`.
- `scoreTopicById()`, `scoreAllTopicsForUser()`, `getFocusTopics()` → `FocusTopicDTO`.
- API: `GET /api/focus?limit=20&refresh=1`. 5 score triggers in `gmail.service.ts`.

**Phase 5 — Focus Page UI**

- `useFocusTopics` SWR hook. `FocusTopicCard` expandable card with **PriorityBadge** + lazy thread load + inline rename.
- `/focus` page with skeleton/empty/error states + "Refresh scores" button.
- Focus nav item added to sidebar.
- Spam contacts + noreply senders filtered from `getFocusTopics()` aggregate pipeline.

**Phase 6 — Contact Timeline Upgrade**

- `useContactTopics` SWR hook (`GET /api/contacts/:id/topics`).
- `ContactTopicGroup` expandable card with direction dots, **PriorityBadge**, inline rename.
- Contact detail page: **Timeline / By Topic** toggle. "By Topic" groups threads under topic cards.

---

## Architecture Decisions

| Decision                           | Rationale                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------- |
| No Gmail Pub/Sub webhook in PoC    | Requires public HTTPS URL; manual sync adequate for PoC                    |
| FR-09 (Telegram) pending           | Not needed for thesis evaluation; architecture designed for future add     |
| Soft-merge for contacts            | Preserves audit trail; `mergedInto` ref keeps data integrity               |
| Backend custom `server.ts`         | Socket.IO requires HTTP server access; `output: "standalone"` incompatible |
| `NEXT_PUBLIC_BACKEND_SOCKET_URL`   | Next.js rewrites can't proxy WebSocket; direct URL required                |
| `load_dotenv()` before all imports | Env vars must be available when `config.py` is imported                    |
| `pino-pretty` dev-only             | Worker threads crash in production bundled Next.js builds                  |

---

## Production Runtime Fixes Applied

| File                                  | Issue                                                              | Fix                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/axiosClient.ts`              | Top-level `throw` failed Next.js build                             | `\|\| 'http://localhost:5000'` fallback                                                                                                         |
| `src/lib/db.ts`                       | Top-level `throw` for `MONGO_URI`                                  | Moved validation inside `connectToDatabase()`                                                                                                   |
| `src/lib/logger.ts`                   | `pino-pretty` crashed in production builds                         | Only loaded when `NODE_ENV === 'development'`                                                                                                   |
| `src/modules/email/gmail.service.ts`  | `nextPageToken` type coercion issue                                | `?? undefined` coercion                                                                                                                         |
| `src/models/User.ts`                  | Fields in TS interface missing from schema                         | Added to Mongoose schema                                                                                                                        |
| `modules/contacts/contact.service.ts` | Vietnamese names stored as Mojibake (double UTF-8/Latin-1 misread) | `decodeMojibake()` + `decodeEmailHeader()` export; applied in `gmail.service.ts` for `From` header on both Thread.participants and Message.from |
| `features/inbox/ThreadList.tsx`       | `filter === "urgent"` TS error after type narrowing                | Removed unreachable branch                                                                                                                      |
