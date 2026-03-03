import json
from typing import List, Dict, Any, Optional

import google.generativeai as genai

from models.summarize import SummarizeRequest
from models.reply import SuggestReplyRequest
from models.contact import EnrichContactRequest, ContactSnippet, MergeSuggestion
from core.config import GEMINI_API_KEY, GEMINI_MODEL_NAME


if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set")

genai.configure(api_key=GEMINI_API_KEY)
_model = genai.GenerativeModel(GEMINI_MODEL_NAME)


class GeminiSummarizationClient:
    async def summarize_thread(self, request: SummarizeRequest) -> Dict[str, Any]:
        messages_text = "\n\n".join(
            f"From: {m.from_}\nTo: {', '.join(m.to)}\nSent at: {m.sent_at}\nText: {m.text}"
            for m in request.messages
        )
        prompt = (
            "You are an AI assistant that summarizes email threads for a CRM-like system. "
            "Analyze the following email thread and return a JSON object with exactly these fields:\n"
            '- "summary": A concise summary of the thread (string)\n'
            '- "key_issues": An array of key topics or issues discussed (array of strings)\n'
            '- "action_required": An array of action items or next steps (array of strings)\n\n'
            "Return ONLY valid JSON, no markdown formatting or extra text.\n\n"
            f"Thread ID: {request.thread_id}\n\nEmails:\n{messages_text}"
        )

        try:
            response = await _model.generate_content_async(prompt)
        except Exception as exc:  # pragma: no cover - network/provider
            raise RuntimeError(f"Gemini summarization failed: {exc}") from exc

        text = (response.text or "").strip()
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
    async def suggest_replies(self, request: SuggestReplyRequest) -> List[str]:
        context = request.conversation_context or "(No additional context provided)"
        latest = request.latest_message
        prompt = (
            "You are an AI assistant generating professional, concise reply suggestions for an email thread. "
            "Return ONLY a numbered list of reply options, without extra commentary.\n\n"
            f"Thread ID: {request.thread_id}\n"
            f"Conversation context: {context}\n\n"
            "Latest message from the other party:\n"
            f"From: {latest.from_}\nText: {latest.text}\n\n"
            f"Generate {request.max_replies} distinct reply options."
        )

        try:
            response = await _model.generate_content_async(prompt)
        except Exception as exc:  # pragma: no cover - network/provider
            raise RuntimeError(f"Gemini reply generation failed: {exc}") from exc

        text = (response.text or "").strip()
        if not text:
            raise RuntimeError("Gemini reply generation returned empty text")

        # Parse numbered list into individual replies
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        replies: List[str] = []
        for line in lines:
            cleaned = line
            if cleaned[0].isdigit():
                # Remove leading numbering like "1.", "2)", "3 -"
                i = 0
                while i < len(cleaned) and (cleaned[i].isdigit() or cleaned[i] in {'.', ')', '-', ':'}):
                    i += 1
                cleaned = cleaned[i:].lstrip()
            if cleaned:
                replies.append(cleaned)

        if not replies:
            raise RuntimeError("Gemini reply parsing produced no replies")

        return replies[: request.max_replies]


def get_summarization_client() -> GeminiSummarizationClient:
    return GeminiSummarizationClient()


def get_reply_client() -> GeminiReplyClient:
    return GeminiReplyClient()


class GeminiContactEnrichClient:
    async def enrich_contact(self, request: EnrichContactRequest) -> Dict[str, Any]:
        snippet_section = (
            f"\nRecent email snippet:\n{request.conversation_snippet}"
            if request.conversation_snippet
            else ""
        )
        name_hint = f"\nKnown name: {request.name}" if request.name else ""
        prompt = (
            "You are a CRM AI assistant. Given an email address and optional context, "
            "infer professional information about the contact. "
            "Return ONLY a valid JSON object with exactly these fields:\n"
            '- "display_name": best guess at full name (string or null)\n'
            '- "org": organization or company name inferred from email domain or context (string or null)\n'
            '- "language": primary language used (ISO 639-1 code like "en", "vi", "fr", or null)\n\n'
            "Return ONLY valid JSON, no markdown.\n\n"
            f"Email: {request.email}"
            f"{name_hint}"
            f"{snippet_section}"
        )

        try:
            response = await _model.generate_content_async(prompt)
        except Exception as exc:
            raise RuntimeError(f"Gemini contact enrich failed: {exc}") from exc

        text = (response.text or "").strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Failed to parse Gemini response as JSON: {text[:200]}") from exc

        return {
            "display_name": data.get("display_name"),
            "org": data.get("org"),
            "language": data.get("language"),
        }


class GeminiMergeSuggestionClient:
    async def suggest_merges(self, contacts: List[ContactSnippet]) -> List[MergeSuggestion]:
        contacts_text = "\n".join(
            f"- id={c.contact_id}, email={c.email}, name={c.name or 'unknown'}, "
            f"alt_emails={c.alternate_emails}, threads={len(c.sample_threads)}"
            for c in contacts
        )
        prompt = (
            "You are a CRM AI assistant. Analyze the following list of email contacts and identify "
            "pairs that may represent the same real-world person and should be merged. "
            "Look for: same domain + similar names, alternate emails for the same person, "
            "naming variations.\n"
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
            response = await _model.generate_content_async(prompt)
        except Exception as exc:
            raise RuntimeError(f"Gemini merge suggestion failed: {exc}") from exc

        text = (response.text or "").strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Failed to parse Gemini response as JSON: {text[:200]}") from exc

        if not isinstance(data, list):
            return []

        suggestions: List[MergeSuggestion] = []
        for item in data:
            try:
                suggestions.append(
                    MergeSuggestion(
                        source_id=item["source_id"],
                        target_id=item["target_id"],
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

