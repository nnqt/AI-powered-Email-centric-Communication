# AI Service Architecture Spec

Path: `apps/ai-service/`  
Runtime: Python 3.12, FastAPI, `google-generativeai`, `uvicorn`

---

## Module Structure

```
apps/ai-service/
├── main.py                  # FastAPI app factory, load_dotenv(), router wiring
├── requirements.txt
├── core/
│   ├── config.py            # Reads GEMINI_API_KEY, GEMINI_MODEL_NAME from env
│   └── llm_client.py        # All Gemini client classes + shared helpers
├── routes/
│   ├── summarize.py         # POST /summarize
│   ├── reply.py             # POST /suggest-reply
│   ├── contact.py           # POST /enrich-contact, POST /suggest-merge
│   ├── urgent.py            # POST /classify-urgent
│   ├── thread_category.py   # POST /classify-thread-category
│   └── topic_label.py       # POST /label-topic
├── services/
│   ├── summarizer.py
│   ├── smart_reply.py
│   ├── contact_enricher.py
│   ├── merge_suggester.py
│   ├── urgent_classifier.py
│   ├── thread_categorizer.py
│   └── topic_labeler.py
└── models/
    ├── summarize.py
    ├── reply.py             # SuggestReplyRequest(+format), ReplyItem, SuggestReplyResponse
    ├── contact.py           # EnrichContactRequest(+user_email_domain), EnrichContactResponse(+category_suggestion), ContactSnippet, MergeSuggestion
    ├── urgent.py            # ClassifyUrgentRequest(+sender_email, +sender_categories), ClassifyUrgentResponse
    ├── thread_category.py   # ClassifyThreadCategoryRequest/Response, VALID_THREAD_CATEGORIES, NOISE_CATEGORIES
    └── topic_label.py       # LabelTopicRequest(topic_id, thread_subjects[], contact_name?), LabelTopicResponse
```

---

## Gemini Clients (`core/llm_client.py`)

| Class                         | Endpoint                    | Output                                                 |
| ----------------------------- | --------------------------- | ------------------------------------------------------ |
| `GeminiSummarizationClient`   | `/summarize`                | `{ summary, key_issues[], action_required[] }`         |
| `GeminiReplyClient`           | `/suggest-reply`            | `List[Dict]` with `subject` + `body`                   |
| `GeminiContactEnrichClient`   | `/enrich-contact`           | `{ display_name, org, language, category_suggestion }` |
| `GeminiMergeSuggestionClient` | `/suggest-merge`            | `List[MergeSuggestion]`                                |
| `GeminiUrgentClassifier`      | `/classify-urgent`          | `{ is_urgent, reason }`                                |
| `GeminiThreadCategoryClient`  | `/classify-thread-category` | `{ categories[], noise_filtered }`                     |
| `GeminiTopicLabelClient`      | `/label-topic`              | `{ name }`                                             |

Factory functions: `get_summarization_client()`, `get_reply_client()`, `get_thread_category_client()`, `get_topic_label_client()`, etc.

---

## Token Safety Helpers

```python
_MAX_TOTAL_CONTENT_CHARS = 12_000   # All messages combined per request
_MAX_PER_MESSAGE_CHARS   = 1_500    # Single message body
_MAX_SNIPPET_CHARS       = 400      # conversation_context / contact snippet

def _truncate(text: str, max_chars: int) -> str:
    # Hard-truncates, appends "… [truncated]" if cut
```

`_build_messages_text(messages)` — joins messages respecting `_MAX_PER_MESSAGE_CHARS`, stops at `_MAX_TOTAL_CONTENT_CHARS`.

---

## Language Policy

```python
_LANG_INSTRUCTION = (
    "Always respond entirely in Vietnamese (Tiếng Việt), "
    "regardless of the language of the original email content."
)
```

Applied to: summarization prompts, smart reply prompts. **Not** applied to: contact enrichment, merge suggestions, urgent classification (output is structured data, not prose).

---

## Rate Limit Handling

```python
def _gemini_with_retry(call_fn, max_retries=3):
    # Exponential backoff: 1s → 2s → 4s on 429 errors
    # Raises on non-429 errors immediately
```

Applied to all Gemini clients.

---

## Domain Fallback Map (`_DOMAIN_MAP`)

50+ known domains → skip Gemini entirely for `/enrich-contact`:

- Vietnamese universities (`hcmut.edu.vn`, `vnu.edu.vn`, `hust.edu.vn`, ...)
- Vietnamese corporates (`fpt.com.vn`, `viettel.com.vn`, `vnpt.com.vn`, ...)
- International big tech (`google.com`, `microsoft.com`, `amazon.com`, ...)
- `.vn` TLD suffix rule → `language = "vi"`

`_PERSONAL_DOMAINS` set (`gmail.com`, `yahoo.com`, `hotmail.com`, ...) — personal domain + no snippet → skip Gemini, return minimal result.

---

## Urgent Classifier Fast-Path

```python
_URGENT_KEYWORDS = frozenset({
    # English
    "urgent", "asap", "immediately", "critical", "emergency",
    "deadline", "overdue", "action required", "time-sensitive",
    # Vietnamese
    "khẩn", "gấp", "ngay", "khẩn cấp", "cấp bách", "deadline",
    "hạn chót", "quan trọng", ...
})
```

Logic: if any keyword in `subject.lower() + snippet.lower()` → `is_urgent=True`, no Gemini call. Else → Gemini call with `max_retries=2`; default `is_urgent=False` on any error.

---

## Contact Category AI Suggestion (FR-06)

`GeminiContactEnrichClient` 3-step category inference:

1. **Same-domain fast-path**: `contact_domain == user_email_domain` → `category_suggestion = "colleague"` (no Gemini).
2. **Domain fallback**: known corporate domain → `"other"`; personal domain → `None`.
3. **Gemini**: prompt returns `category_suggestion` field. Validated against `{"colleague", "customer", "other", "spam"}`.

Saved to `Contact.categoryAiSuggestion`. User confirms/dismisses via frontend banner → PATCH sets `categorySource = "user"` and clears `categoryAiSuggestion`.

---

## Merge Suggestion Hallucination Guards

**AI Service**: `valid_ids = {c.contact_id for c in contacts}` — filter pairs where `source_id` or `target_id` not in set; filter `source_id == target_id`; filter IDs containing `@`.

**Backend route** (`merge-suggestions`): cross-validate AI response against MongoDB contact IDs before caching. Filter `source_id === target_id`.

---

## Smart Reply Format

`format: "email"` → full RFC 2822-style reply with:

- Greeting (`Kính gửi anh/chị,`)
- Body paragraphs
- Sign-off (`Trân trọng,\n[Tên của bạn]`)
- Non-null `subject` field

`format: "message"` → 1–3 short conversational sentences, `subject: null`.

Fallback parser: if Gemini response is not valid JSON, parse as plain text → `[{ subject: null, body: text }]`.

---

## Thread Category Client (`GeminiThreadCategoryClient`)

**Tier 1 hard-reject** (0 Gemini cost):

- `_is_noreply_sender(sender_email)` — matches `_NOREPLY_PREFIXES` set (noreply, no-reply, bounce, postmaster, mailer-daemon, donotreply, ...)
- `_has_automated_subject(subject)` — regex scan for patterns like "Unsubscribe", "Auto-Reply", "Delivery failure", etc.
- Result: `noise_filtered=True, categories=["notification"]`

**Tier 2 Gemini**: prompt instructs 1–3 categories from the 22-value enum. Validated against `VALID_THREAD_CATEGORIES`.

---

## Topic Label Client (`GeminiTopicLabelClient`)

**0-cost shortcuts**:

1. No subjects → `"Untitled"`
2. Single subject ≤ 60 chars → return it directly (stripped of Re:/Fwd: prefix)

**Gemini**: up to 20 subjects provided; prompt instructs 2–5 word concise label in the same language as the subjects. Fallback on error: return first subject.
