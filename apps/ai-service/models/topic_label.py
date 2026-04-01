from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class TopicConsolidationCandidate(BaseModel):
    topic_id: str
    name: Optional[str] = None
    cluster_key: Optional[str] = None
    name_edited_by_user: bool = False
    thread_subjects: List[str] = Field(default_factory=list)
    thread_summaries: List[str] = Field(default_factory=list)
    thread_key_issues: List[str] = Field(default_factory=list)
    thread_action_required: List[str] = Field(default_factory=list)
    thread_categories: List[str] = Field(default_factory=list)
    business_markers: List[str] = Field(default_factory=list)
    last_inbound_at: Optional[str] = None
    last_outbound_at: Optional[str] = None
    telegram_chat_insights: List[str] = Field(default_factory=list)
    telegram_recent_messages: List[str] = Field(default_factory=list)


class TopicClusterDecision(BaseModel):
    canonical_cluster_key: str
    canonical_name: str
    topic_ids: List[str]
    confidence: float
    reason: str


class TopicNameOverride(BaseModel):
    topic_id: str
    name: str
    confidence: float = 0.8


class LabelTopicRequest(BaseModel):
    mode: Literal["label", "consolidate"] = "label"
    topic_id: Optional[str] = None
    contact_id: Optional[str] = None
    thread_subjects: List[str] = Field(default_factory=list)
    contact_name: Optional[str] = None
    candidates: List[TopicConsolidationCandidate] = Field(default_factory=list)
    min_confidence: float = 0.8


class LabelTopicResponse(BaseModel):
    mode: Literal["label", "consolidate"] = "label"
    topic_id: Optional[str] = None
    name: Optional[str] = None
    clusters: List[TopicClusterDecision] = Field(default_factory=list)
    topic_name_overrides: List[TopicNameOverride] = Field(default_factory=list)
    unmerged_topic_ids: List[str] = Field(default_factory=list)
