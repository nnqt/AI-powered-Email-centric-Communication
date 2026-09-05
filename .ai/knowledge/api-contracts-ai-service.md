# API Contracts — AI Service (FastAPI)

Base: `http://localhost:5000` (local) / `http://ai-service:5000` (Docker internal)

All endpoints `async`, return JSON. **No auth required** (internal service only).

---

## Quick Reference

| Endpoint | FR | Input | Output |
|----------|----|-------|--------|
| `POST /summarize` | FR-07 | `{ thread_id, messages[] }` | `{ thread_id, summary, key_issues[], action_required[] }` |
| `POST /suggest-reply` | FR-08 | `{ thread_id, conversation_context, latest_message, max_replies, format, thread_intent?, sender_category?, selected_next_actions?, additional_context? }` | `{ thread_id, format, replies[{ subject, body }] }` |
| `POST /enrich-contact` | FR-06 | `{ email, name, conversation_snippet, user_email_domain }` | `{ display_name, org, language, category_suggestion }` |
| `POST /suggest-merge` | FR-06 | `{ contacts[{ contact_id, email, name, alternate_emails, sample_threads }] }` | `[{ source_id, target_id, confidence, reason }]` |
| `POST /classify-urgent` | FR-04 | `{ thread_id, subject, snippet, sender_email?, sender_categories? }` | `{ thread_id, is_urgent, reason }` |
| `POST /classify-thread-category` | FR-10 | `{ thread_id, subject, snippet, sender_email }` | `{ thread_id, categories[], noise_filtered, topic_key?, topic_key_confidence? }` |
| `POST /label-topic` | FR-10 | `mode="label": { topic_id, thread_subjects[], contact_name? }` or `mode="consolidate": { contact_id, contact_name?, candidates[], min_confidence? }` | `mode="label": { topic_id, name }` or `mode="consolidate": { clusters[], topic_name_overrides[], unmerged_topic_ids[] }` |
| `POST /analyze-thread` | FR-10 | `{ thread_id, subject?, snippet?, sender_email?, sender_categories?, messages[] }` | `{ thread_id, categories[], noise_filtered, topic_key?, topic_key_confidence?, summary?, key_issues[], action_required[], quality_tier, should_cluster, should_summarize }` |
| `POST /analyze-chat-chunk` | FR-09 | `{ text_chunk, active_topics[] }` | `{ fragments[{ intent, summary, topic_action, topic_name }] }` |

---

## FR-10 Contract Details

### `POST /classify-thread-category`

**Request:**
```json
{
  "thread_id": "t-001",
  "subject": "Cap nhat tien do UAT CRM",
  "snippet": "Can xac nhan moc ban giao build",
  "sender_email": "linh.pm.client@example.com"
}
```

**Response:**
```json
{
  "thread_id": "t-001",
  "categories": ["project_update"],
  "noise_filtered": false,
  "topic_key": "crm-delivery-project",
  "topic_key_confidence": 0.82
}
```

Notes:
- `topic_key` is optional and null for automated/noise threads.
- `topic_key_confidence` is optional float `0.0..1.0`.

### `POST /label-topic` with `mode="label"`

**Request:**
```json
{
  "mode": "label",
  "topic_id": "topic-001",
  "thread_subjects": [
    "Cap nhat tien do ban giao module CRM",
    "Thong nhat backlog sau UAT"
  ],
  "contact_name": "Linh Tran"
}
```

**Response:**
```json
{
  "mode": "label",
  "topic_id": "topic-001",
  "name": "Tien do CRM UAT",
  "clusters": [],
  "unmerged_topic_ids": []
}
```

### `POST /label-topic` with `mode="consolidate"`

**Request:**
```json
{
  "mode": "consolidate",
  "contact_id": "contact-001",
  "contact_name": "Linh Tran",
  "min_confidence": 0.8,
  "candidates": [
    {
      "topic_id": "topic-a",
      "name": "CRM UAT Dot 1",
      "cluster_key": "crm-delivery-project",
      "name_edited_by_user": false,
      "thread_subjects": ["Cap nhat tien do UAT"],
      "thread_summaries": ["Khach hang can moc ban giao"],
      "thread_key_issues": ["Thieu scope baseline"],
      "thread_action_required": ["Xac nhan moc 16:00"],
      "thread_categories": ["project_update"],
      "telegram_chat_insights": ["intent: follow_up"],
      "telegram_recent_messages": ["Can gui bang budget hom nay"]
    }
  ]
}
```

**Response:**
```json
{
  "mode": "consolidate",
  "topic_id": null,
  "name": null,
  "clusters": [
    {
      "canonical_cluster_key": "crm-delivery-project",
      "canonical_name": "CRM Delivery Project",
      "topic_ids": ["topic-a", "topic-b"],
      "confidence": 0.86,
      "reason": "Cung context UAT/backlog/release"
    }
  ],
  "topic_name_overrides": [
    {
      "topic_id": "topic-a",
      "name": "CRM Delivery Project",
      "confidence": 0.86
    }
  ],
  "unmerged_topic_ids": ["topic-c"]
}
```

Notes:
- `clusters[].topic_ids` must contain at least 2 ids.
- `topic_name_overrides` lets backend rename merged/singleton topics in the same consolidate pass.
- Backend applies merge decisions only for valid topic ids within the same contact scope.

### `POST /analyze-thread`

**Request:**
```json
{
  "thread_id": "t-001",
  "subject": "Cap nhat tien do UAT CRM",
  "snippet": "Can xac nhan moc ban giao build",
  "sender_email": "linh.pm.client@example.com",
  "sender_categories": ["customer"],
  "messages": [
    {
      "id": "m-001",
      "from": "linh.pm.client@example.com",
      "to": ["po@yourcompany.com"],
      "sent_at": "2026-03-31T09:15:00.000Z",
      "text": "Nho xac nhan scope baseline truoc 16:00"
    }
  ]
}
```

**Response:**
```json
{
  "thread_id": "t-001",
  "categories": ["project_update"],
  "noise_filtered": false,
  "topic_key": "crm-delivery-project",
  "topic_key_confidence": 0.82,
  "summary": ["Khach hang can xac nhan scope baseline truoc 16:00"],
  "key_issues": ["Moc xac nhan scope sap den han"],
  "action_required": ["Gui scope baseline da chot"],
  "quality_tier": "high",
  "should_cluster": true,
  "should_summarize": true
}
```

## Key Behaviors

### Token Safety
- Per-message cap: **1,500 chars**. Total per request: **12,000 chars**. Snippet/context: **400 chars**.
- `_truncate(text, max_chars)` — hard-truncates, appends `"… [truncated]"`.

### Language Policy
- Summarize + Smart Reply: **always Vietnamese** (`_LANG_INSTRUCTION`)
- Contact enrichment, merge suggestions, urgent, categories: **structured data** (no language instruction)

### Fast-Paths (0 Gemini cost)
- `/enrich-contact`: same domain as user → `category = "colleague"`. Known domain map (50+) → skip Gemini.
- `/classify-urgent`: keyword match → `is_urgent=True`. Spam sender → `is_urgent=False`.
- `/classify-thread-category` Tier 1: noreply/automated sender → `noise_filtered=true, categories=["notification"]`.
- `/label-topic`: no subjects → `"Untitled"`. Single subject ≤60 chars → return as-is.

### Rate Limit Handling
`_gemini_with_retry(call_fn, max_retries=3)` — exponential backoff: 1s → 2s → 4s on 429. Raises immediately on non-429.

### Merge Hallucination Guards
- AI Service: `valid_ids` Set — filter pairs where `source_id`/`target_id` not in input set; filter `source_id == target_id`.
- Backend: cross-validate against MongoDB contact IDs before caching. Cap 100 contacts.

### Smart Reply Formats

**`format: "email"` — Action-oriented professional emails (context-aware)**
- When `thread_intent` and/or `sender_category` provided, uses specialized prompt for better context
- Prioritizes user-selected context from Smart Reply Studio (`selected_next_actions`, `additional_context`)
- Style target: warm, customer-friendly language; avoid robotic heading templates
- If key details are missing, asks for confirmation politely instead of fabricating facts
- Optional input fields:
  - `thread_intent`: e.g., `"complaint"`, `"inquiry"`, `"follow_up"`, `"proposal"`, `"negotiation"`
  - `sender_category`: e.g., `"customer"`, `"vendor"`, `"colleague"`, `"supplier"`, `"manager"`
  - `selected_next_actions`: array of actions selected by user from latest summary
  - `additional_context`: free-text context entered by user

**`format: "message"` — Conversational short replies**
- 1–3 short conversational sentences, `subject: null`
- No salutation or formal structure

**Fallback parser:**
- If response not valid JSON → `[{ subject: null, body: text }]`

### Thread Category Enum (22 values)
```
inquiry | introduction | follow_up | thank_you | proposal | contract | invoice | negotiation
project_update | task_request | meeting_request | report
support_request | bug_report | complaint | feedback
notification | newsletter | receipt | security_alert | personal | other
```
