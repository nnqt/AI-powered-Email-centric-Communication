# Project Structure and Architecture

This file describes the high-level repository layout so that you
always know **where to put new code** and **where to look for
existing modules**.

## Repository Type

The project is a **monorepo**:

```text
/AI-powered-Email-centric-Communication
│
├── apps/
│   ├── frontend/          # Next.js app (React + TypeScript)
│   ├── backend/           # Next.js API backend (REST + realtime)
│   └── ai-service/        # Python FastAPI microservice for AI (FR-07/08)
│
├── infra/
│   ├── docker-compose.yml # Orchestration for backend, frontend, AI, Redis, Mongo
│   ├── redis/             # (Optional) Redis configuration
│   ├── mongo/             # (Optional) MongoDB setup
│
├── shared/                # (Future) Shared models and utilities
│   ├── models/            # Shared TypeScript/Python schemas, DTOs
│   └── utils/             # Common helpers
│
└── .copilot/              # Copilot guidance (this folder)
```

If you need to create new modules, prefer extending these top-level
areas instead of adding new root folders.

## Responsibilities by App

### `apps/frontend`

- Next.js app responsible for:
  - Rendering the **contact-centric timeline** (FR-03).
  - Displaying email threads and AI-generated summaries.
  - Showing smart reply suggestions and allowing the user to edit
    them (FR-08).
  - Subscribing to realtime updates from the backend (FR-04).

### `apps/backend`

- Next.js API backend responsible for:
  - Integrating with the email provider (e.g. Gmail API) to support
    **FR-01/FR-02**.
  - Exposing REST endpoints for threads, contacts, summaries, and
    replies.
  - Managing MongoDB persistence and Redis caching.
  - Talking to the AI service for summarization and smart replies
    (FR-07/FR-08).
  - Providing realtime channels (e.g. WebSocket) for timeline updates
    (FR-04).

### `apps/ai-service`

- FastAPI microservice responsible for:
  - Thread summarization (FR-07).
  - Smart reply suggestion (FR-08).
  - Strictly stateless HTTP contracts; it does **not** access
    MongoDB directly.
  - Optional use of Redis for caching or rate limiting.

## Communication Flow

1. **Frontend → Backend**: fetch contact timeline, open a thread,
   request smart replies.
2. **Backend → MongoDB**: store and retrieve email threads, contacts,
   summaries, and reply candidates.
3. **Backend → Redis**: cache summaries and use pub/sub or queues for
   async processing.
4. **Backend → AI Service**: send requests for summarization and smart
   replies.
5. **AI Service → external LLMs** (optional): call OpenAI or local
   models.
6. **Backend → Frontend**: push realtime updates (new emails,
   finished summaries) via WebSocket or similar.

## Networking Layout (via Docker Compose)

Typical ports and dependencies:

| Service    | Port  | Depends On               |
| ---------- | ----- | ------------------------ |
| frontend   | 3000  | backend                  |
| backend    | 4000  | redis, mongo, ai-service |
| ai-service | 5000  | —                        |
| redis      | 6379  | —                        |
| mongo      | 27017 | —                        |

You should keep these as defaults when adding new scripts or
documentation unless the user explicitly changes them.

## Data Flow Example (FR-07/FR-08)

1. Backend receives or detects a new email in a thread (FR-01).
2. Backend stores the message in MongoDB and maybe enqueues an AI job
   in Redis.
3. Backend calls `POST /summarize` on the AI service with the thread
   content.
4. AI service calls an LLM, returns a JSON summary.
5. Backend saves the summary and emits a realtime event (FR-04).
6. Frontend updates the timeline card with the latest summary.
7. When the user opens a thread, backend calls `POST /suggest-reply`
   and returns reply options for the composer (FR-08).

## Future Extensions (Not Yet Implemented)

- Multi-channel adapters for Zalo/WhatsApp/Telegram.
- Dedicated `shared/` models for cross-language schema reuse.
- More advanced AI features (RAG, agents) as described in the thesis.
