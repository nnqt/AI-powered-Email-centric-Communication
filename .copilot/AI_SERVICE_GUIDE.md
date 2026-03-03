# AI Service Guide (FastAPI)

This guide defines how the AI microservice should look and behave so
that the backend can reliably implement **FR-07 (thread summarization)
and FR-08 (smart reply suggestions)**.

## Overview

The AI service is a **standalone Python FastAPI app**. It:

- Exposes HTTP endpoints for summarization and smart replies.
- Encapsulates all interaction with **Google Gemini** via the `google-generativeai` library.
- Is stateless from the perspective of the backend (no direct DB
  access).
- Uses `python-dotenv` for environment variable management.

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
Supports two formats: `"message"` (short conversational) or `"email"` (full RFC 2822 style).

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
  "max_replies": 3,
  "format": "email"
}
```

**Response body** (example for `format: "email"`):

```json
{
  "thread_id": "abc123",
  "format": "email",
  "replies": [
    {
      "subject": "Re: Interview Confirmation",
      "body": "Kính gửi anh/chị,\n\nTôi xác nhận buổi phỏng vấn vào thứ Ba lúc 10:00 sáng...\n\nTrân trọng,\n[Tên của bạn]"
    }
  ]
}
```

**Response body** (example for `format: "message"`):

```json
{
  "thread_id": "abc123",
  "format": "message",
  "replies": [
    { "subject": null, "body": "Xác nhận rồi, gặp nhau lúc 10 giờ sáng nhé." },
    {
      "subject": null,
      "body": "Cảm ơn bạn đã liên hệ. Buổi phỏng vấn được xác nhận."
    }
  ]
}
```

All replies are always in Vietnamese (`_LANG_INSTRUCTION` applied to prompt).

## Implementation Guidelines

- Use **FastAPI** with `async def` endpoints.
- Introduce clear module boundaries:
  - `routes/` – FastAPI route definitions.
  - `services/` – business logic for talking to LLMs, building
    prompts, and post-processing.
  - `models/` – pydantic schemas for requests/responses.
  - `core/config.py` – configuration, environment variables (reads `GEMINI_API_KEY`, `GEMINI_MODEL_NAME`).
  - `core/llm_client.py` – Gemini client wrapper:
    - `GeminiSummarizationClient` — FR-07
    - `GeminiReplyClient` — FR-08 (returns `List[Dict]` with `subject` + `body`)
    - `GeminiContactEnrichClient` — FR-06
    - `GeminiMergeSuggestionClient` — FR-06
    - Token helpers: `_truncate()`, `_build_messages_text()`, `_MAX_TOTAL_CONTENT_CHARS = 12_000`
    - `_LANG_INSTRUCTION`: always respond in Vietnamese
  - `routes/contact.py` – `/enrich-contact` + `/suggest-merge` (FR-06)
  - `services/contact_enricher.py`, `merge_suggester.py` – FR-06 business logic
  - `models/contact.py` – `EnrichContactRequest`, `EnrichContactResponse`, `ContactSnippet`, `MergeSuggestion`
- Use `python-dotenv` and call `load_dotenv()` at the top of `main.py` before other imports to ensure env vars are available.
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
 ├── main.py           # FastAPI app factory, dotenv loading, router wiring
 ├── requirements.txt  # Dependencies: fastapi, google-generativeai, python-dotenv, etc.
 ├── routes/
 │    ├── summarize.py # /summarize endpoint (FR-07)
 │    ├── reply.py     # /suggest-reply endpoint (FR-08)
 │    └── contact.py   # /enrich-contact + /suggest-merge endpoints (FR-06)
 ├── services/
 │    ├── summarizer.py
 │    ├── smart_reply.py
 │    ├── contact_enricher.py
 │    └── merge_suggester.py
 ├── models/
 │    ├── summarize.py
 │    ├── reply.py       # SuggestReplyRequest (with format), ReplyItem, SuggestReplyResponse
 │    └── contact.py     # EnrichContactRequest, EnrichContactResponse, ContactSnippet, MergeSuggestion
 ├── core/
 │    ├── config.py    # Reads GEMINI_API_KEY, GEMINI_MODEL_NAME
 │    └── llm_client.py# All Gemini clients + token safety helpers + _LANG_INSTRUCTION
 └── tests/
      └── ...          # optional pytest tests for routes/services
```

## Provider Integration

- Uses **Google Gemini** via the `google-generativeai` library (free tier available).
- Provider details are hidden behind `llm_client.py` so that later
  migrations (e.g. to local models) do not affect route/service code.
- Use environment variables for API keys and model names.

Required environment variables:

```text
GEMINI_API_KEY=your-api-key
GEMINI_MODEL_NAME=gemini-2.0-flash
AI_SERVICE_LOG_LEVEL=INFO
```

## Contact Management Endpoints (FR-06)

Added alongside the original FR-07/08 endpoints:

### `POST /enrich-contact`

**Request**: `{ "email": "...", "name": "...", "conversation_snippet": "..." }`  
**Response**: `{ "display_name": "...", "org": "...", "language": "vi" }`

### `POST /suggest-merge`

**Request**: `{ "contacts": [{ "contact_id": "...", "email": "...", "name": "...", "alternate_emails": [] }] }`  
**Response**: `[{ "source_id": "...", "target_id": "...", "source_email": "...", "target_email": "...", "confidence": 0.92, "reason": "..." }]`

- Contacts list capped at 50 to avoid token overflow.
- Only pairs with `confidence >= 0.7` are returned.

## Token Safety (all endpoints)

```python
_MAX_TOTAL_CONTENT_CHARS = 12_000  # per-request content cap
_MAX_PER_MESSAGE_CHARS   = 1_500   # single message body
_MAX_SNIPPET_CHARS       = 400     # conversation snippet / contact snippet
```

`_truncate(text, max_chars)` hard-truncates and appends `… [truncated]`.

## Language Policy

`_LANG_INSTRUCTION` is prepended to summarization and reply prompts:

> “Always respond entirely in Vietnamese (Tiếng Việt), regardless of the language of the original email content.”

## Future Extensions (Not Required for Initial FRs)

- Streaming responses via WebSocket for very long threads.
- RAG (Retrieval-Augmented Generation) over historical emails.
- Fine-tuned or LoRA-adapted models for brand-specific tone.
