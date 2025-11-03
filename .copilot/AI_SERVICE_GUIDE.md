# AI Service Guide (FastAPI)

## Overview

The AI service is a **standalone Python FastAPI app** responsible for:

* Text summarization (emails, chat threads)
* Key issue extraction
* Contextual reply suggestion
* Real-time streaming responses (via WebSocket)

---

## API Routes

### `POST /summarize`

Summarize email thread or chat messages.

**Request**

```json
{
  "thread": [
    {"from": "user@example.com", "text": "Hello, can we meet tomorrow?"},
    {"from": "me@example.com", "text": "Sure, what time works for you?"}
  ]
}
```

**Response**

```json
{
  "summary": "User asked to schedule a meeting. You confirmed availability.",
  "key_issues": ["Meeting scheduling"]
}
```

---

### `POST /suggest-reply`

Generate reply suggestion based on latest context.

**Request**

```json
{"context": "User asked for pricing details."}
```

**Response**

```json
{"suggestion": "Thank you for your interest! Our pricing plans are available at ..."}
```

---

### `WS /stream`

Stream real-time summaries as messages are processed.
Used for large or continuous inputs.

---

## Implementation Notes

* Use `pydantic` for schema validation.
* Use `async` endpoints for better concurrency.
* Add `Redis` integration for caching.
* Optional: integrate `OpenAI API`, `Hugging Face`, or `Ollama` for local inference.

---

## Folder Structure

```
/apps/ai-service
 ├── main.py
 ├── routes/
 ├── services/
 ├── models/
 ├── core/
 ├── tests/
```

---

## Future Plans

* Integrate LangChain or semantic memory.
* Allow multi-model orchestration.
* Extend WebSocket to support agent-like behaviors (AI agent suggestion).
