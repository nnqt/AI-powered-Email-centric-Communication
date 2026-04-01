# API Contracts — Backend (Next.js)

Base: `http://localhost:4000` (local) / `http://backend:4000` (Docker internal)

All routes require session auth unless noted. Auth failure → 401.

---

## Email

| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| POST | `/api/emails/sync` | `{ pageToken? }` | `{ syncedMessages, nextPageToken, hasMore }` |
| GET | `/api/emails/sync` | — | `{ hasMore, nextPageToken, syncComplete }` |
| POST | `/api/emails/send` | `{ to, subject, htmlBody, threadId?, attachmentIds? }` | `{ threadId }` |
| POST | `/api/emails/attachments` | multipart/form-data | `{ attachmentId, filename, size }` |

## Threads

| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/threads` | `limit?, cursor?, filter?, q?` | `{ threads: ThreadDTO[], total, hasNext, hasPrev }` |
| GET | `/api/threads/[id]` | — | `{ thread: ThreadDTO, messages: MessageDTO[] }` |
| PATCH | `/api/threads/[id]/read` | `{ read: boolean }` | `{ success: true }` |
| PATCH | `/api/threads/[id]/archive` | — | `{ success: true }` |
| POST | `/api/threads/[id]/summarize` | — | `{ summary: { text, key_issues[], action_required[] } }` |
| POST | `/api/threads/[id]/suggest-reply` | `{ format?: "email"\|"message" }` | `{ replies: [{ subject, body }] }` |

**ThreadFilter** values: `"all" \| "unread" \| "archived" \| "urgent"`

**ThreadDTO fields**: `id`, `subject`, `snippet`, `participants[]`, `lastMessageDate`, `isRead`, `isArchived`, `isUrgent`, `urgentClassifiedAt`, `summary?`

## Contacts

| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/contacts` | `limit?, skip?, unverified?=true` | `{ contacts: ContactDTO[], total, hasNext }` |
| POST | `/api/contacts` | `{ email, name?, org?, language? }` | `ContactDTO` |
| GET | `/api/contacts/[id]` | — | `ContactDTO` |
| PATCH | `/api/contacts/[id]` | `{ name?, org?, language?, alternateEmails?, category?, categories?, categorySource?, categoryAiSuggestion? }` | `ContactDTO` |
| GET | `/api/contacts/[id]/timeline` | — | `ThreadDTO[]` |
| POST | `/api/contacts/[id]/enrich` | `force?=true` | `{ contact: ContactDTO, cached?: boolean }` |
| POST | `/api/contacts/bulk-enrich` | — | `{ processed, skipped, failed, total }` |
| GET | `/api/contacts/merge-suggestions` | `refresh?=true, selectedContactId?` | `{ suggestions: MergeSuggestion[], fromCache? }` |
| POST | `/api/contacts/merge` | `{ sourceId, targetId }` | `{ success: true }` |
| POST | `/api/contacts/merge/batch` | `{ merges: { sourceId, targetId }[] }` | `{ applied, failed, errors[] }` |
| GET | `/api/contacts/[id]/topics` | — | `{ topics: TopicDTO[] }` |

**MergeSuggestion fields (current):**
```typescript
interface MergeSuggestion {
  source_id: string;
  target_id: string;
  source_email: string;
  target_email: string;
  source_display_name?: string;
  target_display_name?: string;
  confidence: number;
  reason: string;
  strategy?: "verified_anchor" | "selected_anchor" | "default";
  target_is_verified?: boolean;
}
```

**ContactDTO:**
```typescript
interface ContactDTO {
  _id: string; email: string; name?: string; org?: string; language?: string;
  alternateEmails: string[]; aiEnriched: boolean; enrichedAt?: string; mergedInto?: string;
  category: "colleague"|"customer"|"other"|"spam"|"unknown";
  categories: ("colleague"|"customer"|"other"|"spam"|"unknown")[];
  categorySource: "rule"|"ai"|"user"; categoryAiSuggestion?: string;
  telegramId?: string; telegramUsername?: string; telegramName?: string;
  createdAt: string; updatedAt: string;
}
```

## Topics & Focus

| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/topics` | `limit?` | `{ topics: TopicDTO[] }` |
| GET | `/api/topics/[id]` | — | `{ topic: TopicDTO, threads: ThreadDTO[] }` |
| PATCH | `/api/topics/[id]` | `{ name }` | `{ topic: TopicDTO }` |
| GET | `/api/focus` | `limit?` | `{ topics: FocusTopicDTO[] }` |
| GET | `/api/focus/overview` | — | `{ totalFocusTopics, highPriorityCount, topFocusScore, lastScoredAt? }` |
| POST | `/api/focus/recompute` | `limit?` (query) | `{ topics: FocusTopicDTO[], overview }` |

## Runtime Metrics

| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/metrics/overview` | — | `{ counters, timers }` |

**TopicDTO / FocusTopicDTO:**
```typescript
interface TopicDTO {
  _id: string; name: string; nameEditedByUser: boolean;
  threadCount: number; noiseCount: number; focusScore: number; unansweredCount: number;
  lastInboundAt?: string; lastOutboundAt?: string; aiLabeled: boolean; aiLabeledAt?: string;
  chatInsights?: { _id: string; intent: string; summary: string; sourceChatId: string; date: string }[];
}
interface FocusTopicDTO extends TopicDTO {
  contact: { _id: string; email: string; name?: string; org?: string; category: string; categories: string[] };
}
```

## Telegram

| Method | Route | Body | Response |
|--------|-------|------|----------|
| GET | `/api/telegram/status` | — | `{ linked: boolean, phone? }` |
| POST | `/api/telegram/auth/send-code` | `{ phoneNumber }` | `{ phoneCodeHash }` |
| POST | `/api/telegram/auth/verify-code` | `{ phoneNumber, phoneCode, phoneCodeHash }` | `{ success: true }` |
| GET | `/api/telegram/chats` | — | `{ chats: TelegramChatDTO[] }` — auto-syncs if empty |
| GET | `/api/telegram/chats/[chatId]` | — | `{ chat, messages[] }` — auto-syncs history if empty |
| POST | `/api/telegram/chats/[chatId]/send` | `{ text }` | `{ success: true }` |

## Auth (NextAuth v4)

`GET /api/auth/session` · `POST /api/auth/signin` · `GET /api/auth/callback/google` · `POST /api/auth/signout`
