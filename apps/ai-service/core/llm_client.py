import json
import asyncio
from typing import List, Dict, Any, Optional

import google.generativeai as genai

from models.summarize import SummarizeRequest
from models.reply import SuggestReplyRequest
from models.contact import EnrichContactRequest, ContactSnippet, MergeSuggestion
from models.urgent import ClassifyUrgentRequest
from models.thread_category import (
    ClassifyThreadCategoryRequest,
    VALID_THREAD_CATEGORIES,
    NOISE_CATEGORIES,
)
from models.topic_label import LabelTopicRequest
from models.chat_analysis import AnalyzeChatRequest, AnalyzeChatResponse, ChatFragment
from core.config import GEMINI_API_KEY, GEMINI_MODEL_NAME


if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set")

genai.configure(api_key=GEMINI_API_KEY)
_model = genai.GenerativeModel(GEMINI_MODEL_NAME)


# ── Token-safety helpers ────────────────────────────────────────────────────

# Rough char budget so we stay well under Gemini's token limit.
# gemini-2.0-flash supports ~1M tokens input, but large prompts are slow and expensive.
# Keep practical per-request limit at ~12 000 chars (~3 000 tokens).
_MAX_TOTAL_CONTENT_CHARS = 12_000
_MAX_PER_MESSAGE_CHARS = 1_500   # truncate each individual message body
_MAX_SNIPPET_CHARS = 400


def _truncate(text: str, max_chars: int) -> str:
    """Hard-truncate text and append an indicator if cut."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "… [truncated]"


def _build_messages_text(request: SummarizeRequest) -> str:
    """Render messages list to a text block, truncating long bodies."""
    parts: List[str] = []
    for m in request.messages:
        body = _truncate(m.text, _MAX_PER_MESSAGE_CHARS)
        parts.append(
            f"From: {m.from_}\nTo: {', '.join(m.to)}\nSent at: {m.sent_at}\nText: {body}"
        )
    full = "\n\n".join(parts)
    # Second-pass: if combined still too long, hard-cut overall
    return _truncate(full, _MAX_TOTAL_CONTENT_CHARS)


# ── Language awareness instruction ─────────────────────────────────────────

_LANG_INSTRUCTION = (
    "IMPORTANT: Always respond entirely in Vietnamese (Tiếng Việt), regardless of the "
    "language of the original email content. Translate all summaries, key issues, "
    "action items, and reply suggestions into Vietnamese."
)


# ── Domain knowledge base (token-free enrichment) ──────────────────────────

# Maps known email domains → (org_name, language).
# org=None means personal provider (no org to infer).
# language=None means unknown from domain alone.
_DOMAIN_MAP: Dict[str, Dict[str, Optional[str]]] = {
    # ── Personal / generic providers ──────────────────────────────────────
    "gmail.com":      {"org": None, "language": None},
    "yahoo.com":      {"org": None, "language": None},
    "yahoo.com.vn":   {"org": None, "language": "vi"},
    "outlook.com":    {"org": None, "language": None},
    "hotmail.com":    {"org": None, "language": None},
    "icloud.com":     {"org": None, "language": None},
    "protonmail.com": {"org": None, "language": None},
    "me.com":         {"org": None, "language": None},
    # ── Vietnamese universities ────────────────────────────────────────────
    "hcmut.edu.vn":   {"org": "HCMUT (Đại học Bách Khoa TP.HCM)", "language": "vi"},
    "hust.edu.vn":    {"org": "HUST (Đại học Bách Khoa Hà Nội)",   "language": "vi"},
    "hcmus.edu.vn":   {"org": "HCMUS (ĐH Khoa học Tự nhiên)",      "language": "vi"},
    "uit.edu.vn":     {"org": "UIT (ĐH Công nghệ Thông tin)",       "language": "vi"},
    "fpt.edu.vn":     {"org": "FPT University",                     "language": "vi"},
    "uet.vnu.edu.vn": {"org": "UET VNU (ĐH Công nghệ - ĐHQGHN)",   "language": "vi"},
    "tdtu.edu.vn":    {"org": "Đại học Tôn Đức Thắng",              "language": "vi"},
    "ueh.edu.vn":     {"org": "UEH (ĐH Kinh tế TP.HCM)",           "language": "vi"},
    "vnu.edu.vn":     {"org": "ĐHQG Hà Nội",                       "language": "vi"},
    "vnuhcm.edu.vn":  {"org": "ĐHQG TP.HCM",                       "language": "vi"},
    "uel.edu.vn":     {"org": "UEL (ĐH Kinh tế - Luật)",           "language": "vi"},
    # ── Vietnamese corporates ───────────────────────────────────────────────
    "fpt.com.vn":     {"org": "FPT Corporation",  "language": "vi"},
    "fpt.com":        {"org": "FPT Corporation",  "language": None},
    "vng.com.vn":     {"org": "VNG Corporation",  "language": "vi"},
    "vingroup.net":   {"org": "Vingroup",          "language": "vi"},
    "vinhomes.vn":    {"org": "Vinhomes",          "language": "vi"},
    "momo.vn":        {"org": "MoMo",              "language": "vi"},
    "tiki.vn":        {"org": "Tiki",              "language": "vi"},
    "sendo.vn":       {"org": "Sendo",             "language": "vi"},
    "zalopay.vn":     {"org": "ZaloPay",           "language": "vi"},
    "vnpay.vn":       {"org": "VNPAY",             "language": "vi"},
    "viettel.com.vn": {"org": "Viettel",           "language": "vi"},
    "vnpt.vn":        {"org": "VNPT",              "language": "vi"},
    "mb.com.vn":      {"org": "MB Bank",           "language": "vi"},
    "vpbank.com.vn":  {"org": "VPBank",            "language": "vi"},
    "techcombank.com.vn": {"org": "Techcombank",   "language": "vi"},
    "vcb.com.vn":     {"org": "Vietcombank",       "language": "vi"},
    # ── International tech ─────────────────────────────────────────────────
    "google.com":     {"org": "Google",    "language": None},
    "microsoft.com":  {"org": "Microsoft", "language": None},
    "amazon.com":     {"org": "Amazon",    "language": None},
    "meta.com":       {"org": "Meta",      "language": None},
    "apple.com":      {"org": "Apple",     "language": None},
    "netflix.com":    {"org": "Netflix",   "language": None},
    "github.com":     {"org": "GitHub",    "language": None},
    "stripe.com":     {"org": "Stripe",    "language": None},
    "openai.com":     {"org": "OpenAI",    "language": None},
    "shopee.com":     {"org": "Shopee",    "language": None},
    "grab.com":       {"org": "Grab",      "language": None},
    "sea.com":        {"org": "Sea Group", "language": None},
    "bytedance.com":  {"org": "ByteDance", "language": None},
    "salesforce.com": {"org": "Salesforce","language": None},
    "atlassian.com":  {"org": "Atlassian", "language": None},
}

_PERSONAL_DOMAINS = {
    "gmail.com", "yahoo.com", "yahoo.com.vn", "outlook.com",
    "hotmail.com", "icloud.com", "protonmail.com", "me.com",
}


def _extract_domain(email: str) -> str:
    parts = email.lower().strip().split("@")
    return parts[1] if len(parts) == 2 else ""


def _domain_fallback(
    email: str, name: Optional[str], has_snippet: bool
) -> Optional[Dict[str, Any]]:
    """
    Return enrichment from local domain map without calling Gemini.
    Returns None when the domain is unknown and Gemini should be called.

    Strategy:
    - Known corporate/educational domain → return org + language; skip Gemini.
    - Personal domain (gmail, etc.) without snippet → no useful inference;
      return nulls immediately to avoid wasting a quota token.
    - Personal domain WITH snippet → let Gemini run (language detection from snippet).
    - Unknown .vn / .edu.vn / .com.vn TLD → language = "vi", org unknown; skip Gemini.
    - Anything else → return None (caller must use Gemini).
    """
    domain = _extract_domain(email)

    if domain in _DOMAIN_MAP:
        entry = _DOMAIN_MAP[domain]
        is_personal = domain in _PERSONAL_DOMAINS
        # For personal providers with a snippet, let Gemini detect language.
        if is_personal and has_snippet:
            return None
        return {
            "display_name": name or None,
            "org": entry["org"],
            "language": entry["language"],
        }

    # Generic Vietnamese TLD heuristic
    if domain.endswith(".vn"):
        return {
            "display_name": name or None,
            "org": None,
            "language": "vi",
        }

    return None  # Unknown domain → call Gemini


# ── Gemini retry helper ─────────────────────────────────────────────────────

async def _gemini_with_retry(prompt: str, max_retries: int = 3, base_delay: float = 1.0) -> str:
    """
    Call Gemini with exponential backoff on 429 Resource Exhausted errors.
    Delays: 1s → 2s → 4s (doubles each attempt).
    """
    last_exc: Exception = RuntimeError("No attempts made")
    for attempt in range(max_retries):
        try:
            response = await _model.generate_content_async(prompt)
            return (response.text or "").strip()
        except Exception as exc:
            last_exc = exc
            msg = str(exc)
            is_rate_limit = "429" in msg or "Resource exhausted" in msg.lower()
            if is_rate_limit and attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                await asyncio.sleep(delay)
                continue
            raise
    raise last_exc




# ── Client implementations ──────────────────────────────────────────────────

class GeminiSummarizationClient:
    async def summarize_thread(self, request: SummarizeRequest) -> Dict[str, Any]:
        messages_text = _build_messages_text(request)
        prompt = (
            "You are an AI assistant that summarizes email threads for a CRM-like system. "
            f"{_LANG_INSTRUCTION}\n\n"
            "Analyze the following email thread and return a JSON object with exactly these fields:\n"
            '- "summary": A concise summary of the thread (string)\n'
            '- "key_issues": An array of key topics or issues discussed (array of strings)\n'
            '- "action_required": An array of action items or next steps (array of strings)\n\n'
            "Return ONLY valid JSON, no markdown formatting or extra text.\n\n"
            f"Thread ID: {request.thread_id}\n\nEmails:\n{messages_text}"
        )

        try:
            text = await _gemini_with_retry(prompt)
        except Exception as exc:  # pragma: no cover
            raise RuntimeError(f"Gemini summarization failed: {exc}") from exc

        if not text:
            raise RuntimeError("Gemini summarization returned empty text")

        # Clean markdown code blocks if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Failed to parse Gemini response as JSON: {text[:200]}") from exc

        return {
            "summary": data.get("summary", ""),
            "key_issues": data.get("key_issues", []),
            "action_required": data.get("action_required", []),
        }


class GeminiReplyClient:
    async def suggest_replies(self, request: SuggestReplyRequest) -> List[Dict[str, Any]]:
        context = _truncate(
            request.conversation_context or "(No additional context provided)",
            _MAX_SNIPPET_CHARS,
        )
        latest_text = _truncate(request.latest_message.text, _MAX_PER_MESSAGE_CHARS)
        reply_format = getattr(request, "format", "message")  # "email" or "message"

        if reply_format == "email":
            format_instruction = (
                "Generate professional EMAIL replies in RFC 2822 style. "
                "For EACH reply option, return a JSON object with:\n"
                '- "subject": reply subject line (usually "Re: <original subject>")\n'
                '- "body": full email body including greeting, content, and sign-off\n'
            )
            format_example = (
                '[\n'
                '  {"subject": "Re: Meeting", "body": "Dear Alice,\\n\\nThank you for your message...\\n\\nBest regards,\\n[Your name]"},\n'
                '  ...\n'
                ']'
            )
        else:
            format_instruction = (
                "Generate short, conversational message replies. "
                "For EACH reply option, return a JSON object with:\n"
                '- "subject": null\n'
                '- "body": the reply text (1-3 sentences, no formal greeting)\n'
            )
            format_example = (
                '[\n'
                '  {"subject": null, "body": "Sounds good, let\'s meet at 3pm."},\n'
                '  ...\n'
                ']'
            )

        prompt = (
            "You are an AI assistant generating reply suggestions for an email thread. "
            f"{_LANG_INSTRUCTION}\n\n"
            f"{format_instruction}"
            f"Return a JSON array of exactly {request.max_replies} reply objects. "
            f"Example format:\n{format_example}\n\n"
            "Return ONLY a valid JSON array, no markdown, no extra text.\n\n"
            f"Thread ID: {request.thread_id}\n"
            f"Conversation context: {context}\n\n"
            "Latest message to reply to:\n"
            f"From: {request.latest_message.from_}\nText: {latest_text}\n"
        )

        try:
            text = await _gemini_with_retry(prompt)
        except Exception as exc:  # pragma: no cover
            raise RuntimeError(f"Gemini reply generation failed: {exc}") from exc

        if not text:
            raise RuntimeError("Gemini reply generation returned empty text")

        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Fallback: try to parse as plain numbered list for backwards compat
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            replies_fallback: List[Dict[str, Any]] = []
            for line in lines:
                cleaned = line
                if cleaned and cleaned[0].isdigit():
                    i = 0
                    while i < len(cleaned) and (cleaned[i].isdigit() or cleaned[i] in {'.', ')', '-', ':'}):
                        i += 1
                    cleaned = cleaned[i:].lstrip()
                if cleaned:
                    replies_fallback.append({"subject": None, "body": cleaned})
            if not replies_fallback:
                raise RuntimeError(f"Failed to parse reply response: {text[:200]}")
            return replies_fallback[: request.max_replies]

        if not isinstance(data, list):
            raise RuntimeError("Gemini reply returned non-list JSON")

        # Normalise each item
        result: List[Dict[str, Any]] = []
        for item in data:
            if isinstance(item, str):
                result.append({"subject": None, "body": item})
            elif isinstance(item, dict):
                result.append({
                    "subject": item.get("subject"),
                    "body": item.get("body", ""),
                })
        return result[: request.max_replies]


def get_summarization_client() -> GeminiSummarizationClient:
    return GeminiSummarizationClient()


def get_reply_client() -> GeminiReplyClient:
    return GeminiReplyClient()


class GeminiContactEnrichClient:
    async def enrich_contact(self, request: EnrichContactRequest) -> Dict[str, Any]:
        contact_domain = _extract_domain(request.email)

        # ── Step 0: same domain as user → colleague ────────────────────────
        if request.user_email_domain and contact_domain == request.user_email_domain:
            fallback = _domain_fallback(request.email, request.name, has_snippet=False)
            base = fallback or {"display_name": request.name or None, "org": None, "language": None}
            base["category_suggestion"] = "colleague"
            return base

        # ── Step 1: try domain-based fallback (no Gemini token cost) ──────
        fallback = _domain_fallback(
            request.email,
            request.name,
            has_snippet=bool(request.conversation_snippet),
        )
        if fallback is not None:
            is_personal = contact_domain in _PERSONAL_DOMAINS
            fallback["category_suggestion"] = None if is_personal else "other"
            return fallback

        # ── Step 2: call Gemini with retry on 429 ─────────────────────────
        snippet_section = (
            f"\nRecent email snippet:\n{_truncate(request.conversation_snippet, _MAX_SNIPPET_CHARS)}"
            if request.conversation_snippet
            else ""
        )
        name_hint = f"\nKnown name: {request.name}" if request.name else ""
        user_domain_hint = (
            f"\nUser's own email domain: {request.user_email_domain}"
            if request.user_email_domain
            else ""
        )
        prompt = (
            "You are a CRM AI assistant. Given an email address and optional context, "
            "infer professional information about the contact. "
            "Return ONLY a valid JSON object with exactly these fields:\n"
            '- "display_name": best guess at full name (string or null)\n'
            '- "org": organization or company name inferred from email domain or context (string or null)\n'
            '- "language": primary language used (ISO 639-1 code like "en", "vi", "fr", or null)\n'
            '- "category_suggestion": one of "colleague" (same org as user), "customer" (client/customer), '
            '"spam" (promotional/unsolicited), "other" (vendor/partner/external/other), '
            '"unknown" (cannot determine)\n\n'
            "Return ONLY valid JSON, no markdown.\n\n"
            f"Contact email: {request.email}"
            f"{name_hint}"
            f"{user_domain_hint}"
            f"{snippet_section}"
        )

        try:
            text = await _gemini_with_retry(prompt)
        except Exception as exc:
            raise RuntimeError(f"Gemini contact enrich failed: {exc}") from exc

        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Failed to parse Gemini response as JSON: {text[:200]}") from exc

        valid_categories = {"colleague", "customer", "spam", "other", "unknown"}
        raw_cat = data.get("category_suggestion")
        category_suggestion = raw_cat if raw_cat in valid_categories else None

        return {
            "display_name": data.get("display_name"),
            "org": data.get("org"),
            "language": data.get("language"),
            "category_suggestion": category_suggestion,
        }


class GeminiMergeSuggestionClient:
    async def suggest_merges(self, contacts: List[ContactSnippet]) -> List[MergeSuggestion]:
        # Cap the contacts list to avoid token overflow
        contacts_sample = contacts[:100]
        contacts_text = "\n".join(
            f"- id={c.contact_id}, email={c.email}, name={c.name or 'unknown'}, "
            f"alt_emails={c.alternate_emails}, tg_user={c.telegram_username}, "
            f"tg_name={c.telegram_name}, chat_snippets={c.recent_chat_snippets}"
            for c in contacts_sample
        )
        prompt = (
            "You are a CRM AI assistant. Analyze the following list of email/telegram contacts and identify "
            "pairs that may represent the same real-world person and should be merged. "
            "Look for: same domain + similar names, alternate emails for the same person, "
            "naming variations (e.g., name vs tg_name). "
            "Additionally, if a contact has chat_snippets (Telegram), compare their content style, "
            "topics, or language with the sample_threads of an email-only contact to infer if they are the same person.\n"
            "Return ONLY a valid JSON array of objects with fields:\n"
            '- "source_id": string (id of the contact to merge FROM, i.e. the duplicate)\n'
            '- "target_id": string (id of the contact to merge INTO, i.e. the primary)\n'
            '- "source_email": string\n'
            '- "target_email": string\n'
            '- "confidence": float between 0 and 1\n'
            '- "reason": string explanation\n\n'
            "Only include pairs with confidence >= 0.7. "
            "Return ONLY valid JSON array (can be empty []), no markdown.\n\n"
            f"Contacts:\n{contacts_text}"
        )

        try:
            text = await _gemini_with_retry(prompt)
        except Exception as exc:
            raise RuntimeError(f"Gemini merge suggestion failed: {exc}") from exc

        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Failed to parse Gemini response as JSON: {text[:200]}") from exc

        if not isinstance(data, list):
            return []

        # Build a set of known valid ids to reject hallucinated ids
        valid_ids = {c.contact_id for c in contacts_sample}

        suggestions: List[MergeSuggestion] = []
        for item in data:
            try:
                sid = str(item["source_id"]).strip()
                tid = str(item["target_id"]).strip()

                # Skip if Gemini confused ids with emails or returned same id for both
                if sid == tid:
                    continue
                if "@" in sid or "@" in tid:
                    continue
                # Skip if either id is not in the set we originally sent
                if sid not in valid_ids or tid not in valid_ids:
                    continue

                suggestions.append(
                    MergeSuggestion(
                        source_id=sid,
                        target_id=tid,
                        source_email=item.get("source_email", ""),
                        target_email=item.get("target_email", ""),
                        confidence=float(item.get("confidence", 0)),
                        reason=item.get("reason", ""),
                    )
                )
            except (KeyError, ValueError):
                continue

        return suggestions


def get_contact_enrich_client() -> GeminiContactEnrichClient:
    return GeminiContactEnrichClient()


def get_merge_suggestion_client() -> GeminiMergeSuggestionClient:
    return GeminiMergeSuggestionClient()


# ── Urgent email classifier ─────────────────────────────────────────────────

# Rule-based keyword set — if any match, mark urgent without Gemini.
# Kept intentionally tight to avoid false positives on common marketing/newsletter words.
_URGENT_KEYWORDS = frozenset([
    "urgent", "asap", "immediately", "critical", "emergency",
    "overdue", "action required", "action needed", "response required",
    "time sensitive", "time-sensitive", "respond by", "due today", "due by",
    "by end of day", "eod", "eob", "end of day", "end of business",
    "past due", "expedite", "high priority",
    "khẩn", "gấp", "hạn chót", "hạn cuối", "cần gấp", "trả lời ngay",
])


def _has_urgent_keyword(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in _URGENT_KEYWORDS)


class GeminiUrgentClassifier:
    async def classify(self, request: ClassifyUrgentRequest) -> dict:
        subject = (request.subject or "").strip()
        snippet = (request.snippet or "").strip()
        combined = (subject + " " + snippet).strip()
        sender_cats = request.sender_categories or []

        # Fast path: known spam sender → never urgent
        if sender_cats and all(c == "spam" for c in sender_cats):
            return {
                "is_urgent": False,
                "reason": "Sender is classified as spam — skipped",
            }

        # Fast path: keyword match — no Gemini call needed
        if _has_urgent_keyword(combined):
            return {
                "is_urgent": True,
                "reason": "Contains urgent keyword/signal in subject or body",
            }

        # No content to analyse
        if not combined:
            return {"is_urgent": False, "reason": "No content to analyse"}

        # Build sender context hint
        sender_context = ""
        if request.sender_email:
            sender_context += f"Sender email: {request.sender_email}\n"
        if sender_cats:
            cat_str = ", ".join(sender_cats)
            if "spam" in sender_cats:
                sender_context += (
                    f"Sender relationship: {cat_str} — "
                    "this contact is marked as spam; lean toward NOT urgent unless the "
                    "content is clearly an actionable business request.\n"
                )
            elif "colleague" in sender_cats or "customer" in sender_cats:
                sender_context += (
                    f"Sender relationship: {cat_str} — "
                    "this is a known colleague or customer; give deadlines and "
                    "blocking requests appropriate urgency weight.\n"
                )
            else:
                sender_context += f"Sender relationship: {cat_str}\n"

        # Gemini path
        prompt = (
            "You are an email priority classifier. Given an email subject, snippet, "
            "and optional sender context, decide if this email requires URGENT attention "
            "(i.e. the sender needs a reply soon, there is a hard deadline, "
            "or an action is actively blocking someone).\n"
            "Do NOT mark as urgent: newsletters, promotions, automated notifications, "
            "routine follow-ups, or reminders without a concrete deadline.\n"
            "Return ONLY a JSON object with exactly two fields:\n"
            '- "is_urgent": boolean\n'
            '- "reason": one short sentence explaining the decision\n\n'
            "Return ONLY valid JSON, no markdown.\n\n"
            + (f"{sender_context}\n" if sender_context else "")
            + f"Subject: {_truncate(subject, 200)}\n"
            f"Snippet: {_truncate(snippet, _MAX_SNIPPET_CHARS)}"
        )

        try:
            text = await _gemini_with_retry(prompt, max_retries=2, base_delay=1.0)
        except Exception as exc:
            # Non-fatal: default to not urgent on failure
            return {"is_urgent": False, "reason": f"Classification unavailable: {exc}"}

        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(text)
            return {
                "is_urgent": bool(data.get("is_urgent", False)),
                "reason": str(data.get("reason", "")),
            }
        except json.JSONDecodeError:
            return {"is_urgent": False, "reason": "Failed to parse classifier response"}


def get_urgent_classifier() -> GeminiUrgentClassifier:
    return GeminiUrgentClassifier()


# ── Thread category classifier ──────────────────────────────────────────────

# Sender email prefixes that indicate automated / no-reply senders.
_NOREPLY_PREFIXES = frozenset([
    "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
    "mailer-daemon", "mailer_daemon", "bounce", "bounces",
    "postmaster", "automated", "notifications", "notification",
    "auto", "automailer", "system", "alert", "alerts",
])

# Subject patterns that indicate automated/transactional emails (case-insensitive).
_AUTOMATED_SUBJECT_PATTERNS = [
    "order confirmed", "order received", "your receipt", "payment received",
    "invoice #", "invoice number", "verification code", "mã xác nhận",
    "mã otp", "đơn hàng", "xác nhận đơn", "thông báo tự động",
    "do not reply", "unsubscribe", "security alert", "sign-in attempt",
]


def _is_noreply_sender(sender_email: Optional[str]) -> bool:
    """Return True if the sender address looks like an automated no-reply account."""
    if not sender_email:
        return False
    local = sender_email.lower().split("@")[0]
    return any(local.startswith(pfx) or local == pfx for pfx in _NOREPLY_PREFIXES)


def _has_automated_subject(subject: str) -> bool:
    lower = subject.lower()
    return any(pat in lower for pat in _AUTOMATED_SUBJECT_PATTERNS)


class GeminiThreadCategoryClient:
    async def classify(self, request: ClassifyThreadCategoryRequest) -> dict:
        subject = (request.subject or "").strip()
        snippet = (request.snippet or "").strip()
        sender_cats = request.sender_categories or []

        # ── Tier 1 hard-reject guards (0 AI cost) ──────────────────────────
        # 1. Sender is contact-categorised as spam
        if sender_cats and all(c == "spam" for c in sender_cats):
            return {
                "categories": ["notification"],
                "noise_filtered": True,
            }

        # 2. Sender email matches no-reply pattern
        if _is_noreply_sender(request.sender_email):
            return {
                "categories": ["notification"],
                "noise_filtered": True,
            }

        # 3. Subject matches automated/transactional patterns
        if subject and _has_automated_subject(subject):
            return {
                "categories": ["notification"],
                "noise_filtered": True,
            }

        # No content to classify
        if not subject and not snippet:
            return {"categories": ["other"], "noise_filtered": False}

        # ── Gemini classification ───────────────────────────────────────────
        categories_list = ", ".join(sorted(VALID_THREAD_CATEGORIES))
        prompt = (
            "You are an email classification assistant. "
            "Given an email subject and snippet, assign one or more categories from the allowed list.\n"
            "A thread can have MULTIPLE categories if applicable (e.g. a meeting request that is also urgent feedback).\n"
            "Allowed categories:\n"
            f"  {categories_list}\n\n"
            "Return ONLY a JSON object with exactly two fields:\n"
            '- "categories": array of 1–3 category strings from the allowed list\n'
            '- "noise_filtered": boolean — true ONLY if this is a fully automated/system '
            "email (newsletter, receipt, OTP, order confirmation, system alert) that requires "
            "no human reply whatsoever\n\n"
            "Return ONLY valid JSON, no markdown.\n\n"
            f"Subject: {_truncate(subject, 200)}\n"
            f"Snippet: {_truncate(snippet, _MAX_SNIPPET_CHARS)}"
        )

        try:
            text = await _gemini_with_retry(prompt, max_retries=2, base_delay=1.0)
        except Exception as exc:
            # Non-fatal: fallback to "other"
            return {"categories": ["other"], "noise_filtered": False}

        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(text)
            raw_cats = data.get("categories", ["other"])
            # Validate: keep only known categories, fallback to ["other"]
            valid_cats = [c for c in raw_cats if c in VALID_THREAD_CATEGORIES]
            if not valid_cats:
                valid_cats = ["other"]
            noise = bool(data.get("noise_filtered", False))
            # Double-check: if Gemini returns noise categories, force noise_filtered=True
            if any(c in NOISE_CATEGORIES for c in valid_cats):
                noise = True
            return {"categories": valid_cats, "noise_filtered": noise}
        except json.JSONDecodeError:
            return {"categories": ["other"], "noise_filtered": False}


def get_thread_category_client() -> GeminiThreadCategoryClient:
    return GeminiThreadCategoryClient()


# ── Chat analyzer client ────────────────────────────────────────────────────

class GeminiChatAnalyzerClient:
    async def analyze_chat(self, request: AnalyzeChatRequest) -> AnalyzeChatResponse:
        prompt = (
            "You are an AI assistant analyzing a chunk of a Telegram chat conversation. "
            f"{_LANG_INSTRUCTION}\n\n"
            "Extract distinct conversational intents or topics from the chunk. "
            "For each distinct intent, map it to an existing topic if one matches, or suggest a new topic name if it's new.\n"
            "Return ONLY a JSON object with a single field 'fragments' containing a list of objects with these fields:\n"
            '- "intent": string (main intent)\n'
            '- "summary": string (short summary)\n'
            '- "topic_action": either "route_to_existing" or "create_new"\n'
            '- "topic_name": string (the existing topic name or a new 2-5 word name)\n\n'
            "Active topics for this contact: " + (", ".join(request.active_topics) if request.active_topics else "None") + "\n\n"
            "Return ONLY valid JSON, no markdown.\n\n"
            f"Chat Chunk:\n{_truncate(request.text_chunk, _MAX_TOTAL_CONTENT_CHARS)}\n"
        )

        try:
            text = await _gemini_with_retry(prompt, max_retries=2, base_delay=1.0)
        except Exception as exc:
            raise RuntimeError(f"Gemini chat analyzer failed: {exc}") from exc

        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(text)
            fragments_data = data.get("fragments", [])
            if not isinstance(fragments_data, list):
                fragments_data = []

            fragments = []
            for item in fragments_data:
                action = item.get("topic_action", "create_new")
                if action not in ["route_to_existing", "create_new"]:
                    action = "create_new"
                    
                fragments.append(ChatFragment(
                    intent=str(item.get("intent", "")),
                    summary=str(item.get("summary", "")),
                    topic_action=action,
                    topic_name=str(item.get("topic_name", "Untitled"))
                ))
            return AnalyzeChatResponse(fragments=fragments)
        except json.JSONDecodeError:
            raise RuntimeError(f"Failed to parse Gemini response as JSON: {text[:200]}")


def get_chat_analyzer_client() -> GeminiChatAnalyzerClient:
    return GeminiChatAnalyzerClient()


# ── Topic label client ──────────────────────────────────────────────────────

class GeminiTopicLabelClient:
    """
    Given a list of thread subjects that belong to the same topic,
    generate a concise human-readable label (2–5 words).

    Shortcut rules (0 AI cost):
    - No subjects → "Untitled"
    - Single short subject → return it directly
    - Otherwise → call Gemini
    """

    async def label(self, request: LabelTopicRequest) -> str:
        subjects = [s.strip() for s in request.thread_subjects if s.strip()]
        if not subjects:
            return "Untitled"

        # Single short subject: no need for AI
        if len(subjects) == 1 and len(subjects[0]) <= 60:
            return subjects[0]

        contact_hint = (
            f"with contact \u201c{request.contact_name}\u201d" if request.contact_name else ""
        )
        subjects_text = "\n".join(
            f"- {_truncate(s, 150)}" for s in subjects[:20]
        )

        prompt = (
            f"{_LANG_INSTRUCTION}\n\n"
            "You are a topic labeling assistant for an email application. "
            f"Given a list of related email thread subjects from a conversation "
            f"{contact_hint}, generate a concise, descriptive topic name.\n\n"
            "Rules:\n"
            "- Return ONLY the topic name, nothing else (no quotes, no punctuation at end)\n"
            "- 2 to 5 words maximum\n"
            "- In Vietnamese if the email subjects are in Vietnamese, otherwise in English\n"
            "- Be specific and meaningful; avoid generic labels like \'Email Discussion\'\n\n"
            f"Thread subjects:\n{subjects_text}\n\n"
            "Topic name:"
        )

        try:
            text = await _gemini_with_retry(prompt, max_retries=2, base_delay=1.0)
            name = text.strip().strip('"').strip("'").strip()
            # Safety cap
            return name[:100] if name else subjects[0][:100]
        except Exception:
            # Fallback: return first subject
            return subjects[0][:100]


def get_topic_label_client() -> GeminiTopicLabelClient:
    return GeminiTopicLabelClient()
