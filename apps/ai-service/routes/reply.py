from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from services.smart_reply import suggest_replies


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


router = APIRouter()


@router.post("/suggest-reply", response_model=SuggestReplyResponse)
async def suggest_reply(request: SuggestReplyRequest) -> SuggestReplyResponse:
    try:
        return await suggest_replies(request)
    except Exception as exc:  # pragma: no cover - simple pass-through
        raise HTTPException(status_code=500, detail=str(exc)) from exc
