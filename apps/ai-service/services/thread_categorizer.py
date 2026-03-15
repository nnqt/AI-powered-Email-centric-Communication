from models.thread_category import ClassifyThreadCategoryRequest, ClassifyThreadCategoryResponse
from core.llm_client import get_thread_category_client


async def classify_thread_category(
    request: ClassifyThreadCategoryRequest,
) -> ClassifyThreadCategoryResponse:
    client = get_thread_category_client()
    result = await client.classify(request)
    return ClassifyThreadCategoryResponse(
        thread_id=request.thread_id,
        categories=result["categories"],
        noise_filtered=result["noise_filtered"],
    )
