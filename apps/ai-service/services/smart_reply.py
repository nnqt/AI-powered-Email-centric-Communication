from models.reply import SuggestReplyRequest, SuggestReplyResponse, ReplyItem
from core.llm_client import get_reply_client


async def suggest_replies(request: SuggestReplyRequest) -> SuggestReplyResponse:
    client = get_reply_client()
    raw_replies = await client.suggest_replies(request)

    reply_items = [
        ReplyItem(subject=r.get("subject"), body=r.get("body", ""))
        for r in raw_replies
    ]

    return SuggestReplyResponse(
        thread_id=request.thread_id,
        format=request.format,
        replies=reply_items,
    )
