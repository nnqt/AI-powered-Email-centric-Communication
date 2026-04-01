from fastapi import APIRouter, HTTPException

from models.thread_analysis import AnalyzeThreadRequest, AnalyzeThreadResponse
from services.thread_analyzer import analyze_thread

router = APIRouter()


@router.post("/analyze-thread", response_model=AnalyzeThreadResponse)
async def analyze_thread_route(request: AnalyzeThreadRequest) -> AnalyzeThreadResponse:
    try:
        return await analyze_thread(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
