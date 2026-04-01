from pydantic import BaseModel, Field
from typing import List, Optional, Union, Literal


class AnalyzeThreadMessage(BaseModel):
    id: str
    from_: str = Field(..., alias="from")
    to: List[str]
    sent_at: str
    text: str


class AnalyzeThreadRequest(BaseModel):
    thread_id: str
    subject: Optional[str] = None
    snippet: Optional[str] = None
    sender_email: Optional[str] = None
    sender_categories: Optional[List[str]] = None
    messages: List[AnalyzeThreadMessage] = Field(default_factory=list)


class AnalyzeThreadResponse(BaseModel):
    thread_id: str
    categories: List[str]
    noise_filtered: bool
    topic_key: Optional[str] = None
    topic_key_confidence: Optional[float] = None
    summary: Optional[Union[str, List[str]]] = None
    key_issues: List[str] = Field(default_factory=list)
    action_required: List[str] = Field(default_factory=list)
    quality_tier: Literal["noise", "low", "normal", "high"] = "normal"
    should_cluster: bool = True
    should_summarize: bool = False
