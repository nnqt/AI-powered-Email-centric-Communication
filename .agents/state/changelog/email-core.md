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

### FR-05 Socket.IO Realtime
- Custom `server.ts` wraps Next.js + Socket.IO + Redis adapter
- `global.__io` for API route access. `emitToUser(userId, event, payload)` helper
- Events: `EMAIL_SYNCED`, `SUMMARY_READY`, `EMAIL_SENT`, `AI_JOB_START`, `AI_JOB_DONE`, `NEW_TELEGRAM_MESSAGE`
- `AI_JOB_START { jobId, label }` / `AI_JOB_DONE { jobId, label, success }` — global toast via `layout.tsx`
- Client joins `user:<userId>` room on `connect` AND `reconnect`

### FR-07 AI Summarization
- `POST /api/threads/[threadId]/summarize` → AI service `POST /summarize` → stored in `Thread.summary`
- Output always in Vietnamese. Emits `SUMMARY_READY` socket event.

### FR-08 Smart Reply
- `SmartReplyBar.tsx` — format toggle (💬 Message / ✉ Email)
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
