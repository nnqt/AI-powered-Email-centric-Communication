from pydantic import BaseModel
from typing import List


class LatestMessage(BaseModel):
    id: str
    from_: str
    text: str


class SuggestReplyRequest(BaseModel):
    thread_id: str
    conversation_context: str | None = None
    latest_message: LatestMessage
    max_replies: int = 3


class SuggestReplyResponse(BaseModel):
    thread_id: str
    replies: List[str]
