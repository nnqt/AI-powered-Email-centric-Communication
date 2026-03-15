# API Contracts — Backend (Next.js)

Base: `http://localhost:4000` (local) / `http://backend:4000` (Docker internal)

All routes require session auth unless noted. Auth failure → 401.

---

## Email Sync

### `POST /api/emails/sync`

Sync latest Gmail messages.  
**Body**: `{ pageToken?: string }`  
**Response**: `{ syncedMessages: number, nextPageToken: string|null, hasMore: boolean }`  
**Side effects**: upserts Thread + Message + Contact docs; fires `EMAIL_SYNCED` Socket.IO event; triggers fire-and-forget urgent classification.

### `GET /api/emails/sync`

Get sync status.  
**Response**: `{ hasMore: boolean, nextPageToken: string|null, syncComplete: boolean }`

### `POST /api/emails/send`

Send email via Gmail.  
**Body**: `{ to: string, subject: string, htmlBody: string, threadId?: string, attachmentIds?: string[] }`  
**Response**: `{ threadId: string }`  
**Side effects**: upserts Thread + Message; fires `EMAIL_SENT` Socket.IO event.

### `POST /api/emails/attachments`

Upload attachment (multipart/form-data).  
**Response**: `{ attachmentId: string, filename: string, size: number }`

---

## Threads

### `GET /api/threads`

Paginated thread list.  
**Query**: `limit?` (default 20), `cursor?`, `filter?: "all"|"unread"|"archived"|"urgent"` (default `"all"`), `q?` (search string)  
**Response**: `{ threads: ThreadDTO[], total: number, hasNext: boolean, hasPrev: boolean }`

**ThreadDTO fields**: `id`, `subject`, `snippet`, `participants[]`, `lastMessageDate`, `isRead`, `isArchived`, `isUrgent`, `urgentClassifiedAt`, `summary?`

### `GET /api/threads/[threadId]`

Single thread + all messages.  
**Response**: `{ thread: ThreadDTO, messages: MessageDTO[] }`

### `PATCH /api/threads/[threadId]/read`

Toggle read/unread. Updates MongoDB + Gmail.  
**Body**: `{ read: boolean }`  
**Response**: `{ success: true }`

### `PATCH /api/threads/[threadId]/archive`

Archive thread. Updates MongoDB + removes Gmail INBOX label.  
**Response**: `{ success: true }`

### `POST /api/threads/[threadId]/summarize`

Generate AI summary (calls AI service `POST /summarize`).  
Saves result to `Thread.summary`. Emits `SUMMARY_READY` socket event.  
**Response**: `{ summary: { text, key_issues[], action_required[] } }`

### `POST /api/threads/[threadId]/suggest-reply`

Generate smart reply suggestions (calls AI service `POST /suggest-reply`).  
**Body**: `{ format?: "email"|"message" }` (default `"message"`)  
**Response**: `{ threadId, format, replies: [{ subject: string|null, body: string }] }`

---

## Contacts

### `GET /api/contacts`

List contacts with search + category filter.  
**Query**: `q?` (search), `category?`  
**Response**: `ContactDTO[]`

### `POST /api/contacts`

Create contact manually.  
**Body**: `{ email, name?, org?, language? }`  
**Response**: `ContactDTO`

### `GET /api/contacts/[contactId]`

Single contact (includes `enrichedAt`, `category`, `categoryAiSuggestion`).  
**Response**: `ContactDTO`

### `PATCH /api/contacts/[contactId]`

Update contact fields.  
**Body**: `{ name?, org?, language?, alternateEmails?, category?, categorySource?, categoryAiSuggestion? }`  
**Response**: `ContactDTO`

### `GET /api/contacts/[contactId]/timeline`

Email threads where contact appears in `participants`.  
**Response**: `ThreadDTO[]`

### `POST /api/contacts/[contactId]/enrich`

AI-enrich contact metadata. Guard: if `aiEnriched=true` → `{ contact, cached: true }` (no AI call).  
**Query**: `force=true` to bypass cache guard.  
**Response**: `{ contact: ContactDTO, cached?: boolean }`

### `GET /api/contacts/merge-suggestions`

AI-powered merge candidates. Redis cache 6h.  
**Query**: `refresh=true` to bypass cache.  
**Response**: `{ suggestions: MergeSuggestion[], fromCache: boolean }`

### `POST /api/contacts/merge`

Soft-merge source into target. Clears Redis merge cache on success.  
**Body**: `{ sourceId: string, targetId: string }`  
**Response**: `{ success: true }`

---

## Auth (NextAuth v4)

| Route                           | Notes                 |
| ------------------------------- | --------------------- |
| `GET /api/auth/session`         | Session info          |
| `POST /api/auth/signin`         | Initiate OAuth        |
| `GET /api/auth/callback/google` | Google OAuth redirect |
| `POST /api/auth/signout`        | Sign out              |

---

## ContactDTO Interface (TypeScript)

```typescript
interface ContactDTO {
  _id: string;
  email: string;
  name?: string;
  org?: string;
  language?: string;
  alternateEmails: string[];
  aiEnriched: boolean;
  enrichedAt?: string; // ISO date string
  mergedInto?: string;
  category: "colleague" | "customer" | "other" | "spam" | "unknown";
  categories: ("colleague" | "customer" | "other" | "spam" | "unknown")[];
  categorySource: "rule" | "ai" | "user";
  categoryAiSuggestion?: string;
  createdAt: string;
  updatedAt: string;
}
```

### `POST /api/contacts/bulk-enrich`

Enrich all un-enriched contacts with AI in batches.  
**Response**: `{ processed: number, skipped: number, failed: number, total: number }`  
Cap: 200 contacts per call. Batches of 5 with 300ms delay. Thread snippet used as context.

### `GET /api/contacts/[contactId]/topics`

List all topics for a contact (sorted by focusScore desc).  
**Response**: `{ topics: TopicDTO[] }`

---

## Topics

### `GET /api/topics`

List all topics for the authenticated user sorted by focusScore desc.  
**Query**: `limit?` (default 20)  
**Response**: `{ topics: TopicDTO[] }`

### `GET /api/topics/[topicId]`

Single topic with its threads.  
**Response**: `{ topic: TopicDTO, threads: ThreadDTO[] }`

### `PATCH /api/topics/[topicId]`

Rename a topic. Sets `nameEditedByUser=true` (prevents future AI re-labeling).  
**Body**: `{ name: string }`  
**Response**: `{ topic: TopicDTO }`

---

## Focus

### `GET /api/focus`

Return top focus topics for the authenticated user sorted by focusScore desc.  
**Query**: `limit?` (default 20), `refresh?` (`1` = re-score all topics before returning)  
**Response**: `{ topics: FocusTopicDTO[] }`

---

## TopicDTO Interface (TypeScript)

```typescript
interface TopicDTO {
  _id: string;
  name: string;
  nameEditedByUser: boolean;
  threadCount: number;
  noiseCount: number;
  focusScore: number;
  unansweredCount: number;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  aiLabeled: boolean;
  aiLabeledAt?: string;
}

interface FocusTopicDTO extends TopicDTO {
  contact: {
    _id: string;
    email: string;
    name?: string;
    org?: string;
    category: string;
    categories: string[];
  };
}
```

---

# API Contracts — AI Service (FastAPI)

Base: `http://localhost:5000` (local) / `http://ai-service:5000` (Docker internal)

All endpoints are `async`, return JSON. No auth required (internal service).

---

## `POST /summarize` (FR-07)

**Request**:

```json
{
  "thread_id": "abc123",
  "messages": [
    {
      "id": "m1",
      "from": "user@x.com",
      "to": ["other@x.com"],
      "sent_at": "2025-01-01T10:00:00Z",
      "text": "..."
    }
  ]
}
```

**Response**:

```json
{
  "thread_id": "abc123",
  "summary": "...",
  "key_issues": ["..."],
  "action_required": ["..."]
}
```

Output always in Vietnamese (`_LANG_INSTRUCTION`). Message texts truncated to 1,500 chars each; total capped at 12,000 chars.

---

## `POST /suggest-reply` (FR-08)

**Request**:

```json
{
  "thread_id": "abc123",
  "conversation_context": "...",
  "latest_message": { "id": "m3", "from": "x@x.com", "text": "..." },
  "max_replies": 3,
  "format": "email"
}
```

**Response** (`format: "email"`):

```json
{
  "thread_id": "abc123",
  "format": "email",
  "replies": [{ "subject": "Re: ...", "body": "Kính gửi..." }]
}
```

**Response** (`format: "message"`):

```json
{
  "thread_id": "abc123",
  "format": "message",
  "replies": [{ "subject": null, "body": "Xác nhận rồi..." }]
}
```

`conversation_context` capped 400 chars; `latest_message.text` capped 1,500 chars.

---

## `POST /enrich-contact` (FR-06)

**Request**: `{ "email": "...", "name": "...", "conversation_snippet": "...", "user_email_domain": "..." }`  
**Response**: `{ "display_name": "...", "org": "...", "language": "vi", "category_suggestion": "colleague"|"customer"|"other"|"spam"|null }`

Fast-path: same domain as `user_email_domain` → `category_suggestion = "colleague"` (no Gemini).  
Domain fallback: `_DOMAIN_MAP` (50+ known domains) → infer org/language/category without Gemini.

---

## `POST /suggest-merge` (FR-06)

**Request**: `{ "contacts": [{ "contact_id": "...", "email": "...", "name": "...", "alternate_emails": [], "sample_threads": ["..."] }] }`  
Contacts list capped at **100**.

**Response**: `[{ "source_id": "...", "target_id": "...", "source_email": "...", "target_email": "...", "confidence": 0.92, "reason": "..." }]`  
Only pairs with `confidence >= 0.7` returned. Hallucination guard: `valid_ids` Set filters unknown IDs + `sid == tid` pairs.

---

## `POST /classify-urgent`

**Request**: `{ "thread_id": "abc123", "subject": "URGENT: ...", "snippet": "..." }`  
**Response**: `{ "thread_id": "abc123", "is_urgent": true, "reason": "..." }`

Fast-path: keyword scan (no Gemini). Fallback: Gemini with `max_retries=2`. Default `is_urgent=false` on error.  
Spam fast-path: if `sender_categories == ["spam"]` → `is_urgent=false` immediately (no Gemini).  
**Request** also accepts: `sender_email?: string`, `sender_categories?: string[]`.

---

## `POST /classify-thread-category` (FR-10 Phase 1)

**Request**: `{ "thread_id": "abc123", "subject": "...", "snippet": "...", "sender_email": "..." }`  
**Response**: `{ "thread_id": "abc123", "categories": ["inquiry", "follow_up"], "noise_filtered": false }`

Tier 1 hard-reject: noreply/bounce/automated patterns → `noise_filtered=true, categories=["notification"]` (no Gemini).  
Tier 2 Gemini: returns 1–3 categories from the 22-value enum.

---

## `POST /label-topic` (FR-10 Phase 3)

**Request**: `{ "topic_id": "abc123", "thread_subjects": ["Re: Project update", "Project update"], "contact_name": "Alice" }`  
**Response**: `{ "topic_id": "abc123", "name": "Project Update" }`

0-cost shortcuts:

- No subjects → `"Untitled"`
- Single subject ≤ 60 chars → return it directly

Otherwise: Gemini 2–5 word label in the same language as the subjects.
