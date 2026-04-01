# 2026-04-01 — Verify Hub Merge Direction Consistency Fix

## Changed

- Fixed merge queue behavior in `/contacts/verify` so staged merge direction is preserved at save-time.
- Fixed verified-anchor handling in Duplicate/Similar Candidates:
  - if backend marks a suggestion as `verified_anchor`, frontend now keeps that source/target direction instead of force-anchoring into currently selected contact.
- Result: when merging a duplicate into a verified target, the duplicate source contact is correctly removed from Needs Review after save.

# 2026-03-31 — Inbox Sync Toast + Timeline ThreadId Fix

## Changed

- Reduced duplicate inbox sync success toasts on `/inbox`:
  - keep processing toast + final result from the initiating sync call
  - stop showing additional success toast from `EMAIL_SYNCED` socket handler on inbox page.
- Fixed contact timeline email navigation payload:
  - `GET /api/contacts/:id/timeline` now maps `threadId` from `Thread.id` (was incorrect `threadId` field), preventing `/threads/undefined` navigation.
- Added defensive frontend guard in contact timeline click handlers to skip navigation when `threadId`/`chatId` is missing.

# 2026-03-31 — Backend AI Architecture Cleanup

## Changed

- Removed deprecated summarize API layer that diverged from module-based backend architecture:
  - deleted `apps/backend/src/app/api/ai/summarize/route.ts`
  - deleted `apps/backend/src/services/ai.service.ts`
  - deleted `apps/backend/src/services/cache.service.ts`
  - deleted `apps/backend/src/types/ai.types.ts`
- Consolidated backend AI integration to single adapter path:
  - `apps/backend/src/modules/ai/ai.service.ts`

# 2026-03-28 — Contacts Verify Hub Consolidation

## Changed

- Added new unified page `apps/frontend/src/app/(dashboard)/contacts/verify/page.tsx` to process contact triage in one place:
  - name edit
  - category verify
  - duplicate merge suggestions.
- Updated dashboard sidebar nav (`apps/frontend/src/app/(dashboard)/layout.tsx`):
  - replaced `Check Duplicates` sub-item with `Verify Hub` (`/contacts/verify`)
  - added Contacts review badge using unverified contacts count.
- Reduced duplicate workflow fragmentation by redirecting legacy route:
  - `apps/frontend/src/app/(dashboard)/contacts/duplicates/page.tsx` now redirects to `/contacts/verify`.

# 2026-03-29 — Single Contact Enrich API

## Added

- Added route `POST /api/contacts/:id/enrich` at `apps/backend/src/app/api/contacts/[id]/enrich/route.ts`.
- Route behavior:
  - auth + ownership checks
  - returns cached contact when `aiEnriched=true` and `force` is not set
  - runs AI enrichment and updates contact fields (`name`, `org`, `language`, `categoryAiSuggestion`, `enrichedAt`) when needed.
- Used by frontend flows:
  - contact detail page
  - contacts verify list
  - verify hub page.

# 2026-03-29 — Verify UX Auto-Run + Duplicate Heuristic Upgrade

## Changed

- Contact verification now runs through dedicated Verify Hub at `/contacts/verify`.
- Sidebar now shows pending review badge on `Verify Hub` sub-item under Contacts.
- Verify Hub contact selection now auto-runs:
  - `POST /api/contacts/:id/enrich` (fills category suggestion/ticks when available)
  - `GET /api/contacts/merge-suggestions?selectedContactId=<id>` (selected-aware duplicate candidates).

## Improved Duplicate Detection

- `GET /api/contacts/merge-suggestions` now combines:
  - AI suggestions
  - heuristic suggestions based on normalized name equality / high token overlap.
- Heuristic scoring adds confidence boost when pairing Telegram placeholder emails (`@telegram.local`) with non-Telegram contacts, improving same-person detection across Telegram + Gmail identities.

# Changelog — Email Core & Contact Management (FR-01..08)

> Load file này khi làm việc với Email sync, Compose, Thread, Contact, AI features (summarize/reply/urgent/enrich).

## Email Features

### FR-01 Email Sync
- `gmail.service.ts` — `syncEmails(pageToken?)`: 50 threads/call, parallel batches of 10 via `Promise.allSettled`
- Upserts Thread + Message + Contact. Stores `nextPageToken` on User. Sets `gmailSyncComplete` when done.
- Socket.IO: emits `EMAIL_SYNCED { count, hasMore }`
- Note: Gmail Pub/Sub webhook not implemented (needs public HTTPS). Manual sync only.

### FR-02 Compose & Send
- `sendEmail()` — RFC 2822 MIME with HTML body
- Attachments: `POST /api/emails/attachments` → `attachmentId` → send + cleanup
- `ComposeDrawer.tsx` — Tiptap rich-text (bold, italic, bullet, blockquote, link) + file picker

### FR-03 Read/Archive
- `markRead(gmailThreadId, read)` — toggle Gmail `UNREAD` label + `Thread.isRead`
- `archiveThread()` — remove Gmail `INBOX` label + `Thread.isArchived = true`
- On `markRead(true)` → also sets `urgentDismissed: true` (see urgent)

### FR-04 Timeline + Pagination
- Cursor: composite key `"${lastMessageDate.toISOString()}_${_id}"` parsed with `lastIndexOf("_")`
- `ThreadFilter` = `"all" | "unread" | "archived" | "urgent"`
- Search: regex on `subject`, `participants`, `snippet` (case-insensitive, escaped)
- **Email Display Change** (March 28, 2026):
  - Emails now default to **collapsed** (was expanded)
  - Collapsed header shows: From name (linkable) + relative time + subject + body snippet
  - Click expand to view full content
  - Toggle logic: `isExpanded = expandedMessages[msg._id] === true` (default false)

### FR-05 Socket.IO Realtime
- Custom `server.ts` wraps Next.js + Socket.IO + Redis adapter
- `global.__io` for API route access. `emitToUser(userId, event, payload)` helper
- Events: `EMAIL_SYNCED`, `SUMMARY_READY`, `EMAIL_SENT`, `AI_JOB_START`, `AI_JOB_DONE`, `NEW_TELEGRAM_MESSAGE`
- `AI_JOB_START { jobId, label }` / `AI_JOB_DONE { jobId, label, success }` — global toast via `layout.tsx`
- Client joins `user:<userId>` room on `connect` AND `reconnect`

### FR-07 AI Summarization
- `POST /api/threads/[threadId]/summarize` → AI service `POST /summarize` → stored in `Thread.summary`
- Output always in Vietnamese. Emits `SUMMARY_READY` socket event.
- **Timeline Format** (March 28, 2026):
  - AI returns array: `["Hôm nay, event...", "Hôm qua, event..."]` (backward compatible with string)
  - `AISummaryCard.tsx`: Parses and groups by date with left border accent
  - Replaced emoji priority icons with colored text badges
  - Helper functions: `getPriorityBadgeClass()`, `getDisplayPriority()`, `parseTimelineSummary()`
  - Priority mapping: Cao→red, Trung bình→amber, Thấp→slate
  - Deadline shown in sky-blue chip with clock icon

### FR-08 Smart Reply
- **UI Change** (March 28, 2026): Removed format toggle buttons from SmartReplyBar, now links to Studio
- **Studio Flow** (`/threads/[id]/smart-reply?format=email|message`):
  - Step 1: Display timeline-format summary (matching thread detail)
  - Step 2: Select next actions with priority/deadline badges + add custom context
  - Step 3: Preview combined context before generation
  - Context budget guard: 1200 chars with warning toast
  - Helper function: `parseActionItem()` extracts priority/deadline from action text
- **Email Generation**: Sends `selectedNextActions[]` + `additionalContext` to backend
- `handleSelectReply(reply)` → pre-fills `ComposeDrawer` with `initialBody` + `subjectOverride`

## Contact Management (FR-06)

- Auto-create contact on `syncEmails` via `upsertParticipants` (idempotent by email)
- `getContactsForMergeSuggestions`: 2 DB queries → in-memory match → `ContactSnippetDTO[]`
- Merge cache: Redis 6h; `?refresh=true` to bypass; invalidated on successful merge
- Soft-merge: `mergedInto` field set, source document kept for audit trail
- Bulk enrich: `POST /api/contacts/bulk-enrich` — max 200 contacts, batches of 5, 300ms delay

### Contact Category AI suggestion flow
1. Enrich contact → AI returns `categoryAiSuggestion`
2. Saved to `Contact.categoryAiSuggestion` if `categorySource !== "user"`
3. Frontend shows checklist UI with toggle chips for all 5 categories
4. Confirm → PATCH `{ categories, category, categorySource: "user", categoryAiSuggestion: null }`

### Multi-category support
- `categories[]` field (enum: `colleague|customer|other|spam|unknown`, default `[]`)
- `category` = primary (first in `categories[]` or `"unknown"`)

## AI Urgent Classification

- `GeminiUrgentClassifier`: keyword fast-path → Gemini fallback (`max_retries=2`)
- Spam fast-path: `sender_categories == ["spam"]` → `is_urgent=false` (no Gemini)
- Stored: `Thread.isUrgent`, `Thread.urgentClassifiedAt`, `Thread.urgentDismissed`
- `urgentDismissed=true` set on `markRead(true)` — hides from urgent filter

## Email Header Decoding

All `From`/`To` headers from Gmail must be decoded:
```typescript
import { decodeEmailHeader } from "@/modules/contacts/contact.service";
const from = decodeEmailHeader(getHeader("From")); // RFC 2047 + Mojibake fix
```

## UI Components

| Component | Key features |
|-----------|-------------|
| `ComposeDrawer.tsx` | Tiptap editor, attachments, `ComposeContext` |
| `ThreadList.tsx` | Search, filter tabs, cursor pagination, optimistic actions |
| `AISummaryCard.tsx` | Lazy summarize, Regenerate, `SUMMARY_READY` socket |
| `SmartReplyBar.tsx` | 2 formats, pre-fills ComposeDrawer |
| `FocusTopicCard.tsx` | Score bar, lazy thread load, inline rename |
| `ContactTopicGroup.tsx` | By Topic view, direction dots, inline rename |
