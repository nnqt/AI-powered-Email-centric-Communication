# Architecture and Functional Requirement (FR) Guide

This document connects the **thesis requirements** to concrete
**modules and services** in the repository so Copilot can reason about
where to implement new features.

The current implementation focus is on:

- FR-01 – Email sync (near real-time)
- FR-02 – Basic email operations (read/archive/labels)
- FR-03 – Contact-centric timeline view
- FR-04 – Real-time UI update (timeline refresh)
- FR-07 – Thread summarization (AI)
- FR-08 – Smart reply suggestions (AI)

Other FRs/NFRs exist but are not yet implemented.

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

### FR-02 – Basic Email Operations

**Goal**: allow basic operations such as mark read/unread, archive,
labeling, and composing/sending emails directly from the web app while
keeping the provider (e.g. Gmail) in sync.

**Primary modules**:

- `apps/backend`:
  - Routes for operations, e.g. `POST /api/emails/:id/read`,
    `POST /api/emails/:id/archive`, `POST /api/emails/:id/label`.
  - Route for sending email, e.g. `POST /api/emails/send` that accepts
    recipients, subject, HTML body, and attachments, then calls the
    provider API and stores the sent message in MongoDB.
  - Email provider client functions to propagate changes back to the
    email provider (including send).
- `apps/frontend`:
  - Inbox UI with per-thread state (read/unread, labels).
  - Thread detail UI with buttons/menus for these actions.
  - A dedicated **Compose Email** page or drawer (e.g. `/compose`)
    that provides:
    - Rich text editing (bold, italic, bullet list, quote) using a
      suitable editor library.
    - Attachment selection UI (even if attachment handling is
      simplified in the PoC).
    - Integration with `POST /api/emails/send` and navigation back to
      the appropriate thread/inbox on success.

**Key ideas**:

- The backend acts as the source of truth for state; provider updates
  are mirrored.
- Sent emails from the web app must appear both in the PoC inbox and
  in the provider (e.g. Gmail "Sent"), so they share the same
  thread/message ids where possible.
- API routes should be small wrappers around domain functions
  (services) that handle both DB and provider calls.

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

### FR-07 – Thread Summarization (AI)

**Goal**: generate concise summaries for email threads to reduce
information overload, shown directly in the thread/timeline UI.

**Primary modules**:

- `apps/backend`:
  - Client module to call the AI service (`/summarize`).
  - Logic to store summaries in MongoDB and expose them in timeline and
    thread detail responses.
- `apps/ai-service`:
  - `POST /summarize` endpoint and underlying LLM integration.
- `apps/frontend`:
  - Components to display summaries within the open thread view and
    contact timeline.

**Key ideas**:

- Summaries should include both natural language text and structured
  fields (e.g. `summary`, `key_issues`, `action_required`).
- AI calls should be async and non-blocking for the main request path
  when possible.

### FR-08 – Smart Reply Suggestions (AI)

**Goal**: propose 2–3 reply options for the latest email in a thread,
surfaced in the composer UI of the thread view.

**Primary modules**:

- `apps/backend`:
  - Endpoint such as `POST /api/threads/:id/replies`.
  - Client code to call `POST /suggest-reply` on the AI service.
- `apps/ai-service`:
  - `POST /suggest-reply` endpoint.
- `apps/frontend`:
  - UI element in the email composer showing suggested replies when a
    thread is open.

**Key ideas**:

- Suggestions are helpers, not automatic sends; the user always edits
  and confirms.
- The AI service should receive enough context (latest message + short

* history/summary) to generate relevant replies.

## Design Principles

- Keep the **AI service independent** from storage; all data access is
  via the backend.
- Use **MongoDB** for flexible, semi-structured documents representing
  threads, contacts, and AI outputs.
- Use **Redis** where it simplifies caching or realtime events.
- Implement only the required FRs first, but structure code so that
  adding new FRs later is a matter of adding new modules, not
  rewriting existing ones.
