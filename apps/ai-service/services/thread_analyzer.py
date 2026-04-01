from models.thread_analysis import AnalyzeThreadRequest, AnalyzeThreadResponse
from models.summarize import SummarizeRequest
from models.thread_category import ClassifyThreadCategoryRequest
from core.llm_client import get_summarization_client, get_thread_category_client


async def analyze_thread(request: AnalyzeThreadRequest) -> AnalyzeThreadResponse:
    category_client = get_thread_category_client()
    summarize_client = get_summarization_client()

    cat = await category_client.classify(
        ClassifyThreadCategoryRequest(
            thread_id=request.thread_id,
            subject=request.subject,
            snippet=request.snippet,
            sender_email=request.sender_email,
            sender_categories=request.sender_categories,
        )
    )

    noise_filtered = bool(cat.get("noise_filtered", False))
    categories = cat.get("categories", ["other"])
    topic_key = cat.get("topic_key")
    topic_key_confidence = cat.get("topic_key_confidence")

    # Default behavior: summarize only when thread is not noise and has content.
    should_summarize = (not noise_filtered) and len(request.messages) > 0

    summary = None
    key_issues = []
    action_required = []

    if should_summarize:
        summary_result = await summarize_client.summarize_thread(
            SummarizeRequest(
                thread_id=request.thread_id,
                messages=request.messages,
            )
        )
        summary = summary_result.get("summary")
        key_issues = summary_result.get("key_issues", [])
        action_required = summary_result.get("action_required", [])

    quality_tier = "normal"
    if noise_filtered:
        quality_tier = "noise"
    elif "notification" in categories and not should_summarize:
        quality_tier = "low"
    elif any(c in categories for c in ["complaint", "support_request", "task_request", "project_update"]):
        quality_tier = "high"

    return AnalyzeThreadResponse(
        thread_id=request.thread_id,
        categories=categories,
        noise_filtered=noise_filtered,
        topic_key=topic_key,
        topic_key_confidence=topic_key_confidence,
        summary=summary,
        key_issues=key_issues,
        action_required=action_required,
        quality_tier=quality_tier,
        should_cluster=not noise_filtered,
        should_summarize=should_summarize,
    )
