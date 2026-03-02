# Current State – March 3, 2026

## Deployment Mode

All services run fully via **Docker Compose** (`infra/docker-compose.yml`).

```
Browser → http://localhost:3000  (frontend container)
       → /api/* rewrites → http://backend:4000  (internal Docker network)
       → Google OAuth callback → http://localhost:4000/api/auth/callback/google
       → AI calls → http://ai-service:5000
       → MongoDB → mongo:27017
       → Redis  → redis:6379
```

**Start everything:**

```bash
cd infra
docker compose build --no-cache
docker compose up -d
```

---

## Services & Ports

| Service    | Host port | Internal Docker URL              |
| ---------- | --------- | -------------------------------- |
| Frontend   | 3000      | —                                |
| Backend    | 4000      | `http://backend:4000`            |
| AI Service | 5000      | `http://ai-service:5000`         |
| MongoDB    | 27017     | `mongodb://mongo:27017/emailhub` |
| Redis      | 6379      | `redis://redis:6379`             |

---

## Implemented Features

### Authentication (NextAuth v4)

- Google OAuth provider in `apps/backend/src/lib/auth.ts`.
- On sign-in: upsert `User` in MongoDB with `googleId`, `email`, `name`, `image`, `accessToken`, `refreshToken`.
- `jwt` callback:
  - Stores `accessToken`, `refreshToken`, `expiresAt` in JWT on initial sign-in.
  - Auto-refreshes Google access token when within 5 min of expiry via `https://oauth2.googleapis.com/token`.
  - Sets `token.error = "RefreshTokenError"` if refresh fails.
  - Loads `User._id` from MongoDB and stores as `token.id`.
- `session` callback: exposes `session.user.id` (MongoDB `_id`) and propagates `session.error`.
- Frontend (`apps/frontend/src/app/page.tsx`): `session.error === "RefreshTokenError"` → shows toast + sign-out.
- `apps/backend/src/types/next-auth.d.ts` extends types with `id`, `error` on `Session` and `JWT`.

**Google Cloud Console required config:**

- Authorized JavaScript origins: `http://localhost:3000`, `http://localhost:4000`
- Authorized redirect URIs: `http://localhost:4000/api/auth/callback/google`

### FR-01 – Email Sync

`GmailService` (`apps/backend/src/modules/email/gmail.service.ts`):

- `syncEmails(pageToken?)`: fetches up to 50 threads per call using `users.threads.list`.
- Extracts `participants` (From + To headers), `subject`, `snippet` (fallback to last `msg.snippet`).
- Upserts `Thread` and `Message` documents (idempotent).
- Stores `nextPageToken` in `User.gmailNextPageToken`; sets `gmailSyncComplete = true` when done.
- Returns `{ syncedMessages, nextPageToken, hasMore }`.

API routes:

- `POST /api/emails/sync` – body `{ pageToken? }` → calls `syncEmails(pageToken)`. Auth errors → 401.
- `GET /api/emails/sync` – returns `{ hasMore, nextPageToken, syncComplete }` from User record.

`SyncButton` (`apps/frontend/src/components/SyncButton.tsx`):

- On mount: `GET /api/emails/sync` to preload `hasMore` / `nextPageToken`.
- Button text: `"Syncing..."` / `"Sync More Emails"` / `"Sync Inbox"`.
- Auto-retry once on network error (2s delay). Auth errors handled by axios interceptor.
- Success/error feedback via `useToast()`.

### FR-03 – Inbox / Timeline

`TimelineService` (`apps/backend/src/modules/timeline/timeline.service.ts`):

- `getThreads(userId, limit=20, cursor?)`: cursor-based pagination using composite key `"lastMessageDate_id"`.
- `getThreadDetails(userId, threadId)`: trả về thread + toàn bộ messages.
- Returns `PaginatedThreadsResult { threads, total, hasNext, hasPrev }`.

API routes:

- `GET /api/threads?limit=&cursor=` – paginated thread list.
- `GET /api/threads/[threadId]` – single thread + messages.

`useThreads` hook (`apps/frontend/src/hooks/useThreads.ts`):

- SWR-based, manages `cursor` state.
- `ThreadDTO` bao gồm `isRead?: boolean`, `isArchived?: boolean`.
- Exposes `{ threads, total, hasNext, hasPrev, currentPage, goToNextPage, goToPrevPage, mutate }`.

`ThreadList` (`apps/frontend/src/features/inbox/ThreadList.tsx`):

- Gmail-style pagination header: `"1–20 of 1,234"` + ← Newer / Older → buttons.
- Sender từ `thread.participants[0]` (strips `<email>` nếu có display name).
- Unread dot màu indigo + sender/subject hiện **bold** khi `isRead === false`.
- Hover hover-group hiện 2 action icon: toggle read/unread, archive — cả hai dùng **optimistic UI** với `mutate()` revert on error.
- Snippet preview; relative time via `date-fns`.

### FR-07 – Thread Summarization

AI Service (`apps/ai-service`):

- `POST /summarize` → `{ summary, key_issues, action_required }` via Google Gemini (`gemini-2.0-flash`).
- `GeminiSummarizationClient` và `GeminiReplyClient` trong `core/llm_client.py`.
- Handles markdown code block wrapping trong Gemini JSON output.

Backend:

- `AIService.summarizeThread()` (`apps/backend/src/modules/ai/ai.service.ts`) — gọi AI service via axios.
- `POST /api/threads/[threadId]/summarize` → lưu result vào `thread.summary` trong MongoDB.

Frontend:

- `AISummaryCard` (`apps/frontend/src/components/AISummaryCard.tsx`):
  - Shows `"Summarize this Thread"` button khi `!summary || !summary.text`.
  - Hiển thị summary + key issues + action items khi có kết quả.
  - `"Regenerate"` link để re-trigger.

### FR-02 – Basic Email Operations

`GmailService` (`apps/backend/src/modules/email/gmail.service.ts`):

- `markRead(gmailThreadId, read)`: add/remove `UNREAD` Gmail label + update `Thread.isRead` trong DB.
- `archiveThread(gmailThreadId)`: remove `INBOX` label + set `Thread.isArchived = true`.
- `sendEmail({ to, subject, body, threadId? })`: RFC 2822 MIME encode → `users.messages.send` → upsert Thread + Message vào MongoDB.

API routes:

- `PATCH /api/threads/[threadId]/read` – body `{ read: boolean }`.
- `PATCH /api/threads/[threadId]/archive`.
- `POST /api/emails/send` – body `{ to, subject, body, threadId? }`.

Frontend:

- `ComposeDrawer` (`apps/frontend/src/components/ComposeDrawer.tsx`): bottom slide-up drawer, ESC + backdrop close, gọi `POST /api/emails/send`, hiển thị error inline.
- Inbox `page.tsx`: nút "Compose" (indigo, + icon) → `setComposeOpen(true)` → mở `ComposeDrawer`.
- Thread detail `page.tsx`: nút "Reply" → mở `ComposeDrawer` pre-filled `to`, `subject`, `replyToThreadId`. `useEffect` auto-marks thread as read khi component mount.

### FR-08 – Smart Reply Suggestions

AI Service (`apps/ai-service`):

- `POST /suggest-reply` → `{ thread_id, replies[] }` via `GeminiReplyClient.suggest_replies()`.
- Parse numbered list từ Gemini text response thành `string[]`.

Backend:

- `AIService.suggestReplies(threadId, latestMessage, context?, maxReplies=3)` — POST `${AI_SERVICE_URL}/suggest-reply`, trả về `string[]`.
- `POST /api/threads/[threadId]/suggest-reply` — tự resolve thread+messages từ DB qua `TimelineService`, no request body needed, trả về `{ threadId, replies[] }`.

Frontend:

- `SmartReplyBar` (`apps/frontend/src/components/SmartReplyBar.tsx`): nút "Generate suggestions" → spinner → 2-3 chip buttons (truncated 60 chars). "↻ Regenerate" sau khi đã generate.
- Click chip → `onSelect(reply)` → `handleOpenReply(reply)` → mở `ComposeDrawer` với `initialBody` pre-filled.
- Đặt giữa `AISummaryCard` và danh sách messages trong thread detail page.

### Toast Notification System

- `Toast.tsx` (`apps/frontend/src/components/Toast.tsx`): `ToastProvider` + `useToast()` hook.
- Slide-in animation, auto-dismiss 5s, types: `success | error | info`.
- Wrapped in `apps/frontend/src/app/layout.tsx`.

### Auth Error Handling (Frontend)

- `apps/frontend/src/lib/api.ts` axios response interceptor:
  - 401 → `signOut({ redirect: false })` + `window.location.href = "/"`.
  - 403 → rejects with `isForbiddenError: true`.

---

## Architecture & Key Decisions

### Docker / Build

- Each app has its **own build context** (`apps/frontend`, `apps/backend`, `apps/ai-service`). No cross-references.
- **Frontend Dockerfile**: `ARG BACKEND_INTERNAL_URL=http://backend:4000` baked at build time because `rewrites()` in `next.config.ts` is evaluated at build, not runtime.
- **Backend / Frontend**: multi-stage builds, `output: "standalone"` → `node server.js`.
- **AI Service**: single-stage Python 3.11-slim, `uvicorn main:app --host 0.0.0.0 --port 5000`.
- `curl` installed in backend and ai-service runner images for Docker healthchecks.
- `depends_on` with `condition: service_healthy` for correct start order.

### Production Runtime Fixes Applied

| File                                 | Issue                                                                                      | Fix                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------- | --------------------------------- |
| `src/lib/axiosClient.ts`             | Top-level `throw` failed Next.js build-time page collection                                | `                                             |            | 'http://localhost:5000'` fallback |
| `src/lib/db.ts`                      | Same top-level `throw` for `MONGO_URI`                                                     | Moved validation inside `connectToDatabase()` |
| `src/lib/logger.ts`                  | `pino-pretty` uses worker threads, crashes in standalone                                   | Only loaded when `NODE_ENV === 'development'` |
| `src/modules/email/gmail.service.ts` | `nextPageToken` typed `string                                                              | null                                          | undefined` | `?? undefined` coercion           |
| `src/models/User.ts`                 | `gmailNextPageToken`, `gmailSyncComplete` in TS interface but missing from Mongoose schema | Added to schema                               |

### Frontend → Backend Proxy

`apps/frontend/next.config.ts` rewrites:

- Docker: `BACKEND_INTERNAL_URL=http://backend:4000` (build arg in Dockerfile)
- Local dev: falls back to `http://localhost:4000`

### Required `.env` values

`apps/backend/.env`:

```
PORT=4000
NEXTAUTH_URL=http://localhost:4000
NEXTAUTH_SECRET=<secret>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
MONGO_URI=mongodb://localhost:27017/emailhub   # overridden to mongo:27017 by docker-compose
REDIS_URL=redis://localhost:6379               # overridden to redis:6379 by docker-compose
AI_SERVICE_URL=http://localhost:5000           # overridden to ai-service:5000 by docker-compose
```

`apps/frontend/.env`:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<same as backend>
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

`apps/ai-service/.env`:

```
GEMINI_API_KEY=<key>
GEMINI_MODEL_NAME=gemini-2.0-flash
```

---

## Database Schema

### User (`apps/backend/src/models/User.ts`)

| Field                    | Type    | Notes                         |
| ------------------------ | ------- | ----------------------------- |
| `email`                  | String  | required, indexed             |
| `name`                   | String  | optional                      |
| `image`                  | String  | optional                      |
| `googleId`               | String  | required, unique              |
| `accessToken`            | String  | latest Google access token    |
| `refreshToken`           | String  | for token refresh + Gmail API |
| `gmailNextPageToken`     | String  | null when fully synced        |
| `gmailSyncComplete`      | Boolean | true when no more Gmail pages |
| `createdAt`, `updatedAt` | Date    | Mongoose timestamps           |

### Thread (`apps/backend/src/models/Thread.ts`)

| Field                    | Type     | Notes                                       |
| ------------------------ | -------- | ------------------------------------------- |
| `id`                     | String   | Gmail thread ID, required, unique           |
| `userId`                 | ObjectId | ref: User                                   |
| `historyId`              | String   | Gmail history marker                        |
| `snippet`                | String   | preview text                                |
| `lastMessageDate`        | Date     | for sorting + pagination cursor             |
| `participants`           | String[] | From + To across all messages               |
| `subject`                | String   | first message Subject header                |
| `summary`                | Object   | `{ text, key_issues[], action_required[] }` |
| `isRead`                 | Boolean  | default false                               |
| `isArchived`             | Boolean  | default false                               |
| `createdAt`, `updatedAt` | Date     | Mongoose timestamps                         |

### Message (`apps/backend/src/models/Message.ts`)

| Field                    | Type     | Notes                              |
| ------------------------ | -------- | ---------------------------------- |
| `id`                     | String   | Gmail message ID, required, unique |
| `threadId`               | ObjectId | ref: Thread                        |
| `userId`                 | ObjectId | ref: User                          |
| `from`                   | String   | raw From header                    |
| `to`                     | String[] | parsed To header                   |
| `subject`                | String   | Subject header                     |
| `body`                   | String   | decoded HTML or text               |
| `snippet`                | String   | Gmail message snippet              |
| `date`                   | Date     | from `internalDate`                |
| `labelIds`               | String[] | Gmail label IDs                    |
| `createdAt`, `updatedAt` | Date     | Mongoose timestamps                |

---

## Known Issues / Next Steps

### FR-04 – WebSocket Realtime (Next Priority)

- Tích hợp `socket.io` custom server vào backend (Next.js custom server).
- Redis pub/sub: backend emit `EMAIL_SYNCED`, `SUMMARY_READY` events.
- Frontend socket client subscribe theo userId → gọi SWR `mutate()` khi nhận event để tự động refresh `ThreadList` và thread detail page.
