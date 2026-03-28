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
        '- "summary": A timeline-based summary as an array of timeline entries. '
        'Format each entry: "<DATE_LABEL>, <key point/event>" (e.g., "Hôm nay sáng, Alex yêu cầu cập nhật deadline").\n'
        '  - Group related events by date.\n'
        '  - Each point should be concise (1-2 line).\n'
        '  - Use relative dates (Hôm nay, Hôm qua, Ngày X) and times if available.\n'
        '  - Sort chronologically (oldest first).\n'
        '- "key_issues": An array of 2-4 key issues (array of strings, short phrases).\n'
        '- "action_required": An array of 1-3 next actions (array of strings).\n'
        "Each action must be written in natural, user-friendly language with embedded priority and deadline.\n"
        "Format: '<action_verb> <object/person> (<priority_shorthand> | <deadline>)'\n"
        "Examples:\n"
        "  - 'Phản hồi khách hàng Alex (Cao | trước 16:00)'\n"
        "  - 'Kiểm tra tiến độ proj ABC (Trung bình | 2 ngày)'\n"
        "  - 'Cập nhật DB contact (Thấp | EOW)'\n"
        "Priority values MUST be exactly: 'Cao', 'Trung bình', or 'Thấp'.\n"
        "Deadline: concrete timeframe (e.g., 'trước 16:00', '48h', 'EOW', 'ASAP')\n\n"
        "Critical policy:\n"
        "- If the latest email is from an external customer/partner and the request is unresolved, "
        "the FIRST action must be drafting/sending a response to that sender.\n"
        "- Avoid generic actions like 'theo dõi thêm'; each action must be executable now.\n"
        "- Always extract priority and deadline from context and include in parentheses.\n\n"
        "Return ONLY valid JSON, no markdown formatting or extra text.\n\n"
        f"Thread ID: {request.thread_id}\n"
        f"Latest sender: {latest_sender}\n"
        f"Latest recipients: {latest_receiver}\n\n"
        f"Emails:\n{messages_text}"
    )


def normalize_summarization_output(data: Dict[str, Any]) -> Dict[str, Any]:
    raw_summary = data.get("summary", [])
    
    # Preserve array format for timeline summary
    if isinstance(raw_summary, list):
        summary = raw_summary
    else:
        # If it's a string, keep as string (backward compatibility)
        summary = str(raw_summary).strip() if raw_summary else ""

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
