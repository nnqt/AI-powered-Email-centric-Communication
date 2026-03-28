"""
Action-oriented email reply prompt builder.
Generates professional email suggestions with action items structure.
"""

from typing import Optional


def build_action_reply_prompt(
    thread_intent: Optional[str],
    sender_category: Optional[str],
    conversation_context: str,
    selected_next_actions_text: str,
    additional_context: str,
    latest_message_from: str,
    latest_message_text: str,
    max_replies: int,
) -> str:
    """
    Build a prompt for generating action-oriented email replies.
    
    Args:
        thread_intent: Type of thread (complaint, inquiry, follow_up, proposal, etc.)
                      If None, prompt will ask AI to infer.
        sender_category: Relationship (customer, vendor, colleague, supplier, etc.)
                        If None, uses neutral approach.
        conversation_context: Email thread context.
        selected_next_actions_text: User-selected next actions from summary.
        additional_context: Extra user context entered manually.
        latest_message_from: Sender of latest message.
        latest_message_text: Latest message body (max 1500 chars).
        max_replies: Number of reply options to generate.
    
    Returns:
        Prompt string for Gemini.
    """
    
    # Determine intent guidance
    intent_guidance = ""
    if thread_intent:
        intent_mapping = {
            "complaint": "This is a customer complaint. Response should acknowledge the problem, apologize genuinely, and propose concrete corrective actions.",
            "inquiry": "This is an inquiry/question. Response should provide clear, helpful information and next steps.",
            "follow_up": "This is a follow-up to a previous discussion. Response should recap context, provide requested info, and confirm next actions.",
            "proposal": "This is a business proposal. Response should evaluate proposal, ask clarifying questions, or suggest improvements.",
            "thank_you": "This is a thank-you message. Response should acknowledge gratitude, reinforce relationship.",
            "negotiation": "This is a negotiation. Response should be diplomatic, propose alternatives, and find middle ground.",
        }
        intent_guidance = intent_mapping.get(
            thread_intent,
            f"This thread has intent: {thread_intent}."
        )
    else:
        intent_guidance = "Infer the thread intent (complaint, inquiry, follow-up, proposal, etc.) from context and adjust tone accordingly."
    
    # Determine tone guidance
    tone_guidance = ""
    if sender_category:
        tone_mapping = {
            "customer": "Professional yet warm tone. Customer satisfaction is priority.",
            "vendor": "Professional, assertive but respectful tone.",
            "colleague": "Friendly, collaborative tone.",
            "supplier": "Professional, transactional tone.",
            "manager": "Respectful, clear and concise tone.",
            "team": "Collaborative, inclusive tone.",
        }
        tone_guidance = tone_mapping.get(
            sender_category,
            f"Tone for {sender_category}: professional and respectful."
        )
    else:
        tone_guidance = "Professional and respectful tone. Adjust based on context."
    
    # Action-oriented email structure
    action_template = """
FORMAT FOR EMAIL REPLIES:
Each reply MUST follow this structure (in Vietnamese):

1. Subject line (e.g., "Re: [Original subject]")
2. Greeting (personalized if name is available)
3. Acknowledgment (briefly recap the issue/request)
4. Action/commitment paragraph(s):
    - Use natural, customer-friendly writing (avoid robotic templates)
    - Mention concrete next steps if they are available from user context
    - If key details are missing, ask for confirmation politely instead of inventing facts
    - Avoid placeholders like "[Tên/vị trí]" or "[Ngày]" in customer-facing output
5. Sign-off (professional closing)

CRITICAL LANGUAGE RULE:
- Respond ENTIRELY in Vietnamese (Tiếng Việt), regardless of original email language
- Translate message subjects, action descriptions, and all content into Vietnamese
- All dates and timelines should be in Vietnamese format

IMPORTANT:
- Suggest CONCRETE actions when available; if details are unknown, ask for confirmation politely
- Prefer a warm, empathetic tone for customer complaints
- Do NOT output headings like "ACTION ITEMS:" unless user explicitly asked
- Return ONLY a valid JSON array of reply objects
- Each object: { "subject": "Re: ...", "body": "Full email text in Vietnamese" }
- NO markdown, NO extra text outside JSON
"""
    
    prompt = (
        f"You are an AI assistant generating professional email reply suggestions.\n\n"
        f"{intent_guidance}\n"
        f"{tone_guidance}\n"
        f"{action_template}\n"
        f"Generate exactly {max_replies} professional email reply options.\n\n"
        f"Conversation context:\n{conversation_context}\n\n"
        f"Selected next actions (from latest summary):\n{selected_next_actions_text}\n\n"
        f"Additional context from user:\n{additional_context}\n\n"
        f"Latest message from: {latest_message_from}\n"
        f"Latest message text: {latest_message_text}\n\n"
        f"Return a JSON array like this:\n"
        f'[\n'
        f'  {{\n'
        f'    "subject": "Re: [Subject dịch sang Tiếng Việt]",\n'
        f'    "body": "Kính gửi [Name],\\n\\n[Lời phản hồi đồng cảm, rõ ràng]\\n\\n[Cam kết bước tiếp theo bằng ngôn ngữ tự nhiên, không template máy móc]\\n\\n[Lời kết thúc]"\n'
        f'  }},\n'
        f'  ...\n'
        f']\n'
    )
    
    return prompt
