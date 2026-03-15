# Architecture and Functional Requirement (FR) Guide

This document connects the **thesis requirements** to concrete
**modules and services** in the repository so Copilot can reason about
where to implement new features.

**FR numbering follows the thesis (`report/Sections/3-RequirementAnalysis.tex`) exactly.**

## Implementation Status

| FR    | Description                                                   | Status                                                         |
| ----- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| FR-01 | Email sync (near real-time)                                   | ✅ IMPLEMENTED (manual sync; webhook is architecture decision) |
| FR-02 | Compose + send (rich text + attachments)                      | ✅ IMPLEMENTED                                                 |
| FR-03 | Manage read/unread/archive/labels (two-way sync)              | ✅ IMPLEMENTED                                                 |
| FR-04 | Inbox + Thread timeline view                                  | ✅ IMPLEMENTED                                                 |
| FR-05 | Real-time UI update (WebSocket)                               | ✅ IMPLEMENTED                                                 |
| FR-06 | AI-assisted Contact Management (auto-create + enrich + merge) | ✅ IMPLEMENTED                                                 |
| FR-07 | Thread summarization (AI)                                     | ✅ IMPLEMENTED                                                 |
| FR-08 | Smart reply suggestions (AI)                                  | ✅ IMPLEMENTED                                                 |
| FR-09 | Multi-channel adapter interface + Telegram                    | ⏳ PENDING                                                     |

## Mapping FRs to Modules

### FR-01 – Email Sync (Near Real-Time)

**Goal**: keep the local system in sync with a real email provider
such as Gmail (or any API-based provider) with minimal delay.

**Primary modules**:

- `apps/backend`:
  - Email integration client (e.g. Gmail API wrapper).
  - Sync route(s), e.g. `POST /api/emails/sync`.
  - Webhook/notification handlers where supported by provider.
  - Jobs or background tasks (if any) for periodic sync.
- `apps/frontend`:
  - Inbox view that shows the latest synced threads.
- `infra`:
  - Dockerized MongoDB and Redis.

**Key ideas**:

- Use provider APIs (or mocks) to fetch recent messages.
- Store messages in MongoDB, keyed by thread/conversation id.
- Design the sync logic to be idempotent (safe to run multiple times).

### FR-02 – Compose + Send Email ✅ IMPLEMENTED (Rich Text + Attachments)

**Goal**: người dùng có thể soạn email với Rich Text (bold, italic, bullet, blockquote) và đính kèm tệp. Email gửi đi đồng bộ ngược vào Gmail để lịch sử nhất quấn.

**Primary modules**:

- `apps/backend`:
  - `apps/backend/src/modules/email/gmail.service.ts` — `sendEmail({ to, subject, htmlBody, attachmentIds? })`.
  - `apps/backend/src/app/api/emails/send/route.ts` — `POST` send email.
  - `apps/backend/src/app/api/emails/attachments/route.ts` — `POST` upload attachment (multipart/form-data), returns `attachmentId`.
- `apps/frontend`:
  - `apps/frontend/src/components/ComposeDrawer.tsx` — Tiptap rich text editor + file picker + attachment chips.

**Key ideas**:

- `sendEmail` nhận `htmlBody` (HTML string từ Tiptap) thay vì plain text.
- Attachments được upload trước, lưu tạm `uploads/` trên backend filesystem, gửi cùng email rồi dọn.
- `sendEmail` upsert Thread + Message để email gửi xuất hiện trong PoC inbox lẫn Gmail "Sent".

### FR-03 – Manage Read/Unread/Archive/Labels ✅ IMPLEMENTED

**Goal**: đánh dấu đã đọc/chưa đọc, archive hoặc gắn nhãn. Thay đổi được two-way sync về Gmail.

**Primary modules**:

- `apps/backend`:
  - `apps/backend/src/modules/email/gmail.service.ts` — `markRead()`, `archiveThread()`.
  - `apps/backend/src/models/Thread.ts` — `isRead` (Boolean), `isArchived` (Boolean) fields.
  - `apps/backend/src/app/api/threads/[threadId]/read/route.ts` — `PATCH` toggle read.
  - `apps/backend/src/app/api/threads/[threadId]/archive/route.ts` — `PATCH` archive.
- `apps/frontend`:
  - `apps/frontend/src/features/inbox/ThreadList.tsx` — unread dot + bold + optimistic read/archive actions.
  - `apps/frontend/src/app/threads/[id]/page.tsx` — auto-mark-read khi component mount.

**Key ideas**:

- Backend là source of truth; mọi thay đổi đều ghi vào MongoDB VÀ phản ánh lên Gmail API.
- Optimistic UI: frontend cập nhật state ngay lập tức, revert nếu API call thất bại.

### FR-04 – Inbox + Thread Timeline View ✅ IMPLEMENTED

**Goal**: hiển thị danh sách thread (Inbox) và toàn bộ lịch sử trao đổi của một thread khi mở.

**Primary modules**:

- `apps/backend`:
  - `apps/backend/src/modules/timeline/timeline.service.ts` — `getThreads()`, `getThreadDetails()`.
  - `apps/backend/src/app/api/threads/route.ts` — `GET /api/threads?limit=&cursor=`.
  - `apps/backend/src/app/api/threads/[threadId]/route.ts` — `GET /api/threads/[threadId]`.
- `apps/frontend`:
  - `apps/frontend/src/features/inbox/ThreadList.tsx`.
  - `apps/frontend/src/hooks/useThreads.ts` — SWR cursor pagination.
  - `apps/frontend/src/app/threads/[id]/page.tsx` — Thread detail + messages.

**Key ideas**:

- Cursor-based pagination dùng composite key `"lastMessageDate_id"`.
- `ThreadDTO` include `isRead`, `isArchived`, `isUrgent`, `urgentClassifiedAt` cho UI.
- `ThreadFilter = "all" | "unread" | "archived" | "urgent"` — "urgent" filter uses `isUrgent: true` query.
- Urgent classification là **fire-and-forget** sau mỗi sync — không block response; dùng `GeminiUrgentClassifier` (keyword fast-path + Gemini fallback).

### FR-05 – Real-Time UI Update ✅ IMPLEMENTED

**Goal**: update the inbox, thread view when new emails or AI results arrive without manual refresh.

**Primary modules**:

- `apps/backend`:
  - `apps/backend/server.ts` — custom HTTP server wrapping Next.js + Socket.IO attachment + Redis adapter init.
  - `apps/backend/tsconfig.server.json` — separate tsconfig compiling server.ts → `dist-server/server.js`.
  - `apps/backend/src/lib/socketServer.ts` — `getIO()`, `emitToUser(userId, event, payload)`.
  - `apps/backend/src/app/api/emails/sync/route.ts` — emits `EMAIL_SYNCED`.
  - `apps/backend/src/app/api/threads/[threadId]/summarize/route.ts` — emits `SUMMARY_READY`.
  - `apps/backend/src/app/api/emails/send/route.ts` — emits `EMAIL_SENT`.
- `apps/frontend`:
  - `apps/frontend/src/hooks/useSocket.ts` — singleton Socket.IO client, `useSocket(userId, listeners)` hook.
  - `apps/frontend/src/app/page.tsx` — handles `EMAIL_SYNCED` (mutate + toast) and `EMAIL_SENT` (mutate).
  - `apps/frontend/src/app/threads/[id]/page.tsx` — handles `SUMMARY_READY` (mutate thread detail).

**Key ideas**:

- Custom `server.ts` replaces `output: "standalone"` — necessary to attach Socket.IO to the HTTP server.
- `@socket.io/redis-adapter` enables multi-instance deployments via Redis pub/sub (Redis already in stack).
- `global.__io` stores the Socket.IO instance for access in API route handlers.
- Frontend connects directly to `NEXT_PUBLIC_BACKEND_SOCKET_URL` (baked at build time) — Next.js `rewrites()` cannot proxy WebSocket upgrades.
- Clients join `user:<userId>` room on connect so server can target specific users.

### FR-06 – AI-Assisted Contact Management ✅ IMPLEMENTED

**Goal**: tự động tạo Contact khi sync email; AI suy luận metadata (tên, org, ngôn ngữ); đề xuất gộp (merge) nhiều địa chỉ email → 1 Contact.

**Primary modules**:

- `apps/backend`:
  - `apps/backend/src/models/Contact.ts` — `email`, `name`, `org`, `language`, `alternateEmails[]`, `userId`, `aiEnriched`, `enrichedAt?`, `mergedInto?`, `category` (enum: colleague/customer/third_party/spam/unknown, default "unknown"), `categorySource` (rule/ai/user, default "rule"), `categoryAiSuggestion?`.
  - `apps/backend/src/modules/contacts/contact.service.ts`:
    - `upsertContact()`, `getContacts()`, `getContact()`, `mergeContacts()`.
    - `getContactTimeline()` — regex anchor `(?:^|<)email(?:>|$)` tránh false-positive substring match.
    - `getContactsForMergeSuggestions()` — **2 DB queries** (fetch contacts max 100 + bulk fetch 300 recent threads, match in-memory). Filter `claimedAltEmails` loại contacts đã linked vào alternateEmails của contact khác. Trả `ContactSnippetDTO[]` với `sample_threads` thực.
    - `updateContact()` — hỗ trợ `enrichedAt` trong update fields.
    - `ContactSnippetDTO` interface: `{ contact_id, email, name?, alternate_emails[], sample_threads[] }`.
  - `apps/backend/src/app/api/contacts/route.ts` — `GET /api/contacts`, `POST /api/contacts`.
  - `apps/backend/src/app/api/contacts/[contactId]/route.ts` — `GET /api/contacts/:id`.
  - `apps/backend/src/app/api/contacts/[contactId]/timeline/route.ts` — `GET /api/contacts/:id/timeline`.
  - `apps/backend/src/app/api/contacts/[contactId]/enrich/route.ts` — `POST /api/contacts/:id/enrich`. **Guard**: nếu `aiEnriched=true` → 200 OK `{ contact, cached: true }`, không gọi AI. `?force=true` để bỏ qua guard. Lưu `enrichedAt: new Date()` sau khi enrich thành công.
  - `apps/backend/src/app/api/contacts/merge-suggestions/route.ts` — `GET`. **Redis cache 6h** (key `contact:merge_suggestions:{userId}`). `?refresh=true` để bypass. **validIdSet guard**: cross-validate AI response ids trước khi cache, lọc `source_id === target_id`.
  - `apps/backend/src/app/api/contacts/merge/route.ts` — `POST { sourceId, targetId }`. Sau merge thành công **xóa Redis cache** `contact:merge_suggestions:{userId}`.
  - Hook vào `GmailService.syncEmails()` — upsert contact từ mỗi participant mới.
- `apps/ai-service`:
  - `POST /enrich-contact` — nhận `{ email, name?, conversation_snippet? }` → `{ org, language, display_name }`. **Domain fallback** (`_DOMAIN_MAP` 50+ domains, `_PERSONAL_DOMAINS`) skip Gemini hoàn toàn khi domain đã biết. **Exponential backoff** `_gemini_with_retry()` 1s→2s→4s khi 429.
  - `POST /suggest-merge` — nhận list contact snippets (capped **100**) → merge candidate pairs + confidence score. **valid_ids Set guard**: lọc hallucinated ids, `sid == tid`, `@` in id.
  - `apps/ai-service/core/llm_client.py` — `GeminiContactEnrichClient` (with `user_email_domain` + `category_suggestion`), `GeminiMergeSuggestionClient`, `GeminiUrgentClassifier`, `_DOMAIN_MAP`, `_PERSONAL_DOMAINS`, `_extract_domain()`, `_domain_fallback()`, `_gemini_with_retry()`.
  - `apps/ai-service/models/contact.py` — `EnrichContactRequest` (+ `user_email_domain`), `EnrichContactResponse` (+ `category_suggestion`), `ContactSnippet`, `MergeSuggestion`.
  - `apps/ai-service/models/urgent.py` — `ClassifyUrgentRequest`, `ClassifyUrgentResponse`.
  - `apps/ai-service/routes/contact.py` — `/enrich-contact` + `/suggest-merge`.
  - `apps/ai-service/routes/urgent.py` — `/classify-urgent`.
  - `apps/ai-service/services/contact_enricher.py`, `merge_suggester.py`, `urgent_classifier.py`.
- `apps/frontend`:
  - `apps/frontend/src/app/contacts/page.tsx` — danh sách contacts + merge suggestion banner (Dismiss / Merge) + search bar (với `?q=` URL param) + category filter tabs.
  - `apps/frontend/src/app/contacts/[id]/page.tsx` — **redesigned**: `InfoRow` 2-col grid, inline edit mode, category chip badge (with "· confirmed" for user-set), **AI category suggestion banner** (violet card — Confirm/Dismiss). Handle `res.data.cached`. Thread count badge. Timeline với `divide-y`.
  - `apps/frontend/src/hooks/useContacts.ts` — `ContactDTO` bao gồm `enrichedAt?`, `category`, `categorySource`, `categoryAiSuggestion?`. `setSearch`/`setCategoryFilter` exposed.

**Key ideas**:

- `upsertContact` chạy trong `syncEmails` — idempotent theo `email` field.
- Auto-create khi sync email; user cũng có thể tạo thủ công.
- Merge là **soft-merge**: set `mergedInto` ref để giữ audit trail, không xóa bản ghi gốc.
- Contact timeline dùng regex anchor để tránh false-positive (e.g. `notjohn@x.com` không match `john@x.com`).
- `claimedAltEmails` filter ngăn contact đã appear trong `alternateEmails` của contact khác xuất hiện trong merge suggestions.
- Domain fallback map giảm đáng kể số lần gọi Gemini cho các domain phổ biến (VN universities, corporates, international).
- 2-layer hallucination guard cho merge: AI service (`valid_ids` Set) + backend route (`validIdSet` cross-validation).

### FR-07 – Thread Summarization (AI) ✅ IMPLEMENTED

**Goal**: generate concise summaries for email threads to reduce
information overload, shown directly in the thread/timeline UI.

**Primary modules**:

- `apps/backend`:
  - `AIService` in `src/modules/ai/ai.service.ts` calls the AI service `/summarize`.
  - `Thread` model includes `summary` field with `text`, `key_issues`, `action_required`.
  - `POST /api/threads/[threadId]/summarize` route orchestrates the flow.
- `apps/ai-service`:
  - `POST /summarize` endpoint using Google Gemini (`GeminiSummarizationClient`).
  - Returns structured JSON response.
- `apps/frontend`:
  - `AISummaryCard` component displays summaries.
  - Thread detail page (`/threads/[id]`) with summarization button.

**Key ideas**:

- Summaries should include both natural language text and structured
  fields (e.g. `summary`, `key_issues`, `action_required`).
- AI calls should be async and non-blocking for the main request path
  when possible.

### FR-08 – Smart Reply Suggestions (AI) ✅ IMPLEMENTED

**Goal**: propose 2–3 reply options for the latest email in a thread,
surfaced in the thread view so the user can click to pre-fill the composer.
Supports two output formats: conversational message or full email.

**Primary modules**:

- `apps/backend`:
  - `apps/backend/src/modules/ai/ai.service.ts` — `suggestReplies(threadId, latestMessage, context?, maxReplies, format)`. Returns `{ format, replies: ReplyItem[] }`.
  - `apps/backend/src/app/api/threads/[threadId]/suggest-reply/route.ts` — `POST`, accepts optional `{ format }` body; resolves thread+messages internally.
- `apps/ai-service`:
  - `apps/ai-service/routes/reply.py` — `POST /suggest-reply`.
  - `apps/ai-service/services/smart_reply.py` — `suggest_replies()` returns `SuggestReplyResponse` with `List[ReplyItem]`.
  - `apps/ai-service/models/reply.py` — `SuggestReplyRequest` (with `format` field), `ReplyItem` (`subject`, `body`), `SuggestReplyResponse`.
  - `apps/ai-service/core/llm_client.py` — `GeminiReplyClient.suggest_replies()` returns `List[Dict]` with `subject` + `body`.
- `apps/frontend`:
  - `apps/frontend/src/components/SmartReplyBar.tsx` — format toggle (💬 Message / ✉ Email), chip buttons or expanded cards.
  - `apps/frontend/src/app/threads/[id]/page.tsx` — `subjectOverride` state, `handleSelectReply(ReplyItem)`, wired between `AISummaryCard` and messages.
  - `apps/ai-service/core/llm_client.py` — `GeminiReplyClient`.
- `apps/frontend`:
  - `apps/frontend/src/components/SmartReplyBar.tsx` — chip buttons + generate/regenerate.
  - `apps/frontend/src/app/threads/[id]/page.tsx` — wired between `AISummaryCard` and messages.

**Key ideas**:

- Suggestions helpers, not automatic sends — user always edits và confirms via `ComposeDrawer`.
- AI service nhận `latest_message` + `conversation_context` (từ `thread.summary.text` nếu có) để generate relevant replies.
- `SmartReplyBar` mounts lazy — chỉ gọi API khi user click "Generate suggestions".

### FR-09 – Multi-Channel Adapter Interface + Telegram ⏳ PENDING

**Goal**: định nghĩa abstract interface (`IMessage`, `IConversation`, `IChannelAdapter`) độc lập với nguồn kênh. Implement `EmailAdapter` và `TelegramAdapter` (grammy) để minh họa pattern.

**Primary modules**:

- `apps/backend`:
  - `apps/backend/src/modules/channels/interfaces/IChannelAdapter.ts` — `IMessage`, `IConversation`, `IChannelAdapter`.
  - `apps/backend/src/modules/channels/adapters/EmailAdapter.ts` — wrap existing Gmail logic.
  - `apps/backend/src/modules/channels/adapters/TelegramAdapter.ts` — grammy bot, webhook mode.
  - `apps/backend/src/models/TelegramConversation.ts`, `TelegramMessage.ts`.
  - `apps/backend/src/app/api/telegram/webhook/route.ts` — `POST` Telegram webhook handler.
- `apps/frontend`:
  - Unified inbox view với channel badge (Email vs Telegram).
  - Compose/reply đơn giản cho Telegram (plain text).

**Key ideas**:

- Telegram Bot token qua env var `TELEGRAM_BOT_TOKEN`; webhook URL được register khi server start.
- `TelegramConversation` được model tương tự `Thread` nhưng không có Gmail-specific fields.
- `IChannelAdapter` cho phép thêm Zalo/WhatsApp sau này mà không rewrite core logic.
- Local dev: `TELEGRAM_WEBHOOK_URL` trỏ đến ngrok/cloudflare tunnel.

## Design Principles

- Keep the **AI service independent** from storage; all data access is
  via the backend.
- Use **MongoDB** for flexible, semi-structured documents representing
  threads, contacts, and AI outputs.
- Use **Redis** where it simplifies caching or realtime events.
- **FR numbering follows thesis** (`report/Sections/3-RequirementAnalysis.tex`). All `.copilot` docs use thesis numbers.
- Implement only the required FRs first, but structure code so that
  adding new FRs later is a matter of adding new modules, not
  rewriting existing ones.
