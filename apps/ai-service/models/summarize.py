from pydantic import BaseModel, Field
from typing import List, Union


class SummarizeMessage(BaseModel):
    id: str
    from_: str = Field(..., alias="from")
    to: List[str]
    sent_at: str
    text: str


class SummarizeRequest(BaseModel):
    thread_id: str
    messages: List[SummarizeMessage]


class SummarizeResponse(BaseModel):
    thread_id: str
    summary: Union[str, List[str]]
    key_issues: List[str]
    action_required: List[str]
