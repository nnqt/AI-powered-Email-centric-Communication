from models.summarize import SummarizeRequest, SummarizeResponse
from core.llm_client import get_summarization_client


async def generate_summary(request: SummarizeRequest) -> SummarizeResponse:
    client = get_summarization_client()
    summary_text = await client.summarize_thread(request)

    return SummarizeResponse(
        thread_id=request.thread_id,
        summary=summary_text,
        key_issues=[],
        action_required=[],
    )
