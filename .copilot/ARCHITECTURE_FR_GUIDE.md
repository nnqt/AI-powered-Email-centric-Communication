# Architecture and Functional Requirement (FR) Guide

This document connects the **thesis requirements** to concrete
**modules and services** in the repository so Copilot can reason about
where to implement new features.

The current implementation focus is on:

- FR-01 – Email sync ✅ IMPLEMENTED
- FR-02 – Basic email operations ✅ IMPLEMENTED
- FR-03 – Contact-centric timeline view ✅ IMPLEMENTED
- FR-07 – Thread summarization (AI) ✅ IMPLEMENTED
- FR-08 – Smart reply suggestions (AI) ✅ IMPLEMENTED
- FR-04 – Real-time UI update (WebSocket) ⏳ Next priority

Other FRs/NFRs exist but are out of scope for current PoC.

## Mapping FRs to Modules

### FR-01 – Email Sync (Near Real-Time)

**Goal**: keep the local system in sync with a real email provider
such as Gmail (or any API-based provider) with minimal delay.

**Primary modules**:

- `apps/backend`:
  - Email integration client (e.g. Gmail API wrapper).
  - Sync route(s), e.g. `POST /api/emails/sync`.
  - Webhook/notification handlers where supported by provider.
  - Jobs or background tasks (if any) for periodic sync.
- `apps/frontend`:
  - Inbox view that shows the latest synced threads.
- `infra`:
  - Dockerized MongoDB and Redis.

**Key ideas**:

- Use provider APIs (or mocks) to fetch recent messages.
- Store messages in MongoDB, keyed by thread/conversation id.
- Design the sync logic to be idempotent (safe to run multiple times).

### FR-02 – Basic Email Operations ✅ IMPLEMENTED

**Goal**: allow basic operations such as mark read/unread, archive,
and composing/sending emails directly from the web app while keeping
Gmail in sync.

**Primary modules**:

- `apps/backend`:
  - `apps/backend/src/modules/email/gmail.service.ts` — `markRead()`, `archiveThread()`, `sendEmail()`.
  - `apps/backend/src/models/Thread.ts` — `isRead` (Boolean), `isArchived` (Boolean) fields.
  - `apps/backend/src/app/api/threads/[threadId]/read/route.ts` — `PATCH` toggle read.
  - `apps/backend/src/app/api/threads/[threadId]/archive/route.ts` — `PATCH` archive.
  - `apps/backend/src/app/api/emails/send/route.ts` — `POST` send email.
- `apps/frontend`:
  - `apps/frontend/src/components/ComposeDrawer.tsx` — bottom slide-up compose/reply drawer.
  - `apps/frontend/src/features/inbox/ThreadList.tsx` — unread dot + bold + optimistic read/archive actions.
  - `apps/frontend/src/app/page.tsx` — Compose button.
  - `apps/frontend/src/app/threads/[id]/page.tsx` — Reply button + auto-mark-read.

**Key ideas**:

- Backend là source of truth; mọi thay đổi đều được ghi vào MongoDB VÀ phản ánh lên Gmail API.
- Optimistic UI: frontend cập nhật state ngay lập tức, revert nếu API call thất bại.
- `sendEmail` upsert Thread + Message để sent email xuất hiện trong PoC inbox lẫn Gmail "Sent".

### FR-03 – Contact-Centric Timeline View

**Goal**: show a unified timeline of communication for a single
contact, based primarily on email threads, accessible from the inbox
flow (open thread → see timeline for involved contact).

**Primary modules**:

- `apps/backend`:
  - Timeline aggregation logic (queries combining threads, summaries,
    and metadata by contact).
  - Routes such as `GET /api/contacts/:id/timeline` and optionally
    `GET /api/threads/:id/timeline` returning a list of timeline items.
- `apps/frontend`:
  - `InboxView` component to list threads.
  - `ThreadView` component to show messages in a thread.
  - `TimelineView` component to render the contact-centric timeline
    when a thread is opened.

**Key ideas**:

- Model timeline entries as an ordered list of events (emails,
  summaries, notes, etc.).
- Avoid over-optimizing; a simple query over MongoDB is enough for the
  PoC.

### FR-04 – Real-Time UI Update

**Goal**: update the inbox, thread view, and timeline UI when new
emails or AI results arrive without manual refresh.

**Primary modules**:

- `apps/backend`:
  - WebSocket or server-sent events endpoint for pushing updates.
  - Redis pub/sub or similar to broadcast events from email/AI
    processing to connected clients.
- `apps/frontend`:
  - WebSocket/SSE client logic to subscribe to updates per user,
    contact, or thread.
  - UI update logic to refresh **inbox list**, **open thread**, and
    **timeline** when relevant events arrive.

**Key ideas**:

- Keep the realtime implementation minimal (one channel/topic is
  enough for the PoC).
- The backend emits events like `EMAIL_RECEIVED`, `SUMMARY_READY`,
  which the frontend interprets.

### FR-07 – Thread Summarization (AI) ✅ IMPLEMENTED

**Goal**: generate concise summaries for email threads to reduce
information overload, shown directly in the thread/timeline UI.

**Primary modules**:

- `apps/backend`:
  - `AIService` in `src/modules/ai/ai.service.ts` calls the AI service `/summarize`.
  - `Thread` model includes `summary` field with `text`, `key_issues`, `action_required`.
  - `POST /api/threads/[threadId]/summarize` route orchestrates the flow.
- `apps/ai-service`:
  - `POST /summarize` endpoint using Google Gemini (`GeminiSummarizationClient`).
  - Returns structured JSON response.
- `apps/frontend`:
  - `AISummaryCard` component displays summaries.
  - Thread detail page (`/threads/[id]`) with summarization button.

**Key ideas**:

- Summaries should include both natural language text and structured
  fields (e.g. `summary`, `key_issues`, `action_required`).
- AI calls should be async and non-blocking for the main request path
  when possible.

### FR-08 – Smart Reply Suggestions (AI) ✅ IMPLEMENTED

**Goal**: propose 2–3 reply options for the latest email in a thread,
surfaced in the thread view so the user can click to pre-fill the composer.

**Primary modules**:

- `apps/backend`:
  - `apps/backend/src/modules/ai/ai.service.ts` — `suggestReplies(threadId, latestMessage, context?, maxReplies)`.
  - `apps/backend/src/app/api/threads/[threadId]/suggest-reply/route.ts` — `POST`, no body needed; resolves thread+messages internally.
- `apps/ai-service`:
  - `apps/ai-service/routes/reply.py` — `POST /suggest-reply`.
  - `apps/ai-service/services/smart_reply.py` — `SmartReplyService`.
  - `apps/ai-service/core/llm_client.py` — `GeminiReplyClient`.
- `apps/frontend`:
  - `apps/frontend/src/components/SmartReplyBar.tsx` — chip buttons + generate/regenerate.
  - `apps/frontend/src/app/threads/[id]/page.tsx` — wired between `AISummaryCard` and messages.

**Key ideas**:

- Suggestions helpers, not automatic sends — user always edits và confirms via `ComposeDrawer`.
- AI service nhận `latest_message` + `conversation_context` (từ `thread.summary.text` nếu có) để generate relevant replies.
- `SmartReplyBar` mounts lazy — chỉ gọi API khi user click "Generate suggestions".

## Design Principles

- Keep the **AI service independent** from storage; all data access is
  via the backend.
- Use **MongoDB** for flexible, semi-structured documents representing
  threads, contacts, and AI outputs.
- Use **Redis** where it simplifies caching or realtime events.
- Implement only the required FRs first, but structure code so that
  adding new FRs later is a matter of adding new modules, not
  rewriting existing ones.
