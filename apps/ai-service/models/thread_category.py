from pydantic import BaseModel
from typing import List, Optional


# Full enum of 22 thread categories
VALID_THREAD_CATEGORIES = frozenset([
    # Correspondence
    "inquiry", "introduction", "follow_up", "thank_you",
    # Business Operations
    "proposal", "contract", "invoice", "negotiation",
    # Project / Work
    "project_update", "task_request", "meeting_request", "report",
    # Support / Issue
    "support_request", "bug_report", "complaint", "feedback",
    # Automated / System
    "notification", "newsletter", "receipt", "security_alert",
    # Other
    "personal", "other",
])

# Categories that indicate noise (not worth summarizing or clustering for topics)
NOISE_CATEGORIES = frozenset([
    "notification", "newsletter", "receipt", "security_alert",
])


class ClassifyThreadCategoryRequest(BaseModel):
    thread_id: str
    subject: Optional[str] = None
    snippet: Optional[str] = None
    sender_email: Optional[str] = None
    # Contact-level categories of the sender (e.g. ["spam"], ["customer"])
    sender_categories: Optional[List[str]] = None


class ClassifyThreadCategoryResponse(BaseModel):
    thread_id: str
    categories: List[str]
    noise_filtered: bool
    topic_key: Optional[str] = None
    topic_key_confidence: Optional[float] = None
