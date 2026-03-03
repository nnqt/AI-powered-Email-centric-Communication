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
- **Performance fix**: thread fetches run in parallel batches of 10 via `Promise.allSettled` (was sequential for-loop over 50 threads). Inner `Message.findOneAndUpdate` calls per thread also parallelized. Contact upsert is fire-and-forget (non-blocking).
- **Architecture note**: Gmail Pub/Sub webhook (< 5s push) is the production target per thesis FR-01 requirement. PoC dùng manual sync trigger do hạn chế setup local (cần public HTTPS URL). Architecture đã được thiết kế để thêm webhook handler sau này mà không cần refactor.

API routes:

- `POST /api/emails/sync` – body `{ pageToken? }` → calls `syncEmails(pageToken)`. Auth errors → 401.
- `GET /api/emails/sync` – returns `{ hasMore, nextPageToken, syncComplete }` from User record.

`SyncButton` (`apps/frontend/src/components/SyncButton.tsx`):

- On mount: `GET /api/emails/sync` to preload `hasMore` / `nextPageToken`.
- Button text: `"Syncing..."` / `"Sync More Emails"` / `"Sync Inbox"`.
- Auto-retry once on network error (2s delay). Auth errors handled by axios interceptor.
- Success/error feedback via `useToast()`.

**Auto-sync on load**: `apps/frontend/src/app/page.tsx` fires `POST /api/emails/sync` automatically on first authenticated session load via `useEffect` + `useRef` guard (fires once only).

### FR-04 – Inbox / Timeline

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

### FR-06 – AI-Assisted Contact Management ✅ IMPLEMENTED

Backend models:

- `Contact` (`apps/backend/src/models/Contact.ts`): `email`, `name`, `org`, `language`, `alternateEmails[]`, `userId`, `aiEnriched`, `mergedInto?`.

`ContactService` (`apps/backend/src/modules/contacts/contact.service.ts`):

- `upsertParticipants(userId, emails[])` — called after each `syncEmails` (fire-and-forget), idempotent.
- `getContacts(userId)`, `getContact(userId, contactId)`, `mergeContacts(userId, sourceId, targetId)`.
- `getContactTimeline(userId, contactId)` — threads where any of `[email, ...alternateEmails]` appears in `participants`.

API routes:

- `GET /api/contacts` – list contacts.
- `POST /api/contacts` – create manually.
- `GET /api/contacts/[contactId]` – single contact.
- `GET /api/contacts/[contactId]/timeline` – email timeline for this contact.
- `POST /api/contacts/[contactId]/enrich` – calls AI `/enrich-contact`, saves result.
- `GET /api/contacts/merge-suggestions` – calls AI `/suggest-merge`, returns candidate pairs.
- `POST /api/contacts/merge` – body `{ sourceId, targetId }`, soft-merges (sets `mergedInto`).

AI Service (`apps/ai-service`):

- `POST /enrich-contact` – `{ email, name?, conversation_snippet? }` → `{ display_name, org, language }`.
- `POST /suggest-merge` – `{ contacts[] }` (capped to 50) → `[{ source_id, target_id, confidence, reason }]`.
- `GeminiContactEnrichClient` + `GeminiMergeSuggestionClient` trong `core/llm_client.py`.
- `apps/ai-service/models/contact.py` — Pydantic models: `EnrichContactRequest`, `EnrichContactResponse`, `ContactSnippet`, `MergeSuggestion`.
- `apps/ai-service/routes/contact.py` — `/enrich-contact` + `/suggest-merge` routes.

Frontend:

- `apps/frontend/src/app/contacts/page.tsx` — danh sách contacts + merge suggestion banner (Dismiss / Merge buttons).
- `apps/frontend/src/app/contacts/[id]/page.tsx` — contact detail + email timeline + "Enrich with AI" button. ✅ IMPLEMENTED

AI Service (`apps/ai-service`):

- `POST /summarize` → `{ summary, key_issues, action_required }` via `GeminiSummarizationClient`.
- **Always responds in Vietnamese** (`_LANG_INSTRUCTION` constant instructs Gemini to translate output into Vietnamese regardless of email language).
- Token safety: each message body truncated to 1,500 chars; total content capped at 12,000 chars via `_truncate()` + `_build_messages_text()`.
- JSON markdown code block stripping for Gemini response.

Backend:

- `AIService.summarizeThread()` (`apps/backend/src/modules/ai/ai.service.ts`) — gọi AI service via axios.
- `POST /api/threads/[threadId]/summarize` → lưu result vào `thread.summary` trong MongoDB, emits `SUMMARY_READY` socket event.

Frontend:

- `AISummaryCard` (`apps/frontend/src/components/AISummaryCard.tsx`):
  - Shows `"Summarize this Thread"` button khi `!summary || !summary.text`.
  - Hiển thị summary (Vietnamese) + key issues + action items khi có kết quả.
  - `"Regenerate"` link để re-trigger.

### FR-02 – Compose + Send ✅ IMPLEMENTED (Rich Text + Attachments)

`GmailService` (`apps/backend/src/modules/email/gmail.service.ts`):

- `sendEmail({ to, subject, htmlBody, attachmentIds? })`: RFC 2822 MIME encode (HTML body) → `users.messages.send` → upsert Thread + Message vào MongoDB.
- Attachment support: `POST /api/emails/attachments` nhận multipart/form-data, lưu tạm trong `uploads/`, trả về `attachmentId`. `sendEmail` đính kèm file trước khi gửi.

API routes:

- `POST /api/emails/send` – body `{ to, subject, htmlBody, threadId?, attachmentIds? }`.
- `POST /api/emails/attachments` – multipart upload, trả về `{ attachmentId, filename, size }`.

Frontend:

- `ComposeDrawer` (`apps/frontend/src/components/ComposeDrawer.tsx`): Tiptap rich text editor (bold, italic, bullet, blockquote, link) + file picker + attachment chips. ESC + backdrop close. `htmlBody` gửi HTML string từ Tiptap thay vì plain text.

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

### FR-08 – Smart Reply Suggestions ✅ IMPLEMENTED

AI Service (`apps/ai-service`):

- `POST /suggest-reply` → `{ thread_id, format, replies: [{ subject, body }] }` via `GeminiReplyClient`.
- Accepts `format: "email" | "message"` (default `"message"`).
  - `email` format: full RFC 2822-style reply with greeting, content, sign-off, and subject line.
  - `message` format: short conversational reply (1–3 sentences, no formal greeting).
- **Always responds in Vietnamese** (shared `_LANG_INSTRUCTION`).
- Token safety: `conversation_context` capped at 400 chars, `latest_message.text` capped at 1,500 chars.
- JSON array output `[{"subject": ..., "body": ...}]`; plain-text fallback parser for non-JSON Gemini responses.

Backend:

- `AIService.suggestReplies(threadId, latestMessage, context?, maxReplies, format)` — returns `{ format, replies: ReplyItem[] }`.
- `ReplyItem` interface: `{ subject: string | null; body: string }`. Exported from `ai.service.ts`.
- `POST /api/threads/[threadId]/suggest-reply` — accepts `{ format? }` in body, resolves thread+messages from DB, returns `{ threadId, format, replies[] }`.

Frontend:

- `SmartReplyBar` (`apps/frontend/src/components/SmartReplyBar.tsx`):
  - Format toggle header: `💬 Message` / `✉ Email`.
  - **Message format**: compact chip buttons showing `reply.body`.
  - **Email format**: expanded cards with Subject + body preview + "Use this reply" button.
  - `onSelect(reply: ReplyItem)` callback.
- Thread detail `page.tsx`:
  - `subjectOverride` state: khi user chọn email-format reply có subject, `ComposeDrawer` dùng subject đó thay vì `Re: <original>`.
  - `handleSelectReply(reply: ReplyItem)` pre-fills both `initialBody` và `subjectOverride`.

### FR-05 – WebSocket Realtime

Custom server (`apps/backend/server.ts`):

- Tạo `http.createServer` wrapper quanh Next.js `getRequestHandler()`.
- Attach `Socket.IO` server với `path: "/socket.io"`, CORS từ `FRONTEND_URL`.
- Kết nối Redis adapter (`@socket.io/redis-adapter`) → hỗ trợ multi-instance broadcasting.
- Lưu `io` instance vào `global.__io` để API routes truy cập.
- Client gửi event `join(userId)` → join room `user:<userId>`.

Helper (`apps/backend/src/lib/socketServer.ts`):

- `getIO()`: đọc `global.__io`.
- `emitToUser(userId, event, payload)`: emit về room `user:<userId>`, silent nếu `io` chưa init.

Backend routes emit events:

| Event           | Route                                    | Payload              |
| --------------- | ---------------------------------------- | -------------------- |
| `EMAIL_SYNCED`  | `POST /api/emails/sync`                  | `{ count, hasMore }` |
| `SUMMARY_READY` | `POST /api/threads/[threadId]/summarize` | `{ threadId }`       |
| `EMAIL_SENT`    | `POST /api/emails/send`                  | `{ threadId }`       |

Frontend hook (`apps/frontend/src/hooks/useSocket.ts`):

- Singleton socket kết nối trực tiếp `NEXT_PUBLIC_BACKEND_SOCKET_URL` (baked tại build time).
- `useSocket(userId, listeners)`: join room khi connect **và** reconnect (fixed: trước đây chỉ join khi `connect`, bỏ sót `reconnect` event → room bị mất sau ngắt kết nối).
- `useBackgroundSync(cb, intervalMs, enabled)`: polling fallback mỗi 60s để revalidate SWR cache phòng trường hợp socket event bị miss.

Frontend wiring:

- `apps/frontend/src/app/page.tsx`: `EMAIL_SYNCED` → `mutate(/api/threads/*)` + toast (chỉ khi `count > 0`). `NEW_THREAD` + `EMAIL_SENT` → mutate. `useBackgroundSync` 60s fallback.
- `apps/frontend/src/app/threads/[id]/page.tsx`: `SUMMARY_READY` (match threadId) → `mutate()` refresh AISummaryCard.

Dockerfile backend:

- Không còn `output: "standalone"`.
- Build stage: `npm run build` = `next build && tsc -p tsconfig.server.json` → `dist-server/server.js`.
- Runner: copy đủ `node_modules`, `.next`, `dist-server/server.js` → `CMD ["node", "server.js"]`.

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
- **Base images**: `node:22-alpine` (frontend, backend), `python:3.12-alpine` (ai-service) — Node 22 LTS + Alpine để giảm CVEs.
- **Frontend Dockerfile**: multi-stage, `output: "standalone"` → `node server.js`. `ARG BACKEND_INTERNAL_URL` + `ARG NEXT_PUBLIC_BACKEND_SOCKET_URL` baked tại build time.
- **Backend Dockerfile**: multi-stage, **không dùng `output: "standalone"`** — dùng custom `server.ts` (socket.io). Builder compile `server.ts` → `dist-server/server.js` via `tsc -p tsconfig.server.json`. Runner copy `node_modules` + `.next` + `dist-server/server.js`.
- **AI Service Dockerfile**: multi-stage alpine — builder stage cài `gcc`/`musl-dev` để compile C extensions (`uvloop`, `httptools`); runner stage sạch chỉ nhận `/install`, không giữ build tools.
- `curl` installed trong backend và ai-service runner images cho Docker healthchecks.
- `depends_on` với `condition: service_healthy` cho đúng start order.

### Production Runtime Fixes Applied

| File                                 | Issue                                                                                      | Fix                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------- | --------------------------------- |
| `src/lib/axiosClient.ts`             | Top-level `throw` failed Next.js build-time page collection                                | `                                             |            | 'http://localhost:5000'` fallback |
| `src/lib/db.ts`                      | Same top-level `throw` for `MONGO_URI`                                                     | Moved validation inside `connectToDatabase()` |
| `src/lib/logger.ts`                  | `pino-pretty` uses worker threads, crashes in production bundled builds                    | Only loaded when `NODE_ENV === 'development'` |
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

**FR hoàn thành (theo thesis)**: FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08.

**FR đang pending**:

| FR    | Description                                                       | Plan       |
| ----- | ----------------------------------------------------------------- | ---------- |
| FR-09 | Multi-channel: abstract `IChannelAdapter` + Telegram Bot (grammy) | Tạm bỏ qua |

**AI improvements (tất cả implemented)**:

| Improvement         | Detail                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Token truncation    | `_truncate()` helper; 1,500 chars/message, 12,000 chars total, 400 chars snippets                     |
| Vietnamese output   | `_LANG_INSTRUCTION` trong summarize + reply prompts — luôn dịch sang tiếng Việt                       |
| Smart reply format  | `format: "email"\|"message"` xuyên suốt full stack: AI → backend → frontend                           |
| Duplicate class fix | `llm_client.py` đã xóa các duplicate class definitions (cũ và mới đều tồn tại → Python chọn cái cuối) |

**Quyết định kiến trúc**:

- FR-01 Gmail Pub/Sub webhook: không implement trong PoC (cần public HTTPS + Google Cloud setup). Architecture sẵn sàng thêm webhook handler sau.
- FR-09 channel được chọn: **Telegram Bot** (grammy) — free, không cần approval, TypeScript SDK tốt. Tạm bỏ qua.
