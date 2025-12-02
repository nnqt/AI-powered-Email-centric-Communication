# Copilot Prompt Templates

These templates describe **how the user is expected to talk to you**
and what style of output you should generate.

## General Role

You are **GitHub Copilot**, coding assistant for a multi-service
project built in:

- Next.js (frontend + backend)
- Python (FastAPI AI microservice)
- Redis + MongoDB
- Docker Compose for orchestration

Always:

- follow async patterns,
- write modular, documented code,
- respect the monorepo structure from `PROJECT_STRUCTURE.md`,
- keep the mapping to FR-01/02/03/04/07/08 in mind.

## Common Prompt Patterns

### 1. Implement email sync and storage (FR-01/FR-02)

> “Implement a Next.js API route `/api/emails/sync` that pulls recent
> emails from Gmail, upserts them into MongoDB, and returns the number
> of new messages. Use async patterns and a separate `email` module for
> provider-specific logic.”

### 2. Build contact-centric timeline (FR-03)

> “Create backend functions in `modules/timeline` that, given a
> contact id, return a sorted list of email threads with basic
> metadata and any stored summaries. Then expose it via
> `GET /api/contacts/:id/timeline`.”

### 3. Realtime timeline updates (FR-04)

> “Add a WebSocket or server-sent events endpoint that notifies the
> frontend when new emails or summaries are available for a given
> contact. Use Redis pub/sub internally to broadcast updates.”

### 4. AI summarization endpoint (FR-07)

> “Write a FastAPI route `/summarize` that accepts a thread id and a
> list of messages, calls OpenAI with a well-structured prompt, and
> returns a JSON object with `summary`, `key_issues`, and
> `action_required` fields.”

### 5. Smart reply suggestions (FR-08)

> “Implement `POST /suggest-reply` in the AI service and a corresponding
> backend route `POST /api/threads/:id/replies` that calls it. Return
> 2–3 suggested replies as strings so the frontend can render them as
> editable options.”

### 6. Frontend timeline UI

> “Create a React component `TimelineView` that shows a list of threads
> for a contact, including subject, last message time, and the latest
> AI summary if available. Use Tailwind for styling and fetch data from
> `/api/contacts/:id/timeline`.”

## Specialized Prompts

### AI Logic and Clients

> “Write `llm_client.py` for the AI service that wraps OpenAI calls and
> exposes `generate_summary` and `generate_replies` async functions.
> Read configuration from environment variables and handle timeouts.”

### Data Modeling

> “Define a MongoDB schema or TypeScript types for `EmailThread` and
> `Summary` so that the backend can persist both raw messages and AI
> output, linked by `threadId`.”

### Infrastructure

> “Extend `docker-compose.yml` to include the AI service container and
> configure networks so that the backend can call it at
> `http://ai-service:5000`.”

## Tone & Output Expectations

- Write concise, production-grade code.
- Include comments only where logic is non-trivial.
- When unsure, provide flexible scaffolding and highlight assumptions.
- Align with conventions in `CODE_STYLE_GUIDE.md` and the structure in
  `PROJECT_STRUCTURE.md`.
