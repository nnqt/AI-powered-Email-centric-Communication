from typing import List

from models.contact import ContactSnippet, MergeSuggestion, SuggestMergeRequest, SuggestMergeResponse
from core.llm_client import get_merge_suggestion_client


async def suggest_merges(request: SuggestMergeRequest) -> SuggestMergeResponse:
    if not request.contacts or len(request.contacts) < 2:
        return SuggestMergeResponse(suggestions=[])

    client = get_merge_suggestion_client()
    suggestions: List[MergeSuggestion] = await client.suggest_merges(request.contacts)
    return SuggestMergeResponse(suggestions=suggestions)
