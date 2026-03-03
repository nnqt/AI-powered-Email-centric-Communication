from pydantic import BaseModel
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


class ReplyItem(BaseModel):
    subject: Optional[str] = None
    body: str


class SuggestReplyResponse(BaseModel):
    thread_id: str
    format: str
    replies: List[ReplyItem]
