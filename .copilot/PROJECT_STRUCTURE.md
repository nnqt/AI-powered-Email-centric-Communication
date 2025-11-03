# Project Structure and Architecture

## Repository Type

**Monorepo** using a clean modular architecture for maintainability and extensibility.

```
/AI-powered-Email-centric-Communication
│
├── apps/
│   ├── frontend/          # Next.js app (React + TypeScript)
│   ├── backend/           # Next.js API backend (REST + Realtime)
│   └── ai-service/        # Python FastAPI microservice for AI tasks
│
├── infra/
│   ├── docker-compose.yml # Multi-service orchestration
│   ├── redis/             # Redis configuration
│   ├── mongo/             # MongoDB setup
│
├── shared/
│   ├── models/            # Shared TypeScript/Python models (schemas, DTOs)
│   ├── utils/             # Common helpers
│
├── copilot/               # AI helper documentation and guidance
│
└── README.md
```

---

## Communication Flow

1. **Frontend (Next.js)** → interacts with **Backend API** for CRUD and timeline data.
2. **Backend (Next.js API routes)** → communicates with:

   * **MongoDB** for storage,
   * **Redis** for caching and async queues,
   * **AI-Service (FastAPI)** via REST/WebSocket for summarization & NLP tasks.
3. **AI-Service (FastAPI)** → processes text, summarizes email threads, generates reply suggestions.

---

## Networking Layout (via Docker Compose)

| Service    | Port  | Depends On               |
| ---------- | ----- | ------------------------ |
| frontend   | 3000  | backend                  |
| backend    | 4000  | redis, mongo, ai-service |
| ai-service | 5000  | —                        |
| redis      | 6379  | —                        |
| mongo      | 27017 | —                        |

---

## Data Flow Example

1. Backend receives new email message (from IMAP/Gmail API).
2. It saves to MongoDB and pushes metadata to Redis cache.
3. Backend calls `/summarize` on the AI-Service.
4. AI-Service returns summary + key insights.
5. Backend updates MongoDB record and emits real-time event (via WebSocket).
6. Frontend updates user timeline instantly.

---

## Future Extensions

* Plug-in adapters for other messaging platforms.
* Add streaming summaries with OpenAI or Ollama local models.
* Integrate user management & authentication.
