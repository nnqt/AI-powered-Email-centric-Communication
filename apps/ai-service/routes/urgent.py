from fastapi import APIRouter, HTTPException

from models.urgent import ClassifyUrgentRequest, ClassifyUrgentResponse
from services.urgent_classifier import classify_urgent

router = APIRouter()


@router.post("/classify-urgent", response_model=ClassifyUrgentResponse)
async def classify_urgent_route(request: ClassifyUrgentRequest):
    try:
        return await classify_urgent(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
