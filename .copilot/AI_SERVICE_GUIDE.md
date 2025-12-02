# AI Service Guide (FastAPI)

This guide defines how the AI microservice should look and behave so
that the backend can reliably implement **FR-07 (thread summarization)
and FR-08 (smart reply suggestions)**.

## Overview

The AI service is a **standalone Python FastAPI app**. It:

- Exposes HTTP endpoints for summarization and smart replies.
- Encapsulates all interaction with external LLM providers (OpenAI,
  local models, etc.).
- Is stateless from the perspective of the backend (no direct DB
  access).

The PoC only needs a minimal but clean implementation of two core
endpoints:

- `POST /summarize` – summarize an email thread (FR-07).
- `POST /suggest-reply` – suggest replies for latest email (FR-08).

## API Contracts

All endpoints should:

- Be `async` FastAPI routes.
- Use `pydantic` models for request/response.
- Return JSON with explicit fields (no free-form text only).

### `POST /summarize` (FR-07)

Summarize an email thread into a concise overview plus structured
metadata.

**Request body** (example):

```json
{
  "thread_id": "abc123",
  "messages": [
    {
      "id": "m1",
      "from": "candidate@example.com",
      "to": ["recruiter@example.com"],
      "sent_at": "2025-01-01T10:00:00Z",
      "text": "Hello, I am interested in the position..."
    },
    {
      "id": "m2",
      "from": "recruiter@example.com",
      "to": ["candidate@example.com"],
      "sent_at": "2025-01-01T10:30:00Z",
      "text": "Thank you for your interest..."
    }
  ]
}
```

**Response body** (example):

```json
{
  "thread_id": "abc123",
  "summary": "The candidate expressed interest in the position and the recruiter acknowledged and shared next steps.",
  "key_issues": [
    "Candidate interested in role X",
    "Recruiter to schedule next interview"
  ],
  "action_required": ["Schedule interview", "Send follow-up email with details"]
}
```

The backend will store this JSON alongside the thread document in
MongoDB and surface it in the timeline.

### `POST /suggest-reply` (FR-08)

Generate 2–3 smart reply options for the latest email in a thread.

**Request body** (example):

```json
{
  "thread_id": "abc123",
  "conversation_context": "...optional short summary or key events...",
  "latest_message": {
    "id": "m3",
    "from": "candidate@example.com",
    "text": "Could you please confirm the interview time?"
  },
  "max_replies": 3
}
```

**Response body** (example):

```json
{
  "thread_id": "abc123",
  "replies": [
    "Thank you for your message. I confirm your interview is scheduled for Tuesday at 10:00 AM.",
    "I appreciate your follow-up. Your interview is confirmed for Tuesday at 10:00 AM. Please let me know if you need to reschedule.",
    "Yes, your interview is confirmed for Tuesday at 10:00 AM. Looking forward to speaking with you."
  ]
}
```

The backend will pass these replies to the frontend; the user can edit
them before sending through the email provider.

## Implementation Guidelines

- Use **FastAPI** with `async def` endpoints.
- Introduce clear module boundaries:
  - `routes/` – FastAPI route definitions.
  - `services/` – business logic for talking to LLMs, building
    prompts, and post-processing.
  - `models/` – pydantic schemas for requests/responses.
  - `core/config.py` – configuration, environment variables, client
    setup (e.g. OpenAI client).
- Keep the surface small and stable; avoid leaking provider-specific
  fields into the public API.

### Prompt Shape (High-Level)

Prompts should:

- Be explicit about role (recruiter, account manager, support agent,
  etc.).
- Request both natural language and **structured JSON** outputs where
  needed.
- Emphasize:
  - No hallucinated facts (no fabricating salary, policy, etc.).
  - Tone: professional, friendly, concise.

You do not have to embed full prompt text here; see the thesis and
`PROMPT_TEMPLATE.md` for examples.

## Folder Structure

```text
/apps/ai-service
 ├── main.py           # FastAPI app factory and router wiring
 ├── routes/
 │    ├── summarize.py # /summarize endpoint
 │    └── reply.py     # /suggest-reply endpoint
 ├── services/
 │    ├── summarizer.py
 │    └── smart_reply.py
 ├── models/
 │    ├── summarize.py
 │    └── reply.py
 ├── core/
 │    ├── config.py    # settings, env vars
 │    └── llm_client.py# OpenAI/local model wrapper
 └── tests/
      └── ...          # optional pytest tests for routes/services
```

## Provider Integration

- Start with **OpenAI API** (or equivalent) for speed in the PoC.
- Hide provider details behind `llm_client.py` so that later
  migrations (e.g. to local models) do not affect route/service code.
- Use environment variables for API keys and model names.

Example config fields:

```text
OPENAI_API_KEY=
OPENAI_MODEL_NAME=gpt-4.1-mini
AI_SERVICE_LOG_LEVEL=INFO
```

## Future Extensions (Not Required for Initial FRs)

- Streaming responses via WebSocket for very long threads.
- RAG (Retrieval-Augmented Generation) over historical emails.
- Fine-tuned or LoRA-adapted models for brand-specific tone.
