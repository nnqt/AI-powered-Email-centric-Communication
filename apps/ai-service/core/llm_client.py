from typing import List

import google.generativeai as genai

from models.summarize import SummarizeRequest
from models.reply import SuggestReplyRequest
from core.config import GEMINI_API_KEY, GEMINI_MODEL_NAME


if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set")

genai.configure(api_key=GEMINI_API_KEY)
_model = genai.GenerativeModel(GEMINI_MODEL_NAME)


class GeminiSummarizationClient:
    async def summarize_thread(self, request: SummarizeRequest) -> str:
        messages_text = "\n\n".join(
            f"From: {m.from_}\nTo: {', '.join(m.to)}\nSent at: {m.sent_at}\nText: {m.text}"
            for m in request.messages
        )
        prompt = (
            "You are an AI assistant that summarizes email threads for a CRM-like system. "
            "Given the following email thread, produce a concise summary focusing on key decisions, "
            "action items, and overall context. Just return the summary text, nothing else.\n\n"
            f"Thread ID: {request.thread_id}\n\nEmails:\n{messages_text}"
        )

        try:
            response = await _model.generate_content_async(prompt)
        except Exception as exc:  # pragma: no cover - network/provider
            raise RuntimeError(f"Gemini summarization failed: {exc}") from exc

        text = (response.text or "").strip()
        if not text:
            raise RuntimeError("Gemini summarization returned empty text")
        return text


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

