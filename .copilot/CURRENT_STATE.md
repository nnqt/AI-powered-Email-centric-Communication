# Current State – December 8, 2025

## Implemented Features

### Authentication

- Google OAuth via NextAuth v4 in `apps/backend`.
- `User` records are upserted on sign-in with Google profile + tokens.
- NextAuth `jwt` and `session` callbacks load the MongoDB `_id` and expose it as `session.user.id` for API routes.

### FR-01 – Email Sync (Backend)

- `GmailService` in `apps/backend/src/modules/email/gmail.service.ts`:
  - Uses `googleapis` + OAuth2 with stored `refreshToken` to access the Gmail API.
  - Fetches recent threads (`users.threads.list`, limit 10) and full thread data (`users.threads.get`).
  - Parses Gmail payloads (multipart/alternative) to extract the best HTML or text body.
  - Upserts `Thread` and `Message` documents with MongoDB `findOneAndUpdate` (idempotent sync).
- Sync API route `POST /api/emails/sync`:
  - Uses `getServerSession` to ensure the caller is authenticated.
  - Reads `session.user.id` (Mongo `_id`) and invokes `GmailService.syncEmails(userId)`.
  - Returns `{ syncedMessages }` JSON.

### FR-03 – Inbox / Timeline (Backend + Frontend)

- `TimelineService` in `apps/backend/src/modules/timeline/timeline.service.ts`:
  - `getThreads(userId, limit)` returns the users threads sorted by `lastMessageDate` (newest first) for inbox view.
  - `getThreadDetails(userId, threadId)` returns a single thread plus its messages, sorted chronologically.
- Backend timeline APIs:
  - `GET /api/threads`  returns a JSON list of threads for the authenticated user (optional `?limit=`).
  - `GET /api/threads/[threadId]`  returns `{ thread, messages }` for the authenticated owner; 404 if not found.
- Frontend inbox UI in `apps/frontend`:
  - `useThreads` hook (`src/hooks/useThreads.ts`) uses SWR + `apiClient` to fetch `/api/threads` and exposes `{ threads, isLoading, isError, mutate }`.
  - `ThreadList` component (`src/features/inbox/ThreadList.tsx`) renders an inbox list with snippet and relative `lastMessageDate` using `date-fns`.
  - `SyncButton` component (`src/components/SyncButton.tsx`) checks `useSession`, calls `POST /api/emails/sync`, and triggers `mutate()` to refresh the inbox.
  - Home page (`src/app/page.tsx`) shows:
    - A sign-in card ("Continue with Google") when unauthenticated.
    - An inbox view with header (user name) + `SyncButton` + `ThreadList` when authenticated.

### FR-07 – Thread Summarization (Backend + AI Service + Frontend)

- **AI Service** (`apps/ai-service`):
  - `POST /summarize` endpoint returns structured JSON with `summary`, `key_issues`, and `action_required`.
  - `core/llm_client.py` uses `GeminiSummarizationClient` to generate summaries via Google Gemini.
  - Prompt engineering forces valid JSON output; handles markdown code block wrapping.
- **Backend** (`apps/backend`):
  - `Thread` model extended with `summary` field (`IThreadSummary` interface).
  - `AIService` in `src/modules/ai/ai.service.ts` calls the AI service `/summarize` endpoint.
  - `POST /api/threads/[threadId]/summarize` route fetches messages, calls AI service, stores summary in MongoDB.
- **Frontend** (`apps/frontend`):
  - `AISummaryCard` component displays summary with key issues (bullets) and action items (checklist).
  - `useThreadDetail` hook fetches single thread + messages.
  - Thread detail page (`/threads/[id]`) integrates summarization UI with "✨ Summarize this Thread" button.
  - `ThreadList` items are clickable, linking to thread detail pages.

## Architecture Decisions

- **Ports**:

  - Backend Next.js app (`apps/backend`) runs on port **4000**.
  - Frontend Next.js app (`apps/frontend`) runs on port **3000**.

- **Proxy / Rewrites**:

  - `apps/frontend/next.config.ts` defines `rewrites()` so any request to `/api/:path*` on port 3000 is proxied to `http://localhost:4000/api/:path*`.
  - Frontend code calls relative `/api/...` paths; the proxy hides the backend origin.

- **API Client**:

  - `apps/frontend/src/lib/api.ts` configures an axios instance with:
    - `baseURL` = `process.env.NEXT_PUBLIC_BACKEND_URL` (points to backend, but requests still go through the Next.js rewrite when called as `/api/...`).
    - `withCredentials: true` so cookies/session are sent with each request.

- **Auth Session Shape**:

  - `apps/backend/src/types/next-auth.d.ts` extends NextAuth types so `session.user.id` (MongoDB `_id` as string) and `token.id` are available.
  - `authOptions` (in `apps/backend/src/lib/auth.ts`):
    - `jwt` callback:
      - Connects to MongoDB.
      - Finds the `User` by `token.email`.
      - Stores `_id.toString()` as `token.id`.
    - `session` callback:
      - Copies `token.id` into `session.user.id`.

- **CORS Handling** (Backend):

  - CORS configuration moved from `middleware.ts` to `next.config.ts` using the `headers()` function to avoid Next.js middleware warnings.
  - `Access-Control-Allow-Origin: http://localhost:3000`.
  - `Access-Control-Allow-Credentials: true`.
  - Supports all standard HTTP methods and headers for API routes.

- **Root Script Strategy**:

  - The root `package.json` uses `npm-run-all` to orchestrate the hybrid development environment.
  - **Hybrid Architecture**: Docker Compose runs databases (MongoDB), while apps run locally on the host.
  - Key commands:
    - `npm run dev:setup:ai` – Creates Python venv and installs AI service dependencies.
    - `npm run dev:db` – Starts MongoDB in Docker.
    - `npm run start:all` – Runs all services in parallel (DB, Backend, Frontend, AI Service).
  - This approach provides faster iteration than full Docker builds while maintaining consistent database state.

- **AI Service Provider**:
  - `apps/ai-service` uses **Google Gemini** via the `google-generativeai` package (switched from OpenAI).
  - `python-dotenv` is used for environment variable management, loaded at the top of `main.py`.
  - `core/config.py` reads `GEMINI_API_KEY` and `GEMINI_MODEL_NAME` (default: `gemini-1.5-flash`).
  - `core/llm_client.py`:
    - Configures a `GenerativeModel` and exposes:
      - `GeminiSummarizationClient.summarize_thread(...)` – returns structured JSON dict for a thread.
      - `GeminiReplyClient.suggest_replies(...)` – returns a list of reply option strings.
    - Error handling ensures empty/blocked responses raise clear runtime errors.
    - JSON parsing handles markdown code block wrapping from Gemini responses.

## Database Schema

### User (`apps/backend/src/models/User.ts`)

- `email: string` (required, indexed).
- `name?: string`.
- `image?: string`.
- `googleId: string` (required, unique; maps to Google account).
- `accessToken?: string` (latest Google access token).
- `refreshToken?: string` (critical for background Gmail sync).
- Timestamps: `createdAt`, `updatedAt` (managed by Mongoose).

### Thread (`apps/backend/src/models/Thread.ts`)

- `id: string`  Gmail **thread ID** (required, unique, indexed).
- `userId: ObjectId`  reference to `User` (owner of the thread).
- `historyId?: string`  Gmail history marker for incremental sync.
- `snippet?: string`  short preview from Gmail.
- `lastMessageDate?: Date`  timestamp of the most recent message in the thread.
- Timestamps: `createdAt`, `updatedAt`.

### Message (`apps/backend/src/models/Message.ts`)

- `id: string`  Gmail **message ID** (required, unique, indexed).
- `threadId: ObjectId`  reference to `Thread` (parent conversation).
- `userId: ObjectId`  reference to `User` (owner).
- `from?: string`  raw "From" header.
- `to: string[]`  parsed list from the "To" header.
- `subject?: string`  from "Subject" header.
- `body?: string`  decoded HTML or text content from Gmail payload.
- `snippet?: string`  Gmail snippet.
- `date?: Date`  message date from `internalDate`.
- `labelIds: string[]`  Gmail label IDs.
- Timestamps: `createdAt`, `updatedAt`.

## Next Steps / Priorities

- **FR-02 – Basic Email Operations (Next Priority)**

  - Implement backend routes to:
    - Mark messages/threads as read/unread.
    - Archive / add labels.
    - Send email via Gmail API (`users.messages.send`), ensuring sent emails are reflected in MongoDB and in Gmail.
  - Extend frontend UI for read state, labels, and a basic composer.

- **FR-08 – Smart Reply Suggestions (Next Priority)**

  - Finalize `POST /suggest-reply` endpoint in AI service.
  - Implement backend integration to call the AI service and return reply options.
  - Add UI component in thread detail/composer to display and select suggested replies.
