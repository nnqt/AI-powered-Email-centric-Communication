# Changelog — Infrastructure & Production Fixes

> Load file này khi làm việc với Docker, build config, deployment.

## Docker Compose Setup

All services run via `infra/docker-compose.yml`.

```bash
# Start everything
cd infra
docker compose up -d --build

# Rebuild single service
docker compose up -d --build backend
```

**Start order:** Redis → MongoDB → AI service → Backend → Frontend (via `depends_on: condition: service_healthy`)

## Service Ports

| Service | Host | Internal Docker URL |
|---------|------|---------------------|
| Frontend | 3000 | — |
| Backend | 4000 | `http://backend:4000` |
| AI Service | 5000 | `http://ai-service:5000` |
| MongoDB | 27017 | `mongodb://mongo:27017/emailhub` |
| Redis | 6379 | `redis://redis:6379` |
| mongo-express | 8081 | `http://localhost:8081` |

## Docker Build Notes

- **Frontend**: multi-stage, `output: "standalone"`. `ARG BACKEND_INTERNAL_URL` + `ARG NEXT_PUBLIC_BACKEND_SOCKET_URL` baked at build time.
- **Backend**: multi-stage, **no** `output: "standalone"` (custom `server.ts` for Socket.IO). Builder: `tsc -p tsconfig.server.json` → `dist-server/server.js`. CMD: `node server.js`. Build uses `NODE_OPTIONS=--max-old-space-size=4096`.
- **AI Service**: multi-stage alpine. Builder installs `gcc`/`musl-dev` for C extensions.

## Production Runtime Fixes Applied

| File | Issue | Fix |
|------|-------|-----|
| `lib/axiosClient.ts` | Top-level `throw` failed Next.js build | `\|\| 'http://localhost:5000'` fallback |
| `lib/db.ts` | Top-level `throw` for `MONGO_URI` | Moved validation inside `connectToDatabase()` |
| `lib/logger.ts` | `pino-pretty` crashed in production | Only loaded when `NODE_ENV === 'development'` |
| `models/User.ts` | Fields in TS interface missing from schema | Added to Mongoose schema |
| `contact.service.ts` | Vietnamese names stored as Mojibake | `decodeMojibake()` + `decodeEmailHeader()` |
| `next.config.ts` | Turbopack + webpack conflict; pino `tap` module | `serverExternalPackages`, `turbopack: {}` |
| `next.config.ts` | Ambiguous `/api/contacts/[contactId]/timeline` route | Deleted duplicate, kept `[id]/timeline` |
| `next.config.ts` | JavaScript heap OOM on build | `NODE_OPTIONS=--max-old-space-size=4096` in build script |
| `features/inbox/ThreadList.tsx` | `filter === "urgent"` TS error after type narrowing | Removed unreachable branch |

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| No Gmail Pub/Sub webhook | Requires public HTTPS; manual sync adequate for PoC |
| GramJS MTProto (not Bot API) | User-level access to full chat history; StringSession auth per-user |
| Backend custom `server.ts` | Socket.IO needs HTTP server access; `output: "standalone"` incompatible |
| `NEXT_PUBLIC_BACKEND_SOCKET_URL` | Next.js rewrites can't proxy WebSocket |
| `load_dotenv()` before imports | Env vars must be available when `config.py` is imported |
| `pino-pretty` dev-only | Worker threads crash in production bundled builds |
