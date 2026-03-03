from fastapi import APIRouter, HTTPException

from models.reply import SuggestReplyRequest, SuggestReplyResponse
from services.smart_reply import suggest_replies

router = APIRouter()


@router.post("/suggest-reply", response_model=SuggestReplyResponse)
async def suggest_reply(request: SuggestReplyRequest) -> SuggestReplyResponse:
    try:
        return await suggest_replies(request)
    except Exception as exc:  # pragma: no cover - simple pass-through
        raise HTTPException(status_code=500, detail=str(exc)) from exc
