from pydantic import BaseModel, Field
from typing import List, Literal

class AnalyzeChatRequest(BaseModel):
    text_chunk: str = Field(description="The chunk of telegram messages to analyze")
    active_topics: List[str] = Field(description="Names of active topics for this contact")

class ChatFragment(BaseModel):
    intent: str = Field(description="Main intent of this portion of the conversation")
    summary: str = Field(description="Short summary of the discussion/events")
    topic_action: Literal["route_to_existing", "create_new"] = Field(description="Whether this fragment maps to an existing topic or needs a new one")
    topic_name: str = Field(description="Name of the existing topic or a newly generated 2-5 word name")

class AnalyzeChatResponse(BaseModel):
    fragments: List[ChatFragment] = Field(default_factory=list, description="Extracted distinct conversations from the chunk")
