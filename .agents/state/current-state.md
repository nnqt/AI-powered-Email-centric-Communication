# Current State — March 17, 2026

## Status: All FRs Implemented ✅

| FR | Feature | Status |
|----|---------|--------|
| FR-01 | Email sync (Gmail) | ✅ Manual sync; webhook architecture-pending |
| FR-02 | Compose + send + attachments | ✅ |
| FR-03 | Read/unread/archive (two-way Gmail) | ✅ |
| FR-04 | Inbox + Thread timeline + pagination | ✅ |
| FR-05 | Real-time UI (Socket.IO) | ✅ |
| FR-06 | Contact management (enrich + merge + categories) | ✅ |
| FR-07 | Thread AI summarization (Vietnamese) | ✅ |
| FR-08 | Smart reply suggestions | ✅ |
| FR-09 | Multi-channel Telegram (Phases 1–5) | ✅ |
| FR-10 | Topic Intelligence (Phases 1–6) | ✅ |

## Recent Bug Fixes (March 17, 2026)

| Bug | Fix |
|-----|-----|
| `GET /api/telegram/chats` returned `[]` (no initial sync) | Added `syncDialogs(userId)` in `telegramManager.ts`; route triggers on empty DB |
| Chat messages empty when opening chat | Added `syncChatHistory(userId, chatId)`; `GET /api/telegram/chats/[chatId]` triggers on empty DB |
| Contact detail "Contact not found" — missing route | Created `api/contacts/[id]/route.ts` with GET + PATCH handlers |

## Active Tech Debt / Known Limitations

- Gmail webhook (Pub/Sub) not implemented — manual sync only
- Telegram `syncDialogs` fetches last 50 dialogs; no pagination
- `syncChatHistory` fetches last 50 messages; no infinite scroll yet

## Changelog Files (load only what you need)

| File | When to load |
|------|-------------|
| [`changelog/telegram.md`](changelog/telegram.md) | Telegram auth, chat, messages, sync |
| [`changelog/topic-intelligence.md`](changelog/topic-intelligence.md) | Topics, Focus page, clustering, scoring |
| [`changelog/email-core.md`](changelog/email-core.md) | Email sync, compose, contacts, AI features |
| [`changelog/infra-fixes.md`](changelog/infra-fixes.md) | Docker, build config, production fixes |
