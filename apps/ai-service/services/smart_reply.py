from models.reply import SuggestReplyRequest, SuggestReplyResponse
from core.llm_client import get_reply_client


async def suggest_replies(request: SuggestReplyRequest) -> SuggestReplyResponse:
    client = get_reply_client()
    replies = await client.suggest_replies(request)

    return SuggestReplyResponse(thread_id=request.thread_id, replies=replies)
