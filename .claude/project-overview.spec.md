# Project Overview — AI-Powered Email-Centric Communication

## Stack

| Layer    | Technology                                         |
| -------- | -------------------------------------------------- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript    |
| Backend  | Next.js 16 API Routes + NextAuth v4 + Mongoose + GramJS |
| AI       | FastAPI + Google Gemini (`gemini-2.0-flash`)       |
| DB       | MongoDB 7                                          |
| Cache    | Redis 7                                            |
| Realtime | Socket.IO + `@socket.io/redis-adapter`             |
| Deploy   | Docker Compose (each app has own build context)    |

## Services & Ports

| Service       | Host Port | Internal Docker URL              |
| ------------- | --------- | -------------------------------- |
| Frontend      | 3000      | —                                |
| Backend       | 4000      | `http://backend:4000`            |
| AI Service    | 5000      | `http://ai-service:5000`         |
| MongoDB       | 27017     | `mongodb://mongo:27017/emailhub` |
| Redis         | 6379      | `redis://redis:6379`             |
| mongo-express | 8081      | `http://localhost:8081`          |

## Monorepo Structure

```
/AI-powered-Email-centric-Communication
├── apps/
│   ├── frontend/      # Next.js 16 — port 3000
│   ├── backend/       # Next.js 16 API + Socket.IO — port 4000
│   └── ai-service/    # FastAPI — port 5000
├── infra/
│   └── docker-compose.yml
├── shared/            # (future) shared models/utils
└── .claude/           # Project knowledge docs
```

## Request Flow

```
Browser
  └─→ Frontend :3000
        └─→ /api/* rewrites → Backend :4000 (via Next.js rewrite)
        └─→ WebSocket direct → Backend :4000 (NEXT_PUBLIC_BACKEND_SOCKET_URL)
  Backend :4000
        └─→ MongoDB :27017
        └─→ Redis :6379
        └─→ AI Service :5000 (internal Docker network http://ai-service:5000)
        └─→ Gmail API (external)
  AI Service :5000
        └─→ Google Gemini API (external)
```

## Communication Patterns

- **Frontend → Backend**: SWR (data hooks) + axios (mutations); all calls go through `BACKEND_INTERNAL_URL` rewrite or direct to `NEXT_PUBLIC_BACKEND_SOCKET_URL` for WebSocket.
- **Backend → AI Service**: axios HTTP calls (non-blocking, fire-and-forget for urgent classification).
- **Backend → Frontend**: Socket.IO room `user:<userId>`; events: `EMAIL_SYNCED`, `SUMMARY_READY`, `EMAIL_SENT`.
- **Backend → Gmail**: Google API client with stored OAuth tokens; auto-refresh when within 5min of expiry.
- **Redis**: Merge suggestion cache (6h TTL, key `contact:merge_suggestions:{userId}`); Socket.IO pub/sub adapter for multi-instance.

## Authentication

- **Provider**: Google OAuth 2.0 via NextAuth v4.
- **JWT fields**: `accessToken`, `refreshToken`, `expiresAt`, `id` (MongoDB `_id`).
- **Auto-refresh**: token refresh happens in `jwt` callback when `expiresAt - 5min < now`.
- **Session error**: `session.error = "RefreshTokenError"` → frontend forces sign-out.
- **Backend** runs NextAuth on port 4000; Google redirect URI = `http://localhost:4000/api/auth/callback/google`.

## Environment Variables

### `apps/backend/.env`

```
PORT=4000
NEXTAUTH_URL=http://localhost:4000
NEXTAUTH_SECRET=<secret>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
MONGO_URI=mongodb://localhost:27017/emailhub
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

### `apps/frontend/.env`

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<same as backend>
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_SOCKET_URL=http://localhost:4000
```

### `apps/ai-service/.env`

```
GEMINI_API_KEY=<key>
GEMINI_MODEL_NAME=gemini-2.0-flash
```

### `apps/backend/.env` (additional Telegram vars)

```
TELEGRAM_API_ID=<id>
TELEGRAM_API_HASH=<hash>
```

## Docker Build Notes

- **Frontend**: multi-stage, `output: "standalone"`. `ARG BACKEND_INTERNAL_URL` + `ARG NEXT_PUBLIC_BACKEND_SOCKET_URL` baked at build time.
- **Backend**: multi-stage, **no** `output: "standalone"` (uses custom `server.ts` for Socket.IO). Builder compiles `server.ts → dist-server/server.js` via `tsc -p tsconfig.server.json`. CMD: `node server.js`. Build script uses `NODE_OPTIONS=--max-old-space-size=4096`.
- **AI Service**: multi-stage alpine. Builder installs `gcc`/`musl-dev` for C extensions. Runner stage is clean.
- Start order enforced via `depends_on: condition: service_healthy` with `curl` healthchecks.
- **Backend next.config.ts**: `serverExternalPackages: ['pino', 'thread-stream']`, `turbopack: {}` (empty config required when webpack config coexists).

## Route Structure (Frontend App Router)

| File                                     | URL             | Notes                              |
| ---------------------------------------- | --------------- | ---------------------------------- |
| `app/page.tsx`                           | `/`             | Login only — Google OAuth button   |
| `app/(dashboard)/layout.tsx`             | —               | Sidebar + auth guard               |
| `app/(dashboard)/inbox/page.tsx`         | `/inbox`        | Thread list                        |
| `app/(dashboard)/focus/page.tsx`         | `/focus`        | Focus page — prioritized topics    |
| `app/(dashboard)/contacts/page.tsx`      | `/contacts`     | Contact list                       |
| `app/(dashboard)/contacts/[id]/page.tsx` | `/contacts/:id` | Contact detail + timeline          |
| `app/(dashboard)/threads/[id]/page.tsx`  | `/threads/:id`  | Thread detail + AI summary + reply |
| `app/(dashboard)/chat/page.tsx`          | `/chat`         | Telegram chat UI                   |
| `app/(dashboard)/settings/page.tsx`      | `/settings`     | Telegram integration settings      |
