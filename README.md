# AI-Powered Email-Centric Communication Platform

A full-stack multi-channel communication platform that unifies Email and Telegram into a single inbox with AI-powered summarization, smart replies, contact management, and topic-based focus tracking.

## Tech Stack

| Layer      | Technology                                                     |
| ---------- | -------------------------------------------------------------- |
| Frontend   | Next.js 16 (React 19 + TypeScript), Tailwind CSS 4, SWR       |
| Backend    | Next.js 16 API Routes + Socket.IO + NextAuth v4 + GramJS      |
| AI Service | Python 3.12 FastAPI + Google Gemini (`gemini-2.0-flash`)       |
| Database   | MongoDB 7 (Mongoose) + Redis 7 (cache + pub/sub)              |
| Infra      | Docker Compose (multi-service orchestration)                   |

## Services & Ports

| Service       | Host Port | Notes                    |
| ------------- | --------- | ------------------------ |
| Frontend      | 3000      | Next.js app              |
| Backend       | 4000      | Next.js API + Socket.IO  |
| AI Service    | 5000      | FastAPI microservice     |
| MongoDB       | 27017     | Primary data store       |
| Redis         | 6379      | Cache + realtime pub/sub |
| mongo-express | 8081      | DB admin UI (dev only)   |

## Getting Started

```bash
# Copy env files
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
cp apps/ai-service/.env.example apps/ai-service/.env

# Start all services
cd infra
docker compose build --no-cache
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

## Implemented Features

### Email (FR-01 / FR-02 / FR-03 / FR-04)

- **Gmail sync** — pull threads + messages; upsert idempotently; parallel batch fetching.
- **Auto-sync** on first authenticated load; Socket.IO (`EMAIL_SYNCED`) trigger revalidates SWR cache.
- **Compose & send** — Tiptap rich text editor (bold, italic, bullet, blockquote, link) + file attachments; reply pre-fill from thread detail.
- **Read / unread / archive** — optimistic UI; two-way sync to Gmail labels.
- **Inbox tabs** — All / Unread / Archived / 🔴 Urgent; search with 350 ms debounce.
- **Gmail-style pagination** — cursor-based with ← Newer / Older → controls.

### Telegram (Multi-Channel)

- **Client Auth** — GramJS MTProto login via phone number + OTP; StringSession stored per-user in MongoDB.
- **Chat list & messaging** — realtime chat sync via Socket.IO; send/receive Telegram messages.
- **Auto-create contacts** — Telegram senders auto-create Contact records with `telegramId`, `telegramUsername`, `telegramName`.
- **Chat UI** — dedicated `/chat` page with chat list sidebar + message view.

### Contacts (FR-06)

- **Auto-create contacts** during email sync from participant addresses + Telegram message senders.
- **AI enrichment** — infer display name, org, language via Gemini (domain fallback map skips Gemini for 50+ known domains).
- **Category system** — `colleague | customer | other | spam | unknown`; source tracked as `rule | ai | user`.
- **AI category suggestion banner** — AI suggests category on enrich; user can Confirm (locks as "user") or Dismiss.
- **Merge suggestions** — AI pairs potential duplicate contacts (confidence ≥ 0.7) including Telegram ↔ Email matching via `chat_snippets`; Redis cache 6 h; soft-merge preserves audit trail.
- **Contact detail inline edit** — name, org, language, alternate emails editable in-place.
- **Sender linkify** — email sender names in thread messages link to `/contacts?q=email` for one-click lookup.
- **Contacts search** — real-time search by name / email / org; pre-populated from `?q=` URL param.

### Topic Intelligence (FR-10)

- **Thread category classification** — 22-value enum; Tier 1 hard-reject (noreply/spam) + Gemini fallback.
- **Heuristic clustering** — 30-day window, normalized subject, 60% word overlap fuzzy match.
- **AI topic labeling** — Gemini generates 2–5 word Vietnamese labels.
- **Focus score engine** — `unansweredCount×40 + recency(0–30) + contactWeight(0–10)`.
- **Proactive chunking** — auto-groups Telegram messages into chunks, AI extracts intent/summary → maps to Topics as `chatInsights`.
- **Unified timeline** — merged Email threads + Telegram chatInsights sorted by date on Focus & Contact pages.

### AI Features (FR-07 / FR-08 + Enhancements)

- **Thread summarization** — generate Vietnamese summary with key issues + action items; cached in MongoDB.
- **Smart replies** — 2–3 reply suggestions in `message` (chip) or `email` (card) format; always in Vietnamese.
- **Urgent email classification** — keyword fast-path (no LLM call) + Gemini fallback; runs fire-and-forget after each sync; `🔴 Urgent` tab + badge in thread list and thread detail header.
- **Chat analysis** — `GeminiChatAnalyzerClient` extracts conversational intents from Telegram chunks and maps to existing or new Topics.

### Real-Time (FR-05)

- **Socket.IO** with Redis adapter; clients join `user:<userId>` room.
- Events: `EMAIL_SYNCED`, `EMAIL_SENT`, `SUMMARY_READY`, `AI_JOB_START`, `AI_JOB_DONE`, `TELEGRAM_MESSAGE`.
- **Background sync** polling fallback every 60 s.

### UI Polish

- **Live unread badge** on Email nav item (polls every 60 s).
- **Responsive sidebar** with user avatar, initials fallback, sign-out.
- **Toast notification system** — slide-in, auto-dismiss 5 s, success / error / info types.
- **Focus page** — prioritized topic cards with score bars, expandable thread lists, inline rename.

## Project Structure

```
apps/
  frontend/     — Next.js UI (React + TypeScript)
  backend/      — Next.js API backend (routes, services, Socket.IO)
  ai-service/   — Python FastAPI microservice (Gemini)
infra/
  docker-compose.yml
report/         — LaTeX thesis document
.copilot/       — Copilot guidance docs (architecture, state, style)
```

For detailed architecture documentation see [`.copilot/CURRENT_STATE.md`](.copilot/CURRENT_STATE.md).
