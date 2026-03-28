from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class LatestMessage(BaseModel):
    id: str
    from_: str
    text: str


class SuggestReplyRequest(BaseModel):
    thread_id: str
    conversation_context: Optional[str] = None
    latest_message: LatestMessage
    max_replies: int = 3
    format: Literal["email", "message"] = "message"
    # Optional context for better reply generation
    thread_intent: Optional[str] = None  # e.g., "complaint", "inquiry", "follow_up", "proposal"
    sender_category: Optional[str] = None  # e.g., "customer", "vendor", "colleague", "supplier"
    selected_next_actions: List[str] = Field(default_factory=list)
    additional_context: Optional[str] = None


class ReplyItem(BaseModel):
    subject: Optional[str] = None
    body: str


class SuggestReplyResponse(BaseModel):
    thread_id: str
    format: str
    replies: List[ReplyItem]
