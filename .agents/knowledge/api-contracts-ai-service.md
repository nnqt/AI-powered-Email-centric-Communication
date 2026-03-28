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
| `POST /classify-thread-category` | FR-10 | `{ thread_id, subject, snippet, sender_email }` | `{ thread_id, categories[], noise_filtered }` |
| `POST /label-topic` | FR-10 | `{ topic_id, thread_subjects[], contact_name? }` | `{ topic_id, name }` |
| `POST /analyze-chat-chunk` | FR-09 | `{ text_chunk, active_topics[] }` | `{ fragments[{ intent, summary, topic_action, topic_name }] }` |

---

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
