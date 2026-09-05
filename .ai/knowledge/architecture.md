# Architecture & FR Guide

## Monorepo Structure

```
/AI-powered-Email-centric-Communication
├── apps/
│   ├── frontend/      # Next.js 16 — port 3000
│   ├── backend/       # Next.js 16 API + Socket.IO — port 4000
│   └── ai-service/    # FastAPI — port 5000
├── infra/
│   └── docker-compose.yml
├── thesis-template-master/  # LaTeX thesis (bkthesis.sty)
├── .ai/               # Canonical AI knowledge base
├── .agents/            # Antigravity adapter (symlinks → .ai/)
└── .github/            # Copilot instructions (refs → .ai/)
```

## Services & Ports

| Service       | Host Port | Internal Docker URL              |
| ------------- | --------- | -------------------------------- |
| Frontend      | 3000      | —                                |
| Backend       | 4000      | `http://backend:4000`            |
| AI Service    | 5000      | `http://ai-service:5000`         |
| MongoDB       | 27017     | `mongodb://mongo:27017/emailhub` |
| Redis         | 6379      | `redis://redis:6379`             |
| mongo-express | 8081      | `http://localhost:8081`          |

## Communication Flow

1. **Frontend → Backend**: fetch contact timeline, open a thread, request smart replies.
2. **Backend → MongoDB**: store and retrieve email threads, contacts, summaries, and metadata.
3. **Backend → Redis**: cache summaries and use pub/sub for async processing.
4. **Backend → AI Service**: send requests for summarization, smart replies, contact enrichment, topic classification.
5. **AI Service → Google Gemini**: call Gemini API for LLM capabilities.
6. **Backend → Frontend**: Socket.IO room `user:<userId>`; events: `EMAIL_SYNCED`, `SUMMARY_READY`, `EMAIL_SENT`, `NEW_TELEGRAM_MESSAGE`, `AI_JOB_START`, `AI_JOB_DONE`.

## Implementation Status

| FR    | Description                                                   | Status |
| ----- | ------------------------------------------------------------- | ------ |
| FR-01 | Email sync (near real-time)                                   | ✅     |
| FR-02 | Compose + send (rich text + attachments)                      | ✅     |
| FR-03 | Manage read/unread/archive/labels (two-way sync)              | ✅     |
| FR-04 | Inbox + Thread timeline view                                  | ✅     |
| FR-05 | Real-time UI update (WebSocket)                               | ✅     |
| FR-06 | AI-assisted Contact Management (auto-create + enrich + merge) | ✅     |
| FR-07 | Thread summarization (AI)                                     | ✅     |
| FR-08 | Smart reply suggestions (AI)                                  | ✅     |
| FR-09 | Multi-channel — Telegram Client (GramJS MTProto)              | ✅     |
| FR-10 | Topic Intelligence + Focus Page                               | ✅     |

## Responsibilities by App

### `apps/frontend`

- Next.js app responsible for:
  - Rendering the **contact-centric timeline** (FR-03).
  - Displaying email threads and AI-generated summaries.
  - Showing smart reply suggestions (FR-08).
  - Subscribing to realtime updates from the backend (FR-04/05).
  - Focus page with topic cards and score bars (FR-10).
  - Telegram chat interface (FR-09).

### `apps/backend`

- Next.js API backend responsible for:
  - Integrating with Gmail API for email sync (FR-01/FR-02).
  - REST endpoints for threads, contacts, summaries, topics, and replies.
  - Managing MongoDB persistence and Redis caching.
  - Calling AI service for summarization, smart replies, and classifications (FR-07/FR-08).
  - Socket.IO realtime events (FR-05).
  - GramJS Telegram integration (FR-09).

### `apps/ai-service`

- FastAPI microservice responsible for:
  - Thread summarization (FR-07): `POST /summarize`.
  - Smart reply suggestion (FR-08): `POST /suggest-reply`.
  - Contact enrichment + merge suggestions (FR-06): `POST /enrich-contact`, `POST /suggest-merge`.
  - AI urgent classification: `POST /classify-urgent`.
  - Thread category classification: `POST /classify-thread-category`.
  - Topic labeling: `POST /label-topic`.
  - Telegram chat analysis: `POST /analyze-chat-chunk`.
  - Strictly stateless HTTP contracts; does **not** access MongoDB directly.

## Design Principles

- Keep the **AI service independent** from storage; all data access is via the backend.
- Use **MongoDB** for flexible, semi-structured documents.
- Use **Redis** where it simplifies caching or realtime events.
- **FR numbering follows thesis** (`thesis-template-master/Chapters/Chapter2-RequirementAnalysis.tex`).
- Implement only the required FRs first, but structure code for easy extension.
