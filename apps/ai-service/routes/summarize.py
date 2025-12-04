from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List

from services.summarizer import generate_summary


class SummarizeMessage(BaseModel):
    id: str
    from_: str = Field(..., alias="from")
    to: List[str]
    sent_at: str
    text: str


class SummarizeRequest(BaseModel):
    thread_id: str
    messages: List[SummarizeMessage]


class SummarizeResponse(BaseModel):
    thread_id: str
    summary: str
    key_issues: List[str]
    action_required: List[str]


router = APIRouter()


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest) -> SummarizeResponse:
    try:
        return await generate_summary(request)
    except Exception as exc:  # pragma: no cover - simple pass-through
        raise HTTPException(status_code=500, detail=str(exc)) from exc
