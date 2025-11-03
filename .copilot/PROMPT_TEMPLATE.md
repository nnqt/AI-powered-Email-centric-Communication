# Copilot Prompt Templates

## 🧠 General Role

You are **GitHub Copilot**, coding assistant for a multi-service project built in:

* Next.js (frontend + backend)
* Python (FastAPI AI microservice)
* Redis + MongoDB
* Docker Compose for orchestration

Always:

* follow async patterns,
* write modular, documented code,
* respect the monorepo structure from `/copilot/PROJECT_STRUCTURE.md`.

---

## 🔧 Common Prompts

### 1. Generate a REST API route

> “Create a Next.js API route `/api/messages` that connects to MongoDB, returns paginated email records, and caches results in Redis.”

### 2. Implement AI summarization endpoint

> “Write FastAPI route `/summarize` that accepts a list of messages and returns a concise summary and key points.”

### 3. Add WebSocket streaming

> “Add WebSocket support in FastAPI to stream partial summaries as the model processes data.”

### 4. Implement MongoDB data model

> “Define a Mongoose schema for EmailThread with sender, receiver, subject, content, and summary fields.”

### 5. Integrate with AI service

> “In the backend, create a helper function that calls AI service at `/summarize` using Axios, handles timeouts, and caches results.”

### 6. Build frontend timeline UI

> “Create a React component `TimelineView` that shows conversation threads grouped by contact, using Tailwind for styling.”

---

## 🧩 Specialized Prompts

### AI Function Prompts

> “Write Python service in `/services/summarizer.py` that uses OpenAI API to summarize multiple emails asynchronously.”

### Realtime Updates

> “Implement Redis pub/sub channel `updates` to broadcast new summaries to connected frontend WebSocket clients.”

### Docker Helpers

> “Generate Dockerfile for Next.js app and FastAPI AI service, optimized for development with hot-reload.”

---

## ✅ Tone & Output Expectations

* Write concise, production-grade code.
* Include comments where logic is non-trivial.
* When unsure, provide flexible scaffolding instead of hardcoding.
* Align with code conventions in `CODE_STYLE_GUIDE.md`.
