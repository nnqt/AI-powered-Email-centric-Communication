from pydantic import BaseModel
from typing import List, Optional


class LabelTopicRequest(BaseModel):
    topic_id: str
    thread_subjects: List[str]
    contact_name: Optional[str] = None


class LabelTopicResponse(BaseModel):
    topic_id: str
    name: str
