# Code Style and Conventions

## General Guidelines

* Use **clear, modular, and documented** code.
* Use **TypeScript** for frontend/backend and **Python 3.10+** for AI service.
* Follow **async-first** design for APIs.
* Always log errors and critical operations.
* Use environment variables from `.env` (never hard-code credentials).

---

## Frontend (Next.js)

* Use **functional components** and **React Hooks**.
* Use **SWR or React Query** for data fetching.
* Define API routes in `/apps/backend/api/`.
* Maintain folder structure:

  ```
  /components
  /pages
  /hooks
  /services
  /types
  ```
* Use TailwindCSS for styling.
* Keep UI minimal and responsive.

---

## Backend (Next.js API Routes)

* Each route in `/api` handles one responsibility (CRUD, summary, contact, etc.).
* Use **REST naming** conventions:

  * `GET /api/messages`
  * `POST /api/messages`
  * `POST /api/summary`
* Add **WebSocket support** using `socket.io` or Next.js native route handler.
* Use **Redis** for:

  * caching AI summaries
  * real-time queue updates

---

## AI Service (Python - FastAPI)

* Use **pydantic models** for request/response validation.
* Create separate modules:

  * `/routes`
  * `/services`
  * `/models`
  * `/core`
* Add `/ws` route for streaming responses.
* Log all incoming requests and AI output.
* Write docstrings and type hints.

---

## Naming & Style

* Variable names: `camelCase` (JS), `snake_case` (Python)
* Functions: verb + noun → `fetchEmails`, `generate_summary`
* Constants: `UPPER_CASE`
* Avoid abbreviations except standard (e.g., `msg`, `cfg`)
