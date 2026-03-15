from fastapi import APIRouter, HTTPException

from models.thread_category import ClassifyThreadCategoryRequest, ClassifyThreadCategoryResponse
from services.thread_categorizer import classify_thread_category

router = APIRouter()


@router.post("/classify-thread-category", response_model=ClassifyThreadCategoryResponse)
async def classify_thread_category_route(request: ClassifyThreadCategoryRequest):
    try:
        return await classify_thread_category(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
