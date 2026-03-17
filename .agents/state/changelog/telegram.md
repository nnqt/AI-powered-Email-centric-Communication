# Changelog — FR-09 Multi-Channel Telegram (Phases 1–5)

> Load file này khi làm việc liên quan Telegram: auth, chat, messages, sync.

## Phase 1 — Setup & Auth

GramJS (MTProto) integration. Phone login → OTP → StringSession saved per-user to `User.telegramSession`.

**Backend new files:**
- `lib/telegramManager.ts` — Singleton `getTelegramClient(userId, session?)`, `syncDialogs(userId)`, `syncChatHistory(userId, chatId)`, `setupMessageListener(userId)`, `processChatChunks(userId)`
- `api/telegram/auth/send-code/route.ts` — POST, calls `client.sendCode()`
- `api/telegram/auth/verify-code/route.ts` — POST, validates OTP, saves session
- `api/telegram/status/route.ts` — GET, returns `{ linked, phone? }`

**Frontend new files:**
- `app/(dashboard)/settings/page.tsx` — Telegram link UI (state: linked ✅ / unlinked forms)

## Phase 2 — Core Messaging & Models

**New models:**
- `TelegramChat` — `{ chatId, userId, title, type, lastMessageDate, unreadCount }`. Index: `{ userId, lastMessageDate: -1 }`.
- `TelegramMessage` — `{ messageId, chatId, userId, senderId, text, date, isOutbound }`. Unique: `{ chatId, messageId }`.

**Backend routes:**
- `api/telegram/chats/route.ts` — GET list; auto-calls `syncDialogs()` if DB empty
- `api/telegram/chats/[chatId]/route.ts` — GET detail + messages; auto-calls `syncChatHistory()` if messages empty
- `api/telegram/chats/[chatId]/send/route.ts` — POST send message

**Frontend new files:**
- `app/(dashboard)/chat/layout.tsx` — sidebar + chat list via `useTelegramChats`
- `app/(dashboard)/chat/[id]/page.tsx` — message view + optimistic send
- `hooks/useTelegramChats.ts` — SWR, `GET /api/telegram/chats`
- `hooks/useTelegramMessages.ts` — SWR, `GET /api/telegram/chats/:id`

**Socket.IO event:** `NEW_TELEGRAM_MESSAGE { chatId, message, chat }`

## Phase 3 — Contact Integration

- `Contact.ts` — Added `telegramId` (sparse unique), `telegramUsername`, `telegramName`
- `contact.service.ts` — `getContactsForMergeSuggestions()` includes `recent_chat_snippets`
- `useContacts.ts` — `ContactDTO` includes Telegram fields
- AI merge `ContactSnippet` model includes `recent_chat_snippets?`

## Phase 4 — Proactive Chunking & Semantic Extraction

Auto-groups consecutive Telegram messages into time-based chunks → `POST /analyze-chat-chunk` → `GeminiChatAnalyzerClient` extracts intent/summary → stored as `chatInsights[]` on Topic.

**AI Service new files:**
- `models/chat_analysis.py` — `AnalyzeChatRequest`, `ChatFragment`, `AnalyzeChatResponse`
- `routes/chat.py` — `POST /analyze-chat-chunk`
- `core/llm_client.py` — `GeminiChatAnalyzerClient.analyze_chat()`

**Backend model changes:**
- `Topic.ts` — Added `chatInsights[]` subdocument `{ intent, summary, sourceChatId, date }` + `lastAnalyzedMessageDate`
- `TelegramChat.ts` — Added `lastAnalyzedMessageDate`

## Phase 5 — Unified Focus Page & Timeline

`chatInsights` integrated into `TopicDTO`/`FocusTopicDTO`. Focus score considers `max(email lastInboundAt, chatInsight.date)`. Frontend merges email threads + chatInsights into `unifiedTimeline` on Focus & Contact pages.

**Frontend changes:**
- `useFocusTopics.ts` — `chatInsights?` added to `FocusTopicDTO`
- `useContactTopics.ts` — `chatInsights?` added to `TopicDTO`
- `FocusTopicCard.tsx` — unified timeline with 💬 icon for chat insights
- `ContactTopicGroup.tsx` — same unified timeline logic

## Bug Fixes (March 17, 2026)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| `GET /api/telegram/chats` returns `[]` | `TelegramChat` only created on live message — no initial sync | Added `syncDialogs()` in `telegramManager.ts`; route calls it when DB empty |
| Chat messages empty when opening chat | `TelegramMessage` only created on live message | Added `syncChatHistory()` in `telegramManager.ts`; route calls it when DB empty |
