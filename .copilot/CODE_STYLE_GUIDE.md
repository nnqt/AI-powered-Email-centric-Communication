# Code Style and Conventions

This guide defines common coding patterns so that generated code is
consistent across the monorepo and easy to extend when more FRs are
implemented.

## General Principles

- Prefer **clear, small, testable modules** over large files.
- Use **TypeScript** for frontend and backend; **Python 3.12+** for
  the AI service.
- Design APIs with **async-first** patterns (non-blocking I/O).
- Always read sensitive configuration from environment variables; do
  not hard-code secrets.
- Log errors and critical operations in a structured, minimal way.

## Frontend (Next.js)

- Use **functional components** and **React Hooks** only.
- Co-locate logic with features when possible, but keep shared
  utilities in dedicated folders.
- Prefer **SWR** or **React Query** (or Next.js `fetch` in Server
  Components) for data fetching instead of manual `useEffect`
  - `fetch`.
- Suggested structure under `apps/frontend/src` (or equivalent):

  ```text
  /app              # Next.js app directory
  /components       # Reusable UI pieces
  /features         # Feature-oriented modules (timeline, contact, email)
  /hooks            # Custom React hooks
  /services         # HTTP clients (calling backend APIs)
  /types            # Shared TypeScript types
  ```

- Use **TailwindCSS** for styling; favor utility classes over custom
  CSS when reasonable.
- Keep components presentational where possible; move side effects and
  data fetching to hooks or feature modules.

## Backend (Next.js API Routes)

- Treat each route handler as a **thin controller**:
  - Validate input.
  - Call domain/service functions.
  - Map results to HTTP responses.
- Use **REST-like** naming:
  - `GET /api/threads`
  - `GET /api/threads/:id`
  - `POST /api/threads/:id/summary`
  - `POST /api/threads/:id/replies`
- Organize backend code by feature, not by technical layer only, for
  example:

  ```text
  /apps/backend/src
    /app/api          # Next.js route handlers
    /modules
      /email          # Email integration, Gmail API, etc. (FR-01/02)
      /timeline       # Timeline queries and aggregation (FR-03/04)
      /ai             # Clients to AI service (FR-07/08)
      /common         # Shared helpers, error handling
  ```

- Use **async** database and Redis clients.
- Wrap external calls (email provider, AI service) in dedicated client
  modules to simplify mocking and future provider changes.
- For realtime features (FR-04), add WebSocket or Next.js Route
  Handler-based streaming where appropriate; centralize connection
  management.

## AI Service (FastAPI)

- Use **pydantic** models for all request/response bodies.
- Separate layers:
  - `routes/` for HTTP endpoints.
  - `services/` for LLM-related logic.
  - `core/` for configuration and client setup.
- All public endpoints should be `async def` and non-blocking.
- Include minimal but clear docstrings and type hints.
- Log:
  - Route-level events (request received, success/failure).
  - Provider errors with enough context but without leaking secrets.

## Naming & Style

- JavaScript/TypeScript:
  - Variables and functions: `camelCase`.
  - React components and classes: `PascalCase`.
- Python:
  - Variables and functions: `snake_case`.
  - Classes: `PascalCase`.
- Constants in both languages: `UPPER_SNAKE_CASE`.
- Function names should be **verb + noun**, e.g.:
  - `fetchEmails`, `syncThread`, `generateSummary`, `suggestReplies`.
- Avoid cryptic abbreviations; use meaningful names.

## Error Handling

- Prefer returning structured error objects (with `code` and `message`)
  from API routes instead of raw strings.
- For recoverable errors (e.g. temporary AI failure), propagate a
  clear message and let the UI decide how to communicate it.
- For unrecoverable errors, log and fail fast; do not silently swallow
  exceptions.
