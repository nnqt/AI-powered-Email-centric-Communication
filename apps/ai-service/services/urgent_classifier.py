from models.urgent import ClassifyUrgentRequest, ClassifyUrgentResponse
from core.llm_client import get_urgent_classifier


async def classify_urgent(request: ClassifyUrgentRequest) -> ClassifyUrgentResponse:
    classifier = get_urgent_classifier()
    result = await classifier.classify(request)
    return ClassifyUrgentResponse(
        thread_id=request.thread_id,
        is_urgent=result["is_urgent"],
        reason=result["reason"],
    )
