from fastapi import APIRouter, HTTPException
from typing import Union

from models.summarize import SummarizeRequest, SummarizeResponse
from services.summarizer import generate_summary


router = APIRouter()


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest) -> SummarizeResponse:
    try:
        return await generate_summary(request)
    except Exception as exc:  # pragma: no cover - simple pass-through
        raise HTTPException(status_code=500, detail=str(exc)) from exc
