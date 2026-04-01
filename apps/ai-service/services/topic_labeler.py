from core.llm_client import get_topic_label_client
from models.topic_label import LabelTopicRequest, LabelTopicResponse


async def label_topic(request: LabelTopicRequest) -> LabelTopicResponse:
    client = get_topic_label_client()
    if request.mode == "consolidate":
        result = await client.consolidate(request)
        return LabelTopicResponse(
            mode="consolidate",
            topic_id=None,
            name=None,
            clusters=result.get("clusters", []),
            topic_name_overrides=result.get("topic_name_overrides", []),
            unmerged_topic_ids=result.get("unmerged_topic_ids", []),
        )

    name = await client.label(request)
    return LabelTopicResponse(
        mode="label",
        topic_id=request.topic_id,
        name=name,
        clusters=[],
        topic_name_overrides=[],
        unmerged_topic_ids=[],
    )
