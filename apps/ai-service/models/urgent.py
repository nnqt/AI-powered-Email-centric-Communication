from pydantic import BaseModel
from typing import List, Optional


class ClassifyUrgentRequest(BaseModel):
    thread_id: str
    subject: Optional[str] = None
    snippet: Optional[str] = None
    sender_email: Optional[str] = None
    sender_categories: Optional[List[str]] = None  # e.g. ["colleague", "customer"]


class ClassifyUrgentResponse(BaseModel):
    thread_id: str
    is_urgent: bool
    reason: str
