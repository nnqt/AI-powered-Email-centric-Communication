from fastapi import APIRouter

from models.topic_label import LabelTopicRequest, LabelTopicResponse
from services.topic_labeler import label_topic

router = APIRouter()


@router.post("/label-topic", response_model=LabelTopicResponse)
async def label_topic_route(request: LabelTopicRequest) -> LabelTopicResponse:
    return await label_topic(request)
