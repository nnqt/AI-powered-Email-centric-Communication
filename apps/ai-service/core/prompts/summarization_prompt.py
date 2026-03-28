from typing import Any, Dict, List

from models.summarize import SummarizeRequest


def build_summarization_prompt(
    request: SummarizeRequest,
    messages_text: str,
    language_instruction: str,
) -> str:
    latest_sender = request.messages[-1].from_ if request.messages else "unknown"
    latest_receiver = ", ".join(request.messages[-1].to) if request.messages else "unknown"

    return (
        "You are an AI assistant that summarizes email threads for a CRM-like system. "
        f"{language_instruction}\n\n"
        "Analyze the following email thread and return a JSON object with exactly these fields:\n"
        '- "summary": A concise summary in 2-3 sentences. Sentence 1 = current status, '
        'Sentence 2 = unresolved blocker or risk, Sentence 3 = optional impact note.\n'
        '- "key_issues": An array of 2-4 key issues (array of strings, short phrases).\n'
        '- "action_required": An array of 1-3 next actions (array of strings).\n'
        "Each action must follow this format:\n"
        '"[Priority: Cao|Trung bình|Thấp] [Owner: <role>] [Deadline: <mốc thời gian>] <hành động cụ thể>"\n\n'
        "Critical policy:\n"
        "- If the latest email is from an external customer/partner and the request is unresolved, "
        "the FIRST action must be drafting/sending a response to that sender.\n"
        "- Avoid generic actions like 'theo dõi thêm'; each action must be executable now.\n"
        "- Prefer concrete deadlines (e.g., 'trước 16:00 hôm nay', 'trong 4 giờ').\n\n"
        "Return ONLY valid JSON, no markdown formatting or extra text.\n\n"
        f"Thread ID: {request.thread_id}\n"
        f"Latest sender: {latest_sender}\n"
        f"Latest recipients: {latest_receiver}\n\n"
        f"Emails:\n{messages_text}"
    )


def normalize_summarization_output(data: Dict[str, Any]) -> Dict[str, Any]:
    summary = str(data.get("summary", "")).strip()

    raw_issues = data.get("key_issues", [])
    if not isinstance(raw_issues, list):
        raw_issues = []
    key_issues: List[str] = [str(item).strip() for item in raw_issues if str(item).strip()]

    raw_actions = data.get("action_required", [])
    if not isinstance(raw_actions, list):
        raw_actions = []
    action_required: List[str] = [
        str(item).strip() for item in raw_actions if str(item).strip()
    ]

    return {
        "summary": summary,
        "key_issues": key_issues[:4],
        "action_required": action_required[:3],
    }
