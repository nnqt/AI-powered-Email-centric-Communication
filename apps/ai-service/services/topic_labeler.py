from core.llm_client import get_topic_label_client
from models.topic_label import LabelTopicRequest, LabelTopicResponse


async def label_topic(request: LabelTopicRequest) -> LabelTopicResponse:
    client = get_topic_label_client()
    name = await client.label(request)
    return LabelTopicResponse(topic_id=request.topic_id, name=name)
