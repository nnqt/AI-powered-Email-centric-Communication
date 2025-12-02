# AI-Powered Email-Centric Communication Platform – Copilot Overview

## Your Role

You are GitHub Copilot assisting on a **monorepo** for an
**email-centric communication platform**. The platform aims to:

- Centralize email-based communication into a unified timeline per contact.
- Use AI to summarize threads and suggest smart replies.
- Prepare for future multi-channel extensions (Zalo, WhatsApp, Telegram, etc.).

When a new chat starts, you should quickly rebuild this mental model
from the Markdown files in `.copilot/` without needing the LaTeX report.

## Current Implementation Focus

The project is in the **initial stage**. The immediate goal is to
implement a minimal but clean PoC that covers these functional
requirements (FR) from the thesis:

- **FR-01 – Email sync (near real-time)**
- **FR-02 – Basic email operations (read/archive/labels)**
- **FR-03 – Contact-centric timeline view**
- **FR-04 – Real-time UI update (timeline refresh)**
- **FR-07 – Thread summarization (AI)**
- **FR-08 – Smart reply suggestions (AI)**

Other FRs/NFRs exist in the thesis but are **not priority to
implement yet**. You should design code and architecture in a way that
they can be added later without major refactors.

## High-Level Architecture

This is a **backend–frontend–AI microservice** architecture using
Docker Compose:

- `apps/frontend` – Next.js app (React + TypeScript).
- `apps/backend` – Next.js API backend (REST + realtime).
- `apps/ai-service` – FastAPI microservice for summarization and
  smart replies.
- `infra` – Docker Compose files, Redis and MongoDB configuration.
- `shared` – Future home for shared models/utilities (may be empty at
  the moment).

Key ideas:

- **Backend is email-centric**: it exposes APIs around email threads,
  contacts, and timelines, not just raw messages.
- **AI Service is independent**: it talks to the backend via HTTP
  (and optionally WebSocket) and never touches the database directly.
- **Redis** is used for caching and async/queue-like patterns.
- **MongoDB** stores email threads, contacts, summaries, and metadata.

## How You Should Help

When generating or editing code:

1. **Respect the structure** described in
   `PROJECT_STRUCTURE.md` and `AI_BACKEND_GUIDE.md`.
2. **Map features to FRs**:
   - FR-01/02 – email sync and basic operations.
   - FR-03/04 – contact-centric timeline and realtime refresh.
   - FR-07/08 – AI summarization and smart replies.
3. **Favor async, scalable patterns**:
   - Non-blocking I/O in Next.js API routes.
   - Async FastAPI endpoints.
   - Clear separation between HTTP handlers, services, and data layer.
4. **Produce production-friendly code** even in PoC:
   - Small, testable modules.
   - Clear naming and typing.
   - No hard-coded secrets; use environment variables.
5. **Be explicit about assumptions** when something in the thesis is
   not yet implemented in code.

For more detailed guidance, consult:

- `PROJECT_STRUCTURE.md` – repository layout and responsibilities.
- `ARCHITECTURE_FR_GUIDE.md` – mapping between thesis requirements and
  code modules.
- `AI_SERVICE_GUIDE.md` – AI microservice contracts and patterns.
- `CODE_STYLE_GUIDE.md` – language- and layer-specific conventions.
